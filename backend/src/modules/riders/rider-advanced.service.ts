import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { LedgerAccountType, LedgerEntryType, DeliveryAttemptStatus, OrderStatus } from '@prisma/client';

const money = (n: number) => Math.max(0, Math.round(n));

@Injectable()
export class RiderAdvancedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  private async rider(ownerUserId: string) {
    const rider = await this.prisma.rider.findUnique({
      where: { ownerUserId },
    });

    if (!rider) {
      throw new NotFoundException('No rider profile found for this account.');
    }

    return rider;
  }

  async recommendations(ownerUserId: string) {
    const rider = await this.rider(ownerUserId);

    const [offers, reviews] = await Promise.all([
      this.prisma.deliveryAttempt.findMany({
        where: {
          riderId: rider.id,
          status: DeliveryAttemptStatus.OFFERED,
          expiresAt: { gt: new Date() },
        },
        include: {
          delivery: {
            include: {
              order: {
                include: {
                  vendor: true,
                  address: true,
                  items: true,
                },
              },
            },
          },
        },
        orderBy: { offeredAt: 'desc' },
        take: 12,
      }),

      this.prisma.review.findMany({
        where: {
          riderId: rider.id,
          riderRating: { not: null },
        },
        select: {
          riderRating: true,
        },
      }),
    ]);

    const rating = reviews.length
      ? reviews.reduce(
          (sum, review) => sum + Number(review.riderRating || 0),
          0,
        ) / reviews.length
      : 4.5;

    return offers
      .map((offer) => {
        const delivery = offer.delivery;
        const fee = delivery?.order?.deliveryFeeAmount || 0;
        const distance = Number(offer.distanceKm || 0);

        const itemCount =
          delivery?.order?.items?.reduce(
            (sum, item) => sum + item.quantity,
            0,
          ) || 0;

        /*
         * Offer ranking is operational only.
         *
         * It does not create or grant any Rider reward.
         */
        const score = Math.round(
          Math.min(
            100,
            (fee / 1000) * 25 +
              Math.max(0, 1 - distance / 8) * 45 +
              Math.min(10, itemCount) * 2 +
              Math.min(10, rating * 2),
          ),
        );

        const reasons: string[] = [];

        if (distance <= 2) {
          reasons.push('Close pickup');
        }

        if (fee >= 150000) {
          reasons.push('Strong delivery fee');
        }

        if (itemCount <= 4) {
          reasons.push('Light order');
        }

        if (!reasons.length) {
          reasons.push('Good fit for your current profile');
        }

        return {
          id: offer.id,
          deliveryId: delivery?.id,
          orderNumber: delivery?.order?.orderNumber,
          vendor: delivery?.order?.vendor?.storeName,
          pickupDistanceKm: distance,
          deliveryFeeAmount: fee,
          items: itemCount,
          score,
          reasons,
          expiresAt: offer.expiresAt,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  async predictions(ownerUserId: string) {
    const rider = await this.rider(ownerUserId);
    const since = new Date(Date.now() - 28 * 86400000);

    const rows = await this.prisma.delivery.findMany({
      where: {
        riderId: rider.id,
        deliveredAt: { gte: since },
      },
      select: {
        deliveredAt: true,
        createdAt: true,
      },
    });

    /*
     * IMPORTANT:
     * Predictions use only RIDER_EARNING ledger entries.
     *
     * This prevents bonuses, referrals, challenges, loyalty,
     * adjustments, or any other non-delivery ledger credits from
     * inflating projected Rider income.
     */
    const ledger = await this.prisma.ledgerEntry.findMany({
      where: {
        accountType: LedgerAccountType.RIDER,
        accountId: rider.id,
        type: LedgerEntryType.RIDER_EARNING,
        createdAt: { gte: since },
      },
      select: {
        amount: true,
        createdAt: true,
      },
    });

    const daily = new Map<
      string,
      {
        earnings: number;
        count: number;
      }
    >();

    for (const entry of ledger) {
      const key = entry.createdAt.toISOString().slice(0, 10);
      const value = daily.get(key) || {
        earnings: 0,
        count: 0,
      };

      value.earnings += entry.amount;
      daily.set(key, value);
    }

    for (const delivery of rows) {
      const key = delivery.deliveredAt!.toISOString().slice(0, 10);
      const value = daily.get(key) || {
        earnings: 0,
        count: 0,
      };

      value.count++;
      daily.set(key, value);
    }

    const activeDays = Math.max(1, daily.size);

    const averageDailyEarnings = Math.round(
      Array.from(daily.values()).reduce(
        (sum, value) => sum + Math.max(0, value.earnings),
        0,
      ) / activeDays,
    );

    const averageDailyDeliveries =
      Math.round((rows.length / activeDays) * 10) / 10;

    return {
      basisDays: 28,
      averageDailyEarnings,
      averageDailyDeliveries,
      forecast: {
        today: averageDailyEarnings,
        week: averageDailyEarnings * 7,
        month: averageDailyEarnings * 30,
      },
      confidence: Math.min(90, 35 + activeDays * 2),
      method:
        'Historical completed-delivery earnings over the last 28 days; forecast is an estimate, not a guaranteed income.',
    };
  }

  async demand(ownerUserId: string) {
    const rider = await this.rider(ownerUserId);

    const zones = await this.prisma.riderZone.findMany({
      where: {
        riderId: rider.id,
      },
      select: {
        serviceAreaId: true,
        serviceArea: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const since = new Date(Date.now() - 24 * 86400000);

    const rows = await this.prisma.order.groupBy({
      by: ['serviceAreaId'],
      where: {
        serviceAreaId: {
          in: zones.map((zone) => zone.serviceAreaId),
        },
        createdAt: {
          gte: since,
        },
        status: {
          notIn: [
            OrderStatus.CANCELLED,
            OrderStatus.FAILED,
            OrderStatus.REFUNDED,
          ],
        },
      },
      _count: {
        _all: true,
      },
    });

    const counts = new Map(
      rows.map((row) => [
        row.serviceAreaId,
        row._count._all,
      ]),
    );

    const result = zones
      .map((zone) => {
        const count = counts.get(zone.serviceAreaId) || 0;

        return {
          serviceAreaId: zone.serviceAreaId,
          name: zone.serviceArea.name,
          ordersLast24h: count,
          demandLevel:
            count >= 30
              ? 'HIGH'
              : count >= 12
                ? 'MEDIUM'
                : 'LOW',
          recommendation:
            count >= 12
              ? 'Good zone to position near demand'
              : 'Demand is currently lighter',
        };
      })
      .sort((a, b) => b.ordersLast24h - a.ordersLast24h);

    return {
      generatedAt: new Date().toISOString(),
      windowHours: 24,
      zones: result,
      method:
        'Recent order volume by rider service area; not a predictive AI model.',
    };
  }

  async financing(ownerUserId: string) {
    const rider = await this.rider(ownerUserId);

    const [
      completed,
      ratings,
      payouts,
      applications,
    ] = await Promise.all([
      this.prisma.delivery.count({
        where: {
          riderId: rider.id,
          deliveredAt: { not: null },
        },
      }),

      this.prisma.review.findMany({
        where: {
          riderId: rider.id,
          riderRating: { not: null },
        },
        select: {
          riderRating: true,
        },
      }),

      this.prisma.riderPayout.count({
        where: {
          riderId: rider.id,
          status: 'PAID',
        },
      }),

      this.prisma.riderFinanceApplication.findMany({
        where: {
          riderId: rider.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      }),
    ]);

    const rating = ratings.length
      ? ratings.reduce(
          (sum, review) =>
            sum + Number(review.riderRating || 0),
          0,
        ) / ratings.length
      : 0;

    const eligible =
      completed >= 30 &&
      (rating === 0 || rating >= 4);

    return {
      eligible,

      criteria: {
        minimumCompletedDeliveries: 30,
        completedDeliveries: completed,
        minimumRating: 4,
        averageRating: Number(rating.toFixed(2)),
        paidPayouts: payouts,
      },

      products: [
        {
          code: 'MOTORCYCLE_FINANCE',
          name: 'Motorcycle financing',
          available: eligible,
        },
        {
          code: 'PHONE_FINANCE',
          name: 'Phone financing',
          available: eligible,
        },
        {
          code: 'EQUIPMENT_FINANCE',
          name: 'Rider equipment financing',
          available: eligible,
        },
        {
          code: 'EARNINGS_ADVANCE',
          name: 'Earnings advance',
          available: eligible,
        },
      ],

      applications,

      disclaimer:
        'ROZZI does not approve or disburse loans in this phase. Applications are eligibility/intake records pending an approved financial partner and required legal/compliance controls.',
    };
  }

  async applyFinance(ownerUserId: string, body: any) {
    const rider = await this.rider(ownerUserId);

    const code = String(body?.productCode || '');

    if (!code) {
      throw new BadRequestException(
        'productCode is required.',
      );
    }

    const result = await this.financing(ownerUserId);

    const product = result.products.find(
      (item) => item.code === code,
    );

    if (!product) {
      throw new BadRequestException(
        'Unknown financing product.',
      );
    }

    if (!result.eligible) {
      throw new BadRequestException(
        'You do not currently meet ROZZI financing eligibility criteria.',
      );
    }

    const existing =
      await this.prisma.riderFinanceApplication.findFirst({
        where: {
          riderId: rider.id,
          productCode: code,
          status: {
            in: [
              'SUBMITTED',
              'UNDER_REVIEW',
              'APPROVED',
            ],
          },
        },
      });

    if (existing) {
      return existing;
    }

    const application =
      await this.prisma.riderFinanceApplication.create({
        data: {
          riderId: rider.id,
          productCode: code,
          amount: body?.amount
            ? money(Number(body.amount))
            : null,
          termMonths: body?.termMonths
            ? Number(body.termMonths)
            : null,
          status: 'SUBMITTED',
          notes: body?.notes || null,
        },
      });

    await this.audit.record({
      actorId: rider.ownerUserId,
      action: 'RIDER_FINANCE_APPLICATION_CREATED',
      entityType: 'RiderFinanceApplication',
      entityId: application.id,
      after: application,
    });

    return application;
  }

  async analytics(ownerUserId: string, days = 30) {
    const rider = await this.rider(ownerUserId);

    const from = new Date(
      Date.now() -
        Math.max(
          7,
          Math.min(365, Number(days) || 30),
        ) *
          86400000,
    );

    const [
      deliveries,
      ledger,
      reviews,
    ] = await Promise.all([
      this.prisma.delivery.findMany({
        where: {
          riderId: rider.id,
          createdAt: { gte: from },
        },
        select: {
          createdAt: true,
          assignedAt: true,
          deliveredAt: true,
          order: {
            select: {
              totalAmount: true,
              deliveryFeeAmount: true,
            },
          },
        },
      }),

      /*
       * Analytics must only measure actual delivery earnings.
       */
      this.prisma.ledgerEntry.findMany({
        where: {
          accountType: LedgerAccountType.RIDER,
          accountId: rider.id,
          type: LedgerEntryType.RIDER_EARNING,
          createdAt: { gte: from },
        },
        select: {
          amount: true,
          createdAt: true,
        },
      }),

      this.prisma.review.findMany({
        where: {
          riderId: rider.id,
          riderRating: { not: null },
        },
        select: {
          riderRating: true,
        },
      }),
    ]);

    const completed = deliveries.filter(
      (delivery) => delivery.deliveredAt,
    );

    const hours = completed.reduce(
      (sum, delivery) =>
        sum +
        (delivery.assignedAt &&
        delivery.deliveredAt
          ? (delivery.deliveredAt.getTime() -
              delivery.assignedAt.getTime()) /
            3600000
          : 0),
      0,
    );

    const earnings = ledger.reduce(
      (sum, entry) => sum + entry.amount,
      0,
    );

    /*
     * This remains an estimate because the existing system
     * does not record actual Rider route distance here.
     */
    const distanceKm = completed.length * 2.5;

    const dates = Array.from(
      new Set([
        ...deliveries.map((delivery) =>
          delivery.createdAt
            .toISOString()
            .slice(0, 10),
        ),
        ...ledger.map((entry) =>
          entry.createdAt
            .toISOString()
            .slice(0, 10),
        ),
      ]),
    ).sort();

    const daily = dates.map((date) => ({
      date,

      deliveries: deliveries.filter(
        (delivery) =>
          delivery.createdAt
            .toISOString()
            .slice(0, 10) === date &&
          delivery.deliveredAt,
      ).length,

      earnings: ledger
        .filter(
          (entry) =>
            entry.createdAt
              .toISOString()
              .slice(0, 10) === date,
        )
        .reduce(
          (sum, entry) => sum + entry.amount,
          0,
        ),
    }));

    return {
      range: {
        from: from.toISOString(),
        to: new Date().toISOString(),
      },

      deliveries: deliveries.length,
      completedDeliveries: completed.length,

      /*
       * Delivery earnings only.
       */
      earnings,

      averageEarningsPerDelivery: completed.length
        ? Math.round(earnings / completed.length)
        : 0,

      estimatedDistanceKm: Number(
        distanceKm.toFixed(1),
      ),

      estimatedOnlineHours: Number(
        hours.toFixed(1),
      ),

      earningsPerKm: distanceKm
        ? Math.round(earnings / distanceKm)
        : 0,

      earningsPerHour: hours
        ? Math.round(earnings / hours)
        : 0,

      averageRating: reviews.length
        ? Number(
            (
              reviews.reduce(
                (sum, review) =>
                  sum +
                  Number(
                    review.riderRating || 0,
                  ),
                0,
              ) / reviews.length
            ).toFixed(2),
          )
        : 0,

      daily,
    };
  }

  async personalized(ownerUserId: string) {
    const rider = await this.rider(ownerUserId);

    const [
      recommendations,
      predictions,
      demand,
      finance,
    ] = await Promise.all([
      this.recommendations(ownerUserId),
      this.predictions(ownerUserId),
      this.demand(ownerUserId),
      this.financing(ownerUserId),
    ]);

    return {
      riderId: rider.id,
      status: rider.status,
      isOnline: rider.isOnline,

      hero: {
        headline: rider.isOnline
          ? 'You are ready for your next delivery'
          : 'Go online when you are ready',

        subheadline: recommendations.length
          ? `You have ${recommendations.length} recommended offer${
              recommendations.length > 1 ? 's' : ''
            }.`
          : 'We will surface your best opportunities here.',
      },

      recommendations: recommendations.slice(0, 3),

      earningsForecast: predictions.forecast,

      topDemandZone: demand.zones?.[0] || null,

      /*
       * No Rider rewards, points, tiers, XP, or levels.
       */
      financingEligible: finance.eligible,

      quickLinks: [
        '/deliveries',
        '/map',
        '/earnings',
        '/performance',
        '/services',
      ],
    };
  }
}