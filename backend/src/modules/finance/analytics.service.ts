import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { LedgerAccountType, LedgerEntryType, OrderStatus } from '@prisma/client';

export interface DateRange {
  from: Date;
  to: Date;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // §36: "Allow date filtering: Today, 7 days, 30 days, Custom range."
  // Preset-to-date-range conversion is left to the caller (frontend or
  // controller query params) — this only accepts a resolved {from, to}.
  async getSummary(range: DateRange) {
    const where = { createdAt: { gte: range.from, lte: range.to } };

    const [orders, deliveredAgg, cancelledCount, failedCount, deliveredCount, totalCount] = await Promise.all([
      this.prisma.order.findMany({ where, select: { totalAmount: true, status: true } }),
      this.prisma.order.aggregate({
        where: { ...where, status: OrderStatus.DELIVERED },
        _sum: { totalAmount: true, deliveryFeeAmount: true, serviceFeeAmount: true, subtotalAmount: true },
        _avg: { totalAmount: true },
      }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.CANCELLED } }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.FAILED } }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.DELIVERED } }),
      this.prisma.order.count({ where }),
    ]);

    const [commissionAgg, riderPayoutAgg, refundAgg, paymentFeeAgg, pendingVendorAgg, pendingRiderAgg] = await Promise.all([
      this.prisma.ledgerEntry.aggregate({
        where: { type: LedgerEntryType.PLATFORM_COMMISSION, createdAt: { gte: range.from, lte: range.to } },
        _sum: { amount: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: { type: LedgerEntryType.RIDER_EARNING, createdAt: { gte: range.from, lte: range.to } },
        _sum: { amount: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: { type: LedgerEntryType.REFUND, createdAt: { gte: range.from, lte: range.to } },
        _sum: { amount: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: { type: LedgerEntryType.PAYMENT_FEE, createdAt: { gte: range.from, lte: range.to } },
        _sum: { amount: true },
      }),
      this.prisma.ledgerEntry.groupBy({
        by: ['accountId'], where: { accountType: LedgerAccountType.VENDOR }, _sum: { amount: true },
      }),
      this.prisma.ledgerEntry.groupBy({
        by: ['accountId'], where: { accountType: LedgerAccountType.RIDER }, _sum: { amount: true },
      }),
    ]);

    // GMV, per common usage, is the value of completed (delivered) orders
    // only — not every order placed, since a cancelled/failed order never
    // actually transacted.
    const gmv = deliveredAgg._sum.totalAmount ?? 0;
    const platformRevenue = commissionAgg._sum.amount ?? 0; // commission + service fee, both booked as PLATFORM_COMMISSION-type entries (see LedgerService)
    const deliveryRevenue = deliveredAgg._sum.deliveryFeeAmount ?? 0; // gross delivery fees collected; rider payout (below) is what the platform pays back out of this
    const riderPayouts = riderPayoutAgg._sum.amount ?? 0;
    const refunds = Math.abs(refundAgg._sum.amount ?? 0);
    const paymentFees = Math.abs(paymentFeeAgg._sum.amount ?? 0);
    const pendingVendorSettlements = pendingVendorAgg.reduce((sum, row) => sum + Math.max(0, row._sum.amount ?? 0), 0);
    const pendingRiderPayouts = pendingRiderAgg.reduce((sum, row) => sum + Math.max(0, row._sum.amount ?? 0), 0);
    const netContribution = platformRevenue + deliveryRevenue - riderPayouts - refunds - paymentFees;

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      gmv,
      platformRevenue,
      deliveryRevenue,
      riderPayouts,
      refunds,
      paymentFees,
      netContribution,
      pendingVendorSettlements,
      pendingRiderPayouts,
      averageOrderValue: Math.round(deliveredAgg._avg.totalAmount ?? 0),
      orderCounts: {
        total: totalCount,
        delivered: deliveredCount,
        cancelled: cancelledCount,
        failed: failedCount,
      },
    };
  }

  async getTopVendors(range: DateRange, limit = 10) {
    const grouped = await this.prisma.order.groupBy({
      by: ['vendorId'],
      where: { createdAt: { gte: range.from, lte: range.to }, status: OrderStatus.DELIVERED },
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: limit,
    });
    const vendors = await this.prisma.vendor.findMany({
      where: { id: { in: grouped.map((g) => g.vendorId) } },
      select: { id: true, storeName: true },
    });
    return grouped.map((g) => ({
      vendorId: g.vendorId,
      storeName: vendors.find((v) => v.id === g.vendorId)?.storeName ?? 'Unknown',
      orderCount: g._count.id,
      revenue: g._sum.totalAmount ?? 0,
    }));
  }

  async getTopProducts(range: DateRange, limit = 10) {
    const grouped = await this.prisma.orderItem.groupBy({
      by: ['productId', 'nameSnapshot'],
      where: { order: { createdAt: { gte: range.from, lte: range.to }, status: OrderStatus.DELIVERED } },
      _sum: { quantity: true, subtotalAmount: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });
    return grouped.map((g) => ({
      productId: g.productId,
      name: g.nameSnapshot,
      quantitySold: g._sum.quantity ?? 0,
      revenue: g._sum.subtotalAmount ?? 0,
    }));
  }

  async getTopLocations(range: DateRange, limit = 10) {
    const grouped = await this.prisma.order.groupBy({
      by: ['serviceAreaId'],
      where: { createdAt: { gte: range.from, lte: range.to }, status: OrderStatus.DELIVERED },
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: limit,
    });
    const areas = await this.prisma.serviceArea.findMany({
      where: { id: { in: grouped.map((g) => g.serviceAreaId) } },
      select: { id: true, name: true },
    });
    return grouped.map((g) => ({
      serviceAreaId: g.serviceAreaId,
      name: areas.find((a) => a.id === g.serviceAreaId)?.name ?? 'Unknown',
      orderCount: g._count.id,
      revenue: g._sum.totalAmount ?? 0,
    }));
  }
}
