import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import {
  OrderStatus,
  PaymentStatus,
  ReferralCreditLedgerType,
  ReferralRewardStatus,
  ReferralRiskStatus,
  ReferralStatus,
} from '@prisma/client';

import { PrismaService } from '../../config/prisma.service';
import {
  REFUND_PROCESSED_EVENT,
  RefundProcessedPayload,
} from '../payments/refund-events';

@Injectable()
export class ReferralCreditsService {
  private readonly logger = new Logger(
    ReferralCreditsService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async creditReward(
    referralRewardId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const reward = await tx.referralReward.findUnique({
        where: { id: referralRewardId },
        include: { referral: true },
      });

      if (!reward) {
        throw new Error('Referral reward not found');
      }

      if (reward.status === ReferralRewardStatus.AVAILABLE) {
        return reward;
      }

      if (reward.status !== ReferralRewardStatus.HELD) {
        return reward;
      }

      if (
        reward.holdUntil &&
        reward.holdUntil > new Date()
      ) {
        return reward;
      }

      if (
        reward.referral.status !== ReferralStatus.DELIVERED &&
        reward.referral.status !== ReferralStatus.VERIFIED &&
        reward.referral.status !== ReferralStatus.REWARDED
      ) {
        return reward;
      }

      if (
        reward.referral.riskStatus !==
        ReferralRiskStatus.CLEAR
      ) {
        await tx.referral.update({
          where: { id: reward.referralId },
          data: {
            status: ReferralStatus.DISQUALIFIED,
          },
        });

        return tx.referralReward.update({
          where: { id: reward.id },
          data: {
            status: ReferralRewardStatus.CANCELLED,
          },
        });
      }

      const orderId =
        reward.referral.qualifyingOrderId;

      if (!orderId) {
        return reward;
      }

      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          customerId: true,
          status: true,
          totalAmount: true,
          payments: {
            where: {
              status: {
                in: [
                  PaymentStatus.SUCCESS,
                  PaymentStatus.REFUNDED,
                ],
              },
            },
            orderBy: {
              paidAt: 'desc',
            },
            take: 1,
            select: {
              id: true,
              amount: true,
              status: true,
              paidAt: true,
            },
          },
          refunds: {
            where: {
              status: {
                in: [
                  'REQUESTED',
                  'PROCESSING',
                  'PROCESSED',
                ],
              },
            },
            select: {
              id: true,
              amount: true,
              status: true,
            },
          },
        },
      });

      if (!order) {
        await tx.referral.update({
          where: { id: reward.referralId },
          data: {
            status: ReferralStatus.DISQUALIFIED,
          },
        });

        return tx.referralReward.update({
          where: { id: reward.id },
          data: {
            status: ReferralRewardStatus.CANCELLED,
          },
        });
      }

      if (
        order.customerId !==
        reward.referral.referredUserId
      ) {
        await tx.referral.update({
          where: { id: reward.referralId },
          data: {
            status: ReferralStatus.DISQUALIFIED,
          },
        });

        return tx.referralReward.update({
          where: { id: reward.id },
          data: {
            status: ReferralRewardStatus.CANCELLED,
          },
        });
      }

      if (
        order.status === OrderStatus.CANCELLED ||
        order.status === OrderStatus.FAILED ||
        order.status === OrderStatus.REFUNDED
      ) {
        await tx.referral.update({
          where: { id: reward.referralId },
          data: {
            status:
              order.status === OrderStatus.CANCELLED
                ? ReferralStatus.CANCELLED
                : order.status === OrderStatus.REFUNDED
                  ? ReferralStatus.REFUNDED
                  : ReferralStatus.DISQUALIFIED,
          },
        });

        return tx.referralReward.update({
          where: { id: reward.id },
          data: {
            status: ReferralRewardStatus.CANCELLED,
          },
        });
      }

      const payment = order.payments[0];

      if (!payment || !payment.paidAt) {
        return reward;
      }

      if (
        payment.status === PaymentStatus.REFUNDED
      ) {
        await tx.referral.update({
          where: { id: reward.referralId },
          data: {
            status: ReferralStatus.REFUNDED,
          },
        });

        return tx.referralReward.update({
          where: { id: reward.id },
          data: {
            status: ReferralRewardStatus.CANCELLED,
          },
        });
      }

      if (
        payment.amount !== order.totalAmount
      ) {
        await tx.referral.update({
          where: { id: reward.referralId },
          data: {
            status: ReferralStatus.REVERSED,
          },
        });

        return tx.referralReward.update({
          where: { id: reward.id },
          data: {
            status: ReferralRewardStatus.CANCELLED,
          },
        });
      }

      if (order.refunds.length > 0) {
        await tx.referral.update({
          where: { id: reward.referralId },
          data: {
            status: ReferralStatus.REFUNDED,
          },
        });

        return tx.referralReward.update({
          where: { id: reward.id },
          data: {
            status: ReferralRewardStatus.CANCELLED,
          },
        });
      }

      if (
        order.status !== OrderStatus.DELIVERED
      ) {
        return reward;
      }

      const creditedAt = new Date();

      const account =
        await tx.referralCreditAccount.upsert({
          where: {
            customerId: reward.referrerId,
          },
          create: {
            customerId: reward.referrerId,
            balance: reward.amount,
          },
          update: {
            balance: {
              increment: reward.amount,
            },
          },
        });

      await tx.referralCreditLedger.create({
        data: {
          accountId: account.id,
          customerId: reward.referrerId,
          referralRewardId: reward.id,
          type: ReferralCreditLedgerType.CREDIT,
          amount: reward.amount,
          balanceBefore:
            account.balance - reward.amount,
          balanceAfter: account.balance,
          reference: reward.reference,
          description:
            'ROZZI Credits referral reward',
        },
      });

      const updatedReward =
        await tx.referralReward.update({
          where: { id: reward.id },
          data: {
            status: ReferralRewardStatus.AVAILABLE,
            creditedAt,
          },
        });

      await tx.referral.update({
        where: { id: reward.referralId },
        data: {
          status: ReferralStatus.CLOSED,
          verifiedAt: creditedAt,
          rewardedAt: creditedAt,
          closedAt: creditedAt,
        },
      });

      return updatedReward;
    });
  }

  @OnEvent(REFUND_PROCESSED_EVENT)
  async handleRefundProcessed(
    payload: RefundProcessedPayload,
  ) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const reward =
          await tx.referralReward.findFirst({
            where: {
              referral: {
                qualifyingOrderId: payload.orderId,
              },
              status: {
                in: [
                  ReferralRewardStatus.HELD,
                  ReferralRewardStatus.AVAILABLE,
                ],
              },
            },
            select: {
              id: true,
              referralId: true,
              referrerId: true,
              amount: true,
              reference: true,
              status: true,
              referral: {
                select: {
                  status: true,
                  riskStatus: true,
                },
              },
            },
          });

        if (!reward) {
          return;
        }

        /*
         * A refund received while the reward is still held
         * disqualifies the referral before any ROZZI Credits
         * are released.
         */
        if (
          reward.status ===
          ReferralRewardStatus.HELD
        ) {
          if (
            reward.referral.status ===
              ReferralStatus.DISQUALIFIED ||
            reward.referral.status ===
              ReferralStatus.CANCELLED ||
            reward.referral.status ===
              ReferralStatus.REFUNDED ||
            reward.referral.status ===
              ReferralStatus.REVERSED ||
            reward.referral.status ===
              ReferralStatus.FRAUD_DETECTED
          ) {
            return;
          }

          await tx.referral.update({
            where: {
              id: reward.referralId,
            },
            data: {
              status: ReferralStatus.REFUNDED,
            },
          });

          await tx.referralReward.update({
            where: {
              id: reward.id,
            },
            data: {
              status: ReferralRewardStatus.CANCELLED,
            },
          });

          return;
        }

        /*
         * Correction 12:
         *
         * If the reward has already become AVAILABLE and the
         * qualifying order is subsequently refunded, reverse
         * the ROZZI Credits reward.
         */
        if (
          reward.status !==
          ReferralRewardStatus.AVAILABLE
        ) {
          return;
        }

        const account =
          await tx.referralCreditAccount.findUnique({
            where: {
              customerId: reward.referrerId,
            },
            select: {
              id: true,
              balance: true,
            },
          });

        if (!account) {
          await tx.referral.update({
            where: {
              id: reward.referralId,
            },
            data: {
              status: ReferralStatus.REFUNDED,
            },
          });

          await tx.referralReward.update({
            where: {
              id: reward.id,
            },
            data: {
              status: ReferralRewardStatus.REVERSED,
              reversedAt: new Date(),
            },
          });

          return;
        }

        const reversalAmount = -reward.amount;
        const balanceBefore = account.balance;
        const balanceAfter =
          balanceBefore + reversalAmount;

        await tx.referralCreditAccount.update({
          where: {
            id: account.id,
          },
          data: {
            balance: {
              increment: reversalAmount,
            },
          },
        });

        await tx.referralCreditLedger.create({
          data: {
            accountId: account.id,
            customerId: reward.referrerId,
            referralRewardId: reward.id,
            type: ReferralCreditLedgerType.REVERSAL,
            amount: reversalAmount,
            balanceBefore,
            balanceAfter,
            reference: `${reward.reference}:REVERSAL`,
            description:
              'ROZZI Credits referral reward reversed after qualifying order refund',
            metadata: {
              orderId: payload.orderId,
              originalRewardReference:
                reward.reference,
              reason: 'QUALIFYING_ORDER_REFUNDED',
            },
          },
        });

        const reversedAt = new Date();

        await tx.referralReward.update({
          where: {
            id: reward.id,
          },
          data: {
            status: ReferralRewardStatus.REVERSED,
            reversedAt,
          },
        });

        await tx.referral.update({
          where: {
            id: reward.referralId,
          },
          data: {
            status: ReferralStatus.REFUNDED,
          },
        });
      });
    } catch (error) {
      this.logger.error(
        `Failed to process referral refund for order ${payload.orderId}`,
        error instanceof Error
          ? error.stack
          : String(error),
      );
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async releaseHeldRewards() {
    const now = new Date();

    const rewards =
      await this.prisma.referralReward.findMany({
        where: {
          status: ReferralRewardStatus.HELD,
          holdUntil: {
            not: null,
            lte: now,
          },
        },
        select: {
          id: true,
        },
        orderBy: {
          holdUntil: 'asc',
        },
        take: 100,
      });

    for (const reward of rewards) {
      try {
        await this.creditReward(reward.id);
      } catch (error) {
        this.logger.error(
          `Failed to release referral reward ${reward.id}`,
          error instanceof Error
            ? error.stack
            : String(error),
        );
      }
    }
  }
}