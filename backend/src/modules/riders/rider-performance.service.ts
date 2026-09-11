import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { OrderStatus } from '@prisma/client';

const ACHIEVEMENTS = [
  {
    code: 'FIRST_DELIVERY',
    name: 'First Ride',
    description: 'Complete your first delivery.',
    icon: '🏁',
    target: 1,
  },
  {
    code: 'TEN_DELIVERIES',
    name: 'Road Runner',
    description: 'Complete 10 deliveries.',
    icon: '🛵',
    target: 10,
  },
  {
    code: 'FIFTY_DELIVERIES',
    name: 'Delivery Pro',
    description: 'Complete 50 deliveries.',
    icon: '🏆',
    target: 50,
  },
  {
    code: 'FIVE_STAR',
    name: 'Five Star',
    description: 'Receive a 5-star rider rating.',
    icon: '⭐',
    target: 1,
  },
  {
    code: 'HUNDRED_DELIVERIES',
    name: 'Century Rider',
    description: 'Complete 100 deliveries.',
    icon: '💯',
    target: 100,
  },
];

@Injectable()
export class RiderPerformanceService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private async rider(ownerUserId: string) {
    const rider = await this.prisma.rider.findUnique({
      where: { ownerUserId },
    });

    if (!rider) {
      throw new NotFoundException(
        'No rider profile found for this account.',
      );
    }

