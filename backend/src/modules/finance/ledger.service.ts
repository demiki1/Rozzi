import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../config/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { PAYMENT_SUCCEEDED_EVENT, PaymentSucceededPayload } from '../payments/payment-events';
import { REFUND_PROCESSED_EVENT, RefundProcessedPayload } from '../payments/refund-events';
import { ORDER_TRANSITIONED_EVENT, OrderTransitionedPayload } from '../orders/order-events';
import { LedgerAccountType, LedgerEntryType, OrderStatus, Prisma } from '@prisma/client';

@Injectable()
export class LedgerService {
  private readonly logger = new Logger('LedgerService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // Low-level primitive â€” every other method in this service (and every
  // event listener) ultimately calls this. Nothing in the codebase should
  // ever do `prisma.ledgerEntry.create` directly outside this file.
  async record(params: {
    type: LedgerEntryType;
    accountType: LedgerAccountType;
    accountId?: string | null;
    orderId?: string | null;
    amount: number;
    description?: string;
    idempotencyKey?: string | null;
  }) {
    if (params.idempotencyKey) {
      const existing = await this.prisma.ledgerEntry.findFirst({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existing) return existing;
    }

    try {
      return await this.prisma.ledgerEntry.create({
        data: {
          type: params.type,
          accountType: params.accountType,
          accountId: params.accountId ?? null,
          orderId: params.orderId ?? null,
          amount: params.amount,
          description: params.description,
          idempotencyKey: params.idempotencyKey ?? null,
        },
      });
    } catch (error) {
      if (
        params.idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.ledgerEntry.findFirst({
          where: { idempotencyKey: params.idempotencyKey },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  // ---- Event-driven booking ----

  // Books the gross cash inflow the instant payment is verified. Recorded
  // against the PLATFORM account (no accountId) â€” this is money now in the
  // platform's custody, not yet split between vendor/rider/commission.
  // That split happens separately, at DELIVERED, in onOrderDelivered below.
  @OnEvent(PAYMENT_SUCCEEDED_EVENT)
  async onPaymentSucceeded(payload: PaymentSucceededPayload) {
    const idempotencyKey = `payment:${payload.paymentId}:customer-payment`;
    const existing = await this.prisma.ledgerEntry.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    return this.record({
      type: LedgerEntryType.CUSTOMER_PAYMENT,
      accountType: LedgerAccountType.PLATFORM,
      orderId: payload.orderId,
      amount: payload.amountKobo,
      description: `Customer payment received for order`,
      idempotencyKey,
    });
  }

  // Books vendor earning, platform commission, and (for delivery orders)
  // rider earning â€” all at the moment an order is actually DELIVERED, not
  // at payment time. This is deliberate: an order that's paid but later
  // cancelled should never have generated a vendor/rider earning in the
  // first place, and DELIVERED is the point past which that can't happen
  // (Â§14's state machine has no DELIVERED -> CANCELLED transition).
  @OnEvent(ORDER_TRANSITIONED_EVENT)
  async onOrderTransitioned(payload: OrderTransitionedPayload) {
    if (payload.toStatus !== OrderStatus.DELIVERED) return;

    const order = await this.prisma.order.findUnique({
      where: { id: payload.orderId },
      include: {
        delivery: true,
        items: {
          select: {
            subtotalAmount: true,
            commissionRateSnapshot: true,
            commissionAmountSnapshot: true,
          },
        },
        pricingConfig: { select: { riderPayoutRatePercent: true } },
        promotion: { select: { vendorId: true } },
      },
    });
    if (!order) {
      this.logger.error(`Order ${payload.orderId} not found while booking ledger entries.`);
      return;
    }

    // Commission is calculated from the immutable item-level snapshots
    // created at checkout. This preserves the exact vendor/category/global
    // rate that applied to each item and keeps delivery/service fees outside
    // the vendor commission base.
    const commissionableMerchandise = order.items.reduce((sum, item) => sum + item.subtotalAmount, 0);
    const promotionDiscount = Math.min(Math.max(0, order.discountAmount), commissionableMerchandise);
    const vendorFundedPromotion = Boolean(order.promotionId && order.promotion?.vendorId);
    const netCommissionBase = vendorFundedPromotion ? Math.max(0, commissionableMerchandise - promotionDiscount) : commissionableMerchandise;
    const grossCommission = order.items.reduce((sum, item) => sum + item.commissionAmountSnapshot, 0);
    const commissionAmount = vendorFundedPromotion && commissionableMerchandise > 0 ? Math.min(grossCommission, Math.round(grossCommission * netCommissionBase / commissionableMerchandise)) : grossCommission;
    const vendorEarning = Math.max(0, netCommissionBase - commissionAmount);

    await this.record({
      type: LedgerEntryType.VENDOR_EARNING,
      accountType: LedgerAccountType.VENDOR,
      accountId: order.vendorId,
      orderId: order.id,
      amount: vendorEarning,
      description: `Vendor earning for order ${order.orderNumber}`,
      idempotencyKey: `order:${order.id}:vendor-earning`,
    });

    await this.record({
      type: LedgerEntryType.PLATFORM_COMMISSION,
      accountType: LedgerAccountType.PLATFORM,
      orderId: order.id,
      amount: commissionAmount,
      description: `Commission (${order.commissionRateSnapshot}%) on order ${order.orderNumber}`,
      idempotencyKey: `order:${order.id}:platform-commission`,
    });

    if (promotionDiscount > 0 && !vendorFundedPromotion) {
      await this.record({ type: LedgerEntryType.PROMOTION, accountType: LedgerAccountType.PLATFORM, orderId: order.id, amount: -promotionDiscount, description: `ROZZI-funded promotion for order ${order.orderNumber}`, idempotencyKey: `order:${order.id}:promotion-expense` });
    }

    const riderPayoutRate = Math.min(100, Math.max(0, Number(order.riderPayoutRateSnapshot ?? order.pricingConfig?.riderPayoutRatePercent ?? 92)));

    if (order.riderPayoutRateSnapshot == null) {
      await this.prisma.order.update({ where: { id: order.id }, data: { riderPayoutRateSnapshot: riderPayoutRate } });
    }

    if (order.delivery?.riderId && order.deliveryFeeAmount > 0) {
      const riderEarning = Math.round(order.deliveryFeeAmount * riderPayoutRate / 100);
      const rozziDeliveryShare = order.deliveryFeeAmount - riderEarning;
      await this.record({ type: LedgerEntryType.RIDER_EARNING, accountType: LedgerAccountType.RIDER, accountId: order.delivery.riderId, orderId: order.id, amount: riderEarning, description: `Delivery payout (${riderPayoutRate}% rider) for order ${order.orderNumber}`, idempotencyKey: `order:${order.id}:rider-earning` });
      if (rozziDeliveryShare > 0) await this.record({ type: LedgerEntryType.PLATFORM_COMMISSION, accountType: LedgerAccountType.PLATFORM, orderId: order.id, amount: rozziDeliveryShare, description: `Delivery revenue (${100 - riderPayoutRate}% ROZZI) for order ${order.orderNumber}`, idempotencyKey: `order:${order.id}:delivery-platform-share` });
    }

    // Service fee (Â§61 lists it as its own revenue line) is booked as a
    // second, distinctly-described PLATFORM entry rather than folded into
    // PLATFORM_COMMISSION, so analytics can tell the two apart if needed â€”
    // both currently roll up into "platform revenue" in AnalyticsService.
    if (order.serviceFeeAmount > 0) {
      await this.record({
        type: LedgerEntryType.PLATFORM_COMMISSION,
        accountType: LedgerAccountType.PLATFORM,
        orderId: order.id,
        amount: order.serviceFeeAmount,
        description: `Service fee for order ${order.orderNumber}`,
        idempotencyKey: `order:${order.id}:service-fee`,
      });
    }
  }

  @OnEvent(REFUND_PROCESSED_EVENT)
  async onRefundProcessed(payload: RefundProcessedPayload) {
    const refundAmount = Math.abs(payload.amountKobo);
    await this.record({
      type: LedgerEntryType.REFUND,
      accountType: LedgerAccountType.PLATFORM,
      orderId: payload.orderId,
      amount: -refundAmount,
      description: `Refund ${payload.refundId} for order ${payload.orderId}`,
      idempotencyKey: `refund:${payload.refundId}:platform`,
    });

    // Reverse the economic allocation created at delivery. This keeps vendor
    // earnings from remaining overstated after a full or partial refund. The
    // refund is allocated proportionally across the original delivered-order
    // components; each compensating entry is independently idempotent.
    const order = await this.prisma.order.findUnique({
      where: { id: payload.orderId },
      include: {
        delivery: true,
        items: {
          select: {
            subtotalAmount: true,
            commissionRateSnapshot: true,
            commissionAmountSnapshot: true,
          },
        },
        pricingConfig: { select: { riderPayoutRatePercent: true } },
        promotion: { select: { vendorId: true } },
      },
    });
    if (!order) return;
    const commissionableMerchandise = order.items.reduce((sum, item) => sum + item.subtotalAmount, 0);
    const promotionDiscount = Math.min(Math.max(0, order.discountAmount), commissionableMerchandise);
    const vendorFundedPromotion = Boolean(order.promotionId && order.promotion?.vendorId);
    const netCommissionBase = vendorFundedPromotion ? Math.max(0, commissionableMerchandise - promotionDiscount) : commissionableMerchandise;
    const grossCommission = order.items.reduce((sum, item) => sum + item.commissionAmountSnapshot, 0);
    const commission = vendorFundedPromotion && commissionableMerchandise > 0 ? Math.min(grossCommission, Math.round(grossCommission * netCommissionBase / commissionableMerchandise)) : grossCommission;
    const vendorEarning = Math.max(0, netCommissionBase - commission);
    const base = Math.max(1, order.totalAmount);
    const vendorReversal = Math.min(vendorEarning, Math.round(refundAmount * vendorEarning /base));
    const commissionReversal = Math.min(commission + order.serviceFeeAmount, Math.max(0, refundAmount - vendorReversal));
    const riderRate = Math.min(100, Math.max(0, Number(order.riderPayoutRateSnapshot ?? order.pricingConfig?.riderPayoutRatePercent ?? 92)));
    const riderEarned = Math.round(order.deliveryFeeAmount * riderRate / 100);
    const riderReversal = order.delivery?.riderId ? Math.min(riderEarned, Math.max(0, refundAmount - vendorReversal - commissionReversal)) : 0;

    if (vendorReversal > 0) await this.record({ type: LedgerEntryType.VENDOR_EARNING, accountType: LedgerAccountType.VENDOR, accountId: order.vendorId, orderId: order.id, amount: -vendorReversal, description: `Vendor earning reversal for refund ${payload.refundId}`, idempotencyKey: `refund:${payload.refundId}:vendor` });
    if (commissionReversal > 0) await this.record({ type: LedgerEntryType.PLATFORM_COMMISSION, accountType: LedgerAccountType.PLATFORM, orderId: order.id, amount: -commissionReversal, description: `Platform revenue reversal for refund ${payload.refundId}`, idempotencyKey: `refund:${payload.refundId}:platform-revenue` });
    if (promotionDiscount > 0 && !vendorFundedPromotion) {
      const promotionReversal = Math.min(promotionDiscount, Math.max(0, Math.round(refundAmount * promotionDiscount / Math.max(1, order.totalAmount))));
      if (promotionReversal > 0) await this.record({ type: LedgerEntryType.PROMOTION, accountType: LedgerAccountType.PLATFORM, orderId: order.id, amount: promotionReversal, description: `ROZZI promotion expense reversal for refund ${payload.refundId}`, idempotencyKey: `refund:${payload.refundId}:promotion` });
    }
    if (riderReversal > 0 && order.delivery?.riderId) await this.record({ type: LedgerEntryType.RIDER_EARNING, accountType: LedgerAccountType.RIDER, accountId: order.delivery.riderId, orderId: order.id, amount: -riderReversal, description: `Rider earning reversal for refund ${payload.refundId}`, idempotencyKey: `refund:${payload.refundId}:rider` });
  }

  // ---- Derived balances (never stored, always summed â€” Â§35) ----

  async getBalance(accountType: LedgerAccountType, accountId: string | null): Promise<number> {
    const result = await this.prisma.ledgerEntry.aggregate({
      where: { accountType, accountId },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  async getVendorBalance(vendorId: string) {
    return this.getBalance(LedgerAccountType.VENDOR, vendorId);
  }

  async getRiderBalance(riderId: string) {
    return this.getBalance(LedgerAccountType.RIDER, riderId);
  }

  // Vendors/riders with a positive pending balance â€” the "who do we owe
  // money to" list for Â§77/Â§78's settlement screens.
  async listPendingVendorBalances() {
    const grouped = await this.prisma.ledgerEntry.groupBy({
      by: ['accountId'],
      where: { accountType: LedgerAccountType.VENDOR },
      _sum: { amount: true },
    });
    const positive = grouped.filter((g) => (g._sum.amount ?? 0) > 0);
    const vendors = await this.prisma.vendor.findMany({
      where: { id: { in: positive.map((g) => g.accountId!) } },
      select: { id: true, storeName: true },
    });
    return positive.map((g) => ({
      vendorId: g.accountId,
      storeName: vendors.find((v) => v.id === g.accountId)?.storeName ?? 'Unknown',
      pendingBalance: g._sum.amount ?? 0,
    }));
  }

  async listPendingRiderBalances() {
    const grouped = await this.prisma.ledgerEntry.groupBy({
      by: ['accountId'],
      where: { accountType: LedgerAccountType.RIDER },
      _sum: { amount: true },
    });
    const positive = grouped.filter((g) => (g._sum.amount ?? 0) > 0);
    const riders = await this.prisma.rider.findMany({
      where: { id: { in: positive.map((g) => g.accountId!) } },
      include: { owner: { select: { fullName: true } } },
    });
    return positive.map((g) => ({
      riderId: g.accountId,
      name: riders.find((r) => r.id === g.accountId)?.owner.fullName ?? 'Unknown',
      pendingBalance: g._sum.amount ?? 0,
    }));
  }

  // ---- Settlement / payout actions (Â§77, Â§78) ----
  //
  // HONEST SCOPE FLAG: this records that a payout HAPPENED â€” it does not
  // execute one. There is no bank transfer integration here. Per Â§77:
  // "Actual settlement execution should be integrated only after the
  // payment/financial architecture is properly configured and compliant."
  // An admin clicking "settle" is asserting "I have paid this vendor/rider
  // outside this system" and this just zeroes their ledger balance and
  // creates the audit trail for it.

  async settleVendor(vendorId: string, actorId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`vendor-settlement:${vendorId}`}))`;
      const grouped = await tx.ledgerEntry.aggregate({
        where: { accountType: LedgerAccountType.VENDOR, accountId: vendorId },
        _sum: { amount: true },
      });
      const balance = grouped._sum.amount ?? 0;
      if (balance <= 0) throw new BadRequestException('This vendor has no pending balance to settle.');
      const vendor = await tx.vendor.findUnique({ where: { id: vendorId } });
      if (!vendor) throw new NotFoundException('Vendor not found.');
      const paymentAccount = await tx.vendorPaymentAccount.findUnique({ where: { vendorId } });
      const reference = `RZ-VP-${Date.now()}-${vendorId.slice(0, 8).toUpperCase()}`;
      const entry = await tx.ledgerEntry.create({
        data: {
          type: LedgerEntryType.PAYOUT, accountType: LedgerAccountType.VENDOR, accountId: vendorId, amount: -balance,
          description: `Settlement recorded by admin ${actorId} for ${vendor.storeName}`,
          idempotencyKey: `payout:vendor:${reference}`,
        },
      });
      await tx.vendorPayout.create({
        data: { vendorId, amount: balance, status: 'PAID', reference, ledgerEntryId: entry.id, processedAt: new Date(), bankName: paymentAccount?.bankName, accountName: paymentAccount?.accountName, accountNumberLast4: paymentAccount?.accountNumberLast4 },
      });
      return { entry, balance };
    });
    await this.auditLog.record({ actorId, action: 'ledger.settle_vendor', entityType: 'Vendor', entityId: vendorId, after: { amountSettled: result.balance } });
    return result.entry;
  }

  async payRider(riderId: string, actorId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`rider-settlement:${riderId}`}))`;
      const grouped = await tx.ledgerEntry.aggregate({
        where: { accountType: LedgerAccountType.RIDER, accountId: riderId },
        _sum: { amount: true },
      });
      const balance = grouped._sum.amount ?? 0;
      if (balance <= 0) throw new BadRequestException('This rider has no pending balance to pay out.');
      const rider = await tx.rider.findUnique({ where: { id: riderId } });
      if (!rider) throw new NotFoundException('Rider not found.');
      const reference = `RZ-RP-${Date.now()}-${riderId.slice(0, 8).toUpperCase()}`;
      const entry = await tx.ledgerEntry.create({
        data: {
          type: LedgerEntryType.PAYOUT, accountType: LedgerAccountType.RIDER, accountId: riderId, amount: -balance,
          description: `Payout recorded by admin ${actorId}`,
          idempotencyKey: `payout:rider:${riderId}:${reference}`,
        },
      });
      await tx.riderPayout.create({
        data: {
          riderId, amount: balance, status: 'PAID', reference, ledgerEntryId: entry.id, processedAt: new Date(),
          bankName: rider.bankName, accountName: rider.bankAccountName,
          accountNumberLast4: rider.bankAccountNumber ? rider.bankAccountNumber.slice(-4) : undefined,
        },
      });
      return { entry, balance };
    });
    await this.auditLog.record({ actorId, action: 'ledger.pay_rider', entityType: 'Rider', entityId: riderId, after: { amountPaid: result.balance } });
    return result.entry;
  }

  async listEntriesForAccount(accountType: LedgerAccountType, accountId: string | null) {
    return this.prisma.ledgerEntry.findMany({
      where: { accountType, accountId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
