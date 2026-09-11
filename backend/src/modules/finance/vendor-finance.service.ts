import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LedgerAccountType, LedgerEntryType, OrderStatus, VendorPayoutStatus } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { vendorForUser } from '../../common/utils/vendor-context';
import { AuditLogService } from '../audit/audit-log.service';
import { LedgerService } from './ledger.service';

@Injectable()
export class VendorFinanceService {
  constructor(private readonly prisma: PrismaService, private readonly ledger: LedgerService, private readonly audit: AuditLogService) {}

  private async vendor(ownerUserId: string) {
    return vendorForUser(this.prisma, ownerUserId);
  }

  private range(from?: string, to?: string) {
    const end = to ? new Date(to) : new Date();
    const start = from ? new Date(from) : new Date(end.getTime() - 30 * 86400000);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new BadRequestException('Invalid finance date range.');
    if (start > end) throw new BadRequestException('Finance start date cannot be after end date.');
    return { gte: start, lte: end };
  }

  async overview(ownerUserId: string, from?: string, to?: string) {
    const vendor = await this.vendor(ownerUserId);
    const date = this.range(from, to);
    const balance = await this.ledger.getVendorBalance(vendor.id);
    const [delivered, pendingOrders, payouts, account, entries] = await Promise.all([
      this.prisma.order.findMany({
        where: { vendorId: vendor.id, status: OrderStatus.DELIVERED, createdAt: date },
        select: {
          id: true,
          subtotalAmount: true,
          totalAmount: true,
          commissionRateSnapshot: true,
          deliveryFeeAmount: true,
          serviceFeeAmount: true,
          discountAmount: true,
          items: {
            select: {
              subtotalAmount: true,
              commissionAmountSnapshot: true,
            },
          },
        },
      }),
      this.prisma.order.aggregate({
        where: {
          vendorId: vendor.id,
          createdAt: date,
          status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.FAILED, OrderStatus.REFUNDED] },
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      this.prisma.vendorPayout.findMany({ where: { vendorId: vendor.id }, orderBy: { createdAt: 'desc' }, take: 5 }),
      this.prisma.vendorPaymentAccount.findUnique({ where: { vendorId: vendor.id } }),
      this.prisma.ledgerEntry.findMany({
        where: { accountType: LedgerAccountType.VENDOR, accountId: vendor.id, createdAt: date },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const grossSales = delivered.reduce(
      (s, o) => s + o.items.reduce((sum, item) => sum + item.subtotalAmount, 0),
      0,
    );
    const commission = delivered.reduce(
      (s, o) => s + o.items.reduce((sum, item) => sum + item.commissionAmountSnapshot, 0),
      0,
    );
    const discounts = delivered.reduce((s, o) => s + o.discountAmount, 0);
    const deliveryFees = delivered.reduce((s, o) => s + o.deliveryFeeAmount, 0);
    const vendorEarnings = delivered.reduce(
      (s, o) => {
        const merchandise = o.items.reduce((sum, item) => sum + item.subtotalAmount, 0);
        const itemCommission = o.items.reduce((sum, item) => sum + item.commissionAmountSnapshot, 0);
        return s + Math.max(0, merchandise - itemCommission);
      },
      0,
    );
    const paidOut = payouts.filter(p => p.status === VendorPayoutStatus.PAID).reduce((s, p) => s + p.amount, 0);

    return {
      range: { from: date.gte.toISOString(), to: date.lte.toISOString() },
      availableBalance: Math.max(0, balance),
      ledgerBalance: balance,
      pendingBalance: Math.max(0, pendingOrders._sum.totalAmount ?? 0),
      pendingOrderCount: pendingOrders._count.id,
      grossSales,
      vendorEarnings,
      commission,
      discounts,
      deliveryFees,
      paidOut,
      orderCount: delivered.length,
      averageOrderValue: delivered.length ? Math.round(delivered.reduce((s, o) => s + o.totalAmount, 0) / delivered.length) : 0,
      paymentAccount: account
        ? {
            id: account.id,
            bankName: account.bankName,
            bankCode: account.bankCode,
            accountName: account.accountName,
            accountNumberLast4: account.accountNumberLast4,
            payoutMethod: account.payoutMethod,
            status: account.status,
            verifiedAt: account.verifiedAt,
          }
        : null,
      recentTransactions: entries,
      recentPayouts: payouts,
    };
  }

  async earnings(ownerUserId: string, from?: string, to?: string) {
    const vendor = await this.vendor(ownerUserId);
    const date = this.range(from, to);
    const orders = await this.prisma.order.findMany({
      where: { vendorId: vendor.id, status: OrderStatus.DELIVERED, createdAt: date },
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        subtotalAmount: true,
        totalAmount: true,
        commissionRateSnapshot: true,
        deliveryFeeAmount: true,
        serviceFeeAmount: true,
        discountAmount: true,
        items: {
          select: {
            subtotalAmount: true,
            commissionAmountSnapshot: true,
          },
        },
      },
    });

    return orders.map(o => {
      const merchandise = o.items.reduce((sum, item) => sum + item.subtotalAmount, 0);
      const commission = o.items.reduce((sum, item) => sum + item.commissionAmountSnapshot, 0);
      return {
        ...o,
        commissionAmount: commission,
        vendorEarning: Math.max(0, merchandise - commission),
      };
    });
  }

  async transactions(ownerUserId: string, from?: string, to?: string, type?: string) {
    const vendor = await this.vendor(ownerUserId);
    const date = this.range(from, to);
    const validTypes = Object.values(LedgerEntryType) as string[];
    if (type && !validTypes.includes(type)) throw new BadRequestException('Invalid ledger transaction type.');
    return this.prisma.ledgerEntry.findMany({
      where: {
        accountType: LedgerAccountType.VENDOR,
        accountId: vendor.id,
        createdAt: date,
        ...(type ? { type: type as LedgerEntryType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async payouts(ownerUserId: string) {
    const vendor = await this.vendor(ownerUserId);
    return this.prisma.vendorPayout.findMany({ where: { vendorId: vendor.id }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async getPaymentAccount(ownerUserId: string) {
    const vendor = await this.vendor(ownerUserId);
    const account = await this.prisma.vendorPaymentAccount.findUnique({ where: { vendorId: vendor.id } });
    if (!account) return null;
    return {
      id: account.id,
      bankName: account.bankName,
      bankCode: account.bankCode,
      accountName: account.accountName,
      accountNumberLast4: account.accountNumberLast4,
      providerAccountId: account.providerAccountId,
      payoutMethod: account.payoutMethod,
      status: account.status,
      verifiedAt: account.verifiedAt,
    };
  }

  async upsertPaymentAccount(ownerUserId: string, dto: { bankName: string; bankCode?: string; accountName: string; accountNumber: string; providerAccountId?: string; payoutMethod?: string }) {
    const vendor = await this.vendor(ownerUserId);
    const last4 = dto.accountNumber.slice(-4);
    const result = await this.prisma.vendorPaymentAccount.upsert({
      where: { vendorId: vendor.id },
      update: {
        bankName: dto.bankName.trim(),
        bankCode: dto.bankCode?.trim(),
        accountName: dto.accountName.trim(),
        accountNumberLast4: last4,
        providerAccountId: dto.providerAccountId?.trim(),
        payoutMethod: dto.payoutMethod ?? 'BANK_TRANSFER',
        status: 'PENDING',
        verifiedAt: null,
      },
      create: {
        vendorId: vendor.id,
        bankName: dto.bankName.trim(),
        bankCode: dto.bankCode?.trim(),
        accountName: dto.accountName.trim(),
        accountNumberLast4: last4,
        providerAccountId: dto.providerAccountId?.trim(),
        payoutMethod: dto.payoutMethod ?? 'BANK_TRANSFER',
      },
    });
    await this.audit.record({
      actorId: ownerUserId,
      action: 'vendor.finance.payment_account_updated',
      entityType: 'VendorPaymentAccount',
      entityId: result.id,
      after: {
        bankName: result.bankName,
        accountName: result.accountName,
        accountNumberLast4: result.accountNumberLast4,
        status: result.status,
      },
    });
    return this.getPaymentAccount(ownerUserId);
  }
}