    return rider;
  }

  private async metrics(riderId: string) {
    const [
      reviews,
      attempts,
      deliveries,
      todayDeliveries,
      weeklyDeliveries,
    ] = await Promise.all([
      this.prisma.review.findMany({
        where: {
          riderId,
          riderRating: { not: null },
        },
        select: {
          riderRating: true,
        },
      }),

      this.prisma.deliveryAttempt.findMany({
        where: {
          riderId,
        },
        select: {
          status: true,
        },
      }),

      this.prisma.delivery.findMany({
        where: {
          riderId,
        },
        select: {
          id: true,
          assignedAt: true,
          deliveredAt: true,
          order: {
            select: {
              status: true,
            },
          },
        },
      }),

      this.prisma.delivery.count({
        where: {
          riderId,
          deliveredAt: {
            gte: new Date(
              new Date().setHours(0, 0, 0, 0),
            ),
          },
        },
      }),

      this.prisma.delivery.count({
        where: {
          riderId,
          deliveredAt: {
            gte: new Date(
              Date.now() - 7 * 86400000,
            ),
          },
        },
      }),
    ]);

    const ratings = reviews
      .map((review) => review.riderRating || 0)
      .filter(Boolean);

    const rating = ratings.length
      ? Number(
          (
            ratings.reduce(
              (sum, value) => sum + value,
              0,
            ) / ratings.length
          ).toFixed(2),
        )
      : 0;

    const accepted = attempts.filter(
      (attempt) => attempt.status === 'ACCEPTED',
    ).length;

    const responded = attempts.filter((attempt) =>
      [
        'ACCEPTED',
        'DECLINED',
        'TIMED_OUT',
      ].includes(attempt.status),
    ).length;

    const acceptanceRate = responded
      ? Math.round((accepted / responded) * 100)
      : 0;

    const completed = deliveries.filter(
      (delivery) => delivery.deliveredAt,
    ).length;

    const terminal = deliveries.filter(
      (delivery) =>
        delivery.order.status === OrderStatus.DELIVERED ||
        delivery.order.status === OrderStatus.CANCELLED ||
        delivery.order.status === OrderStatus.FAILED ||
        delivery.order.status === OrderStatus.REFUNDED,
    ).length;

    const completionRate = terminal
      ? Math.round((completed / terminal) * 100)
      : 0;

    const cancelledStatuses: OrderStatus[] = [
      OrderStatus.CANCELLED,
      OrderStatus.FAILED,
    ];

    const cancelled = deliveries.filter((delivery) =>
      cancelledStatuses.includes(
        delivery.order.status,
      ),
    ).length;

    const cancellationRate = terminal
      ? Math.round(
          (cancelled / terminal) * 100,
        )
      : 0;

    const completedWithTimes = deliveries.filter(
      (delivery) =>
        delivery.assignedAt &&
        delivery.deliveredAt,
    );

    const averageDeliveryMinutes =
      completedWithTimes.length
        ? Math.round(
            completedWithTimes.reduce(
              (sum, delivery) =>
                sum +
                (delivery.deliveredAt!.getTime() -
                  delivery.assignedAt!.getTime()) /
                  60000,
              0,
            ) / completedWithTimes.length,
          )
        : 0;

    /*
     * There is no contractual ETA field in the
     * current delivery model.
     *
     * For a transparent operational proxy,
     * on-time means assigned -> delivered within
     * 45 minutes.
     */
    const onTimeRate = completedWithTimes.length
      ? Math.round(
          (completedWithTimes.filter(
            (delivery) =>
              delivery.deliveredAt!.getTime() -
                delivery.assignedAt!.getTime() <=
              45 * 60000,
          ).length /
            completedWithTimes.length) *
            100,
        )
      : 0;

    /*
     * Rider performance score is operational only.
     *
     * It does NOT generate:
     * - money
     * - bonuses
     * - XP
     * - levels
     * - rewards
     */
    const riderScore = Math.round(
      Math.max(
        0,
        Math.min(
          100,
          (rating ? (rating / 5) * 30 : 0) +
            (acceptanceRate / 100) * 20 +
            (completionRate / 100) * 20 +
            (onTimeRate / 100) * 20 +
            ((100 - cancellationRate) / 100) * 10,
        ),
      ),
    );

    return {
      rating,
      reviewCount: ratings.length,
      acceptanceRate,
      completionRate,
      cancellationRate,
      onTimeRate,
      averageDeliveryMinutes,
      completedDeliveries: completed,
      todayDeliveries,
      weeklyDeliveries,
      riderScore,
    };
  }

  private async syncAchievements(
    riderId: string,
    metrics: any,
  ) {
    const earned: any[] = [];

    for (const achievement of ACHIEVEMENTS) {
      const qualifies =
        achievement.code === 'FIRST_DELIVERY'
          ? metrics.completedDeliveries >= 1
          : achievement.code === 'TEN_DELIVERIES'
            ? metrics.completedDeliveries >= 10
            : achievement.code === 'FIFTY_DELIVERIES'
              ? metrics.completedDeliveries >= 50
              : achievement.code ===
                  'HUNDRED_DELIVERIES'
                ? metrics.completedDeliveries >= 100
                : metrics.rating >= 5;

      if (qualifies) {
        earned.push(
          await this.prisma.riderAchievement.upsert({
            where: {
              riderId_code: {
                riderId,
                code: achievement.code,
              },
            },
            update: {},
            create: {
              riderId,
              code: achievement.code,
              name: achievement.name,
              description: achievement.description,
              icon: achievement.icon,
            },
          }),
        );
      }
    }

    return earned;
  }

  async overview(ownerUserId: string) {
    const rider = await this.rider(ownerUserId);
    const metrics = await this.metrics(rider.id);

    const achievements =
      await this.syncAchievements(
        rider.id,
        metrics,
      );

    const challenges =
      await this.challengeList(rider.id);

    return {
      metrics,
      achievements,
      challenges,

      scoreBreakdown: {
        rating: 30,
        acceptance: 20,
        completion: 20,
        onTime: 20,
        cancellation: 10,
      },

      onTimeDefinition:
        'Operational proxy: delivery completed within 45 minutes of assignment because the current delivery model has no contractual ETA field.',

      earningPolicy:
        'Rider earnings come only from completed deliveries and the applicable delivery fee.',
    };
  }

  async performance(
    ownerUserId: string,
    days = 30,
  ) {
    const rider = await this.rider(ownerUserId);
    const metrics = await this.metrics(rider.id);

    const from = new Date(
      Date.now() -
        Math.max(
          1,
          Math.min(
            365,
            Number(days) || 30,
          ),
        ) *
          86400000,
    );

    const rows =
      await this.prisma.delivery.findMany({
        where: {
          riderId: rider.id,
          createdAt: {
            gte: from,
          },
        },
        select: {
          createdAt: true,
          deliveredAt: true,
        },
      });

    const trend = new Map<
      string,
      number
    >();

    for (const row of rows) {
      const date = row.createdAt
        .toISOString()
        .slice(0, 10);

      trend.set(
        date,
        (trend.get(date) || 0) +
          (row.deliveredAt ? 1 : 0),
      );
    }

    return {
      range: {
        from: from.toISOString(),
        to: new Date().toISOString(),
      },

      metrics,

      daily: Array.from(
        trend,
        ([date, completed]) => ({
          date,
          completed,
        }),
      ).sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    };
  }

  async achievementsList(
    ownerUserId: string,
  ) {
    const rider =
      await this.rider(ownerUserId);

    const metrics =
      await this.metrics(rider.id);

    await this.syncAchievements(
      rider.id,
      metrics,
    );

    return this.prisma.riderAchievement.findMany({
      where: {
        riderId: rider.id,
      },
      orderBy: {
        earnedAt: 'desc',
      },
    });
  }

  /*
   * Challenges remain as non-monetary progress
   * features only.
   *
   * They do NOT award:
   * - cash
   * - bonuses
   * - points
   * - XP
   * - levels
   * - wallet credits
   */
  private async challengeList(
    riderId: string,
  ) {
    const now = new Date();

    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const weekStart = new Date(start);
    weekStart.setDate(
      weekStart.getDate() -
        weekStart.getDay(),
    );

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(
      weekEnd.getDate() + 7,
    );

    /*
     * rewardAmount is retained at 0 because the
     * existing Prisma model may require the field.
     *
     * It is NEVER paid and there is no claim endpoint.
     */
    const definitions = [
      {
        code: 'DAILY_3',
        title: '3 deliveries today',
        description:
          'Complete 3 deliveries today.',
        target: 3,
        rewardAmount: 0,
        startsAt: start,
        endsAt: end,
      },
      {
        code: 'WEEKLY_20',
        title: '20 deliveries this week',
        description:
          'Complete 20 deliveries this week.',
        target: 20,
        rewardAmount: 0,
        startsAt: weekStart,
        endsAt: weekEnd,
      },
    ];

    const output: any[] = [];

    for (const definition of definitions) {
      let row =
        await this.prisma.riderChallengeProgress.findUnique(
          {
            where: {
              riderId_code_startsAt: {
                riderId,
                code: definition.code,
                startsAt:
                  definition.startsAt,
              },
            },
          },
        );

      if (!row) {
        row =
          await this.prisma.riderChallengeProgress.create(
            {
              data: {
                riderId,
                ...definition,
              },
            },
          );
      }

      const count =
        await this.prisma.delivery.count({
          where: {
            riderId,
            deliveredAt: {
              gte: definition.startsAt,
              lt: definition.endsAt,
            },
          },
        });

      const progress = Math.min(
        definition.target,
        count,
      );

      if (
        row.status === 'ACTIVE' &&
        progress >= definition.target
      ) {
        row =
          await this.prisma.riderChallengeProgress.update(
            {
              where: {
                id: row.id,
              },
              data: {
                progress,
                status: 'COMPLETED',
                completedAt: new Date(),
              },
            },
          );
      } else if (
        row.progress !== progress &&
        row.status === 'ACTIVE'
      ) {
        row =
          await this.prisma.riderChallengeProgress.update(
            {
              where: {
                id: row.id,
              },
              data: {
                progress,
              },
            },
          );
      }

      output.push({
        ...row,

        /*
         * Explicitly expose that challenges have
         * no monetary reward.
         */
        rewardAmount: 0,
        rewardType: 'NONE',
      });
    }

    return output;
  }

  async challenges(
    ownerUserId: string,
  ) {
    const rider =
      await this.rider(ownerUserId);

    return this.challengeList(rider.id);
  }

  /*
   * Rider referral rewards have been permanently
   * discontinued.
   *
   * These methods deliberately remain unavailable
   * at the service layer so old callers cannot
   * create or retrieve Rider referral rewards.
   */
  async referrals(
    ownerUserId: string,
  ) {
    await this.rider(ownerUserId);

    return {
      enabled: false,
      message:
        'Rider referral rewards have been discontinued.',
    };
  }

  async useReferral(
    ownerUserId: string,
    code: string,
  ) {
    await this.rider(ownerUserId);

    void code;

    return {
      enabled: false,
      message:
        'Rider referral rewards have been discontinued.',
    };
  }
}