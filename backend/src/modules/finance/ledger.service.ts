import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../config/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { PAYMENT_SUCCEEDED_EVENT, PaymentSucceededPayload } from '../payments/payment-events';
import { REFUND_PROCESSED_EVENT, RefundProcessedPayload } from '../payments/refund-events';
import { ORDER_TRANSITIONED_EVENT, OrderTransitionedPayload } from '../orders/order-events';
import { LedgerAccountType, LedgerEntryType, OrderStatus } from '@prisma/client';

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
    return this.prisma.ledgerEntry.create({
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

    // Idempotency: if this order has already been booked (e.g. a
    // transition somehow fires twice), don't double-book. Checked by
    // looking for an existing VENDOR_EARNING entry for this order rather
    // than trusting the caller to only call this once.
    const alreadyBooked = await this.prisma.ledgerEntry.findFirst({
      where: { orderId: payload.orderId, type: LedgerEntryType.VENDOR_EARNING },
    });
    if (alreadyBooked) {
      this.logger.warn(`Order ${payload.orderId} already has a VENDOR_EARNING entry â€” skipping re-booking.`);
      return;
    }

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
    const commissionAmount = order.items.reduce(
      (sum, item) => sum + item.commissionAmountSnapshot,
      0,
    );
    const commissionableMerchandise = order.items.reduce(
      (sum, item) => sum + item.subtotalAmount,
      0,
    );
    const vendorEarning = Math.max(
      0,
      commissionableMerchandise - commissionAmount,
    );

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

    // Rider payout: only for platform-delivered orders with an assigned
    // rider. KNOWN SIMPLIFICATION, flagged: the rider gets the FULL
    // delivery fee â€” there's no admin-configurable split (e.g. platform
    // keeps a cut of the delivery fee too) because Â§18/Â§78 don't specify
    // one concretely enough to hard-code a number. If you want the
    // platform to retain a portion of the delivery fee, this is the one
    // place that changes.
    if (order.delivery?.riderId) {
      await this.record({
        type: LedgerEntryType.RIDER_EARNING,
        accountType: LedgerAccountType.RIDER,
        accountId: order.delivery.riderId,
        orderId: order.id,
        amount: order.deliveryFeeAmount,
        description: `Delivery payout for order ${order.orderNumber}`,
        idempotencyKey: `order:${order.id}:rider-earning`,
      });
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
    const existing = await this.prisma.ledgerEntry.findFirst({
      where: { orderId: payload.orderId, type: LedgerEntryType.REFUND, description: { contains: payload.refundId } },
    });
    if (existing) return;
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
      },
    });
    if (!order) return;
    const commission = order.items.reduce(
      (sum, item) => sum + item.commissionAmountSnapshot,
      0,
    );
    const commissionableMerchandise = order.items.reduce(
      (sum, item) => sum + item.subtotalAmount,
      0,
    );
    const vendorEarning = Math.max(
      0,
      commissionableMerchandise - commission,
    );
    const base = Math.max(1, order.totalAmount);
    const vendorReversal = Math.min(vendorEarning, Math.round(refundAmount * vendorEarning /base));
    const commissionReversal = Math.min(commission + order.serviceFeeAmount, Math.max(0, refundAmount - vendorReversal));
    const riderReversal = order.delivery?.riderId ? Math.min(order.deliveryFeeAmount, Math.max(0, refundAmount - vendorReversal - commissionReversal)) : 0;

    if (vendorReversal > 0) await this.record({ type: LedgerEntryType.VENDOR_EARNING, accountType: LedgerAccountType.VENDOR, accountId: order.vendorId, orderId: order.id, amount: -vendorReversal, description: `Vendor earning reversal for refund ${payload.refundId}`, idempotencyKey: `refund:${payload.refundId}:vendor` });
    if (commissionReversal > 0) await this.record({ type: LedgerEntryType.PLATFORM_COMMISSION, accountType: LedgerAccountType.PLATFORM, orderId: order.id, amount: -commissionReversal, description: `Platform revenue reversal for refund ${payload.refundId}`, idempotencyKey: `refund:${payload.refundId}:platform-revenue` });
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
    const balance = await this.getVendorBalance(vendorId);
    if (balance <= 0) {
      throw new BadRequestException('This vendor has no pending balance to settle.');
    }
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException('Vendor not found.');
    const paymentAccount = await this.prisma.vendorPaymentAccount.findUnique({ where: { vendorId } });

    const reference = `RZ-VP-${Date.now()}-${vendorId.slice(0, 8).toUpperCase()}`;
    const entry = await this.record({
      type: LedgerEntryType.PAYOUT,
      accountType: LedgerAccountType.VENDOR,
      accountId: vendorId,
      amount: -balance,
      description: `Settlement recorded by admin ${actorId} for ${vendor.storeName}`,
      idempotencyKey: `payout:vendor:${reference}`,
    });
    await this.prisma.vendorPayout.create({
      data: { vendorId, amount: balance, status: 'PAID', reference, ledgerEntryId: entry.id,processedAt: new Date(), bankName: paymentAccount?.bankName, accountName: paymentAccount?.accountName, accountNumberLast4: paymentAccount?.accountNumberLast4 },
    });
    await this.auditLog.record({
      actorId,
      action: 'ledger.settle_vendor',
      entityType: 'Vendor',
      entityId: vendorId,
      after: { amountSettled: balance },
    });
    return entry;
  }

  async payRider(riderId: string, actorId: string) {
    const balance = await this.getRiderBalance(riderId);
    if (balance <= 0) {
      throw new BadRequestException('This rider has no pending balance to pay out.');
    }
    const rider = await this.prisma.rider.findUnique({ where: { id: riderId } });
    if (!rider) throw new NotFoundException('Rider not found.');

    const riderProfile = await this.prisma.rider.findUnique({ where: { id: riderId } });
    const reference = `RZ-RP-${Date.now()}-${riderId.slice(0, 8).toUpperCase()}`;
    const entry = await this.record({
      type: LedgerEntryType.PAYOUT,
      accountType: LedgerAccountType.RIDER,
      accountId: riderId,
      amount: -balance,
      description: `Payout recorded by admin ${actorId}`,
      idempotencyKey: `payout:rider:${riderId}:${reference}`,
    });
    await this.prisma.riderPayout.create({
      data: {
        riderId, amount: balance, status: 'PAID', reference, ledgerEntryId: entry.id, processedAt: new Date(),
        bankName: riderProfile?.bankName, accountName: riderProfile?.bankAccountName,
        accountNumberLast4: riderProfile?.bankAccountNumber ? riderProfile.bankAccountNumber.slice(-4) : undefined,
      },
    });
    await this.auditLog.record({
      actorId,
      action: 'ledger.pay_rider',
      entityType: 'Rider',
      entityId: riderId,
      after: { amountPaid: balance },
    });
    return entry;
  }

  async listEntriesForAccount(accountType: LedgerAccountType, accountId: string | null) {
    return this.prisma.ledgerEntry.findMany({
      where: { accountType, accountId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
