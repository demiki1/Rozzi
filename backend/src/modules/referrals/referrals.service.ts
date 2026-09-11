import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ReferralRiskStatus,
  ReferralStatus,
} from '@prisma/client';
import { randomBytes } from 'crypto';

import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private normalizeCode(code: string) {
    return code.trim().toUpperCase();
  }

  private generateCode() {
    return randomBytes(6)
      .toString('base64url')
      .toUpperCase();
  }

  private async createUniqueReferralCode() {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = this.generateCode();

      const existing =
        await this.prisma.user.findUnique({
          where: {
            referralCode: code,
          },
          select: {
            id: true,
          },
        });

      if (!existing) {
        return code;
      }
    }

    throw new ConflictException(
      'Unable to generate a unique referral code.',
    );
  }

  /**
   * Gets or creates the permanent personal referral code
   * belonging to an existing customer.
   *
   * The personal referral code is stored directly on User.
   * Referral attribution is handled separately by
   * attributeReferral().
   */
  async getOrCreateReferralCode(
    customerId: string,
  ) {
    const customer =
      await this.prisma.user.findUnique({
        where: {
          id: customerId,
        },
        select: {
          id: true,
          role: true,
          referralCode: true,
        },
      });

    if (!customer) {
      throw new NotFoundException(
        'Customer not found.',
      );
    }

    if (customer.role !== 'CUSTOMER') {
      throw new BadRequestException(
        'Only customers can have referral codes.',
      );
    }

    if (customer.referralCode) {
      return {
        referralCode: customer.referralCode,
        referralLink:
          this.buildReferralLink(
            customer.referralCode,
          ),
      };
    }

    const code =
      await this.createUniqueReferralCode();

    try {
      const updated =
        await this.prisma.user.update({
          where: {
            id: customerId,
          },
          data: {
            referralCode: code,
          },
          select: {
            referralCode: true,
          },
        });

      return {
        referralCode: updated.referralCode!,
        referralLink:
          this.buildReferralLink(
            updated.referralCode!,
          ),
      };
    } catch (error) {
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing =
          await this.prisma.user.findUnique({
            where: {
              id: customerId,
            },
            select: {
              referralCode: true,
            },
          });

        if (existing?.referralCode) {
          return {
            referralCode:
              existing.referralCode,
            referralLink:
              this.buildReferralLink(
                existing.referralCode,
              ),
          };
        }
      }

      throw error;
    }
  }

  private buildReferralLink(code: string) {
    const baseUrl = (
      process.env.CUSTOMER_APP_URL ||
      'http://localhost:3002'
    ).replace(/\/+$/, '');

    return `${baseUrl}/register?ref=${encodeURIComponent(
      code,
    )}`;
  }

  /**
   * Resolve a public referral code.
   *
   * This does not create attribution.
   * It only validates that the code belongs to an
   * active customer and that the referral program
   * is active.
   */
  async resolveReferralCode(code: string) {
    const normalized =
      this.normalizeCode(code);

    if (!normalized) {
      throw new BadRequestException(
        'Referral code is required.',
      );
    }

    const config =
      await this.getActiveProgramConfig();

    if (!config) {
      throw new BadRequestException(
        'The referral program is currently unavailable.',
      );
    }

    const referrer =
      await this.prisma.user.findUnique({
        where: {
          referralCode: normalized,
        },
        select: {
          id: true,
          fullName: true,
          role: true,
          isActive: true,
          referralCode: true,
        },
      });

    if (
      !referrer ||
      referrer.role !== 'CUSTOMER' ||
      !referrer.isActive ||
      !referrer.referralCode
    ) {
      throw new NotFoundException(
        'Referral code not found.',
      );
    }

    return {
      valid: true,
      referralCode: normalized,
      referrerName: referrer.fullName,
    };
  }

  /**
   * Permanently attributes a newly-created
   * customer to a referrer.
   *
   * When called with a transaction client,
   * the attribution is created inside the
   * caller's transaction together with
   * customer registration.
   *
   * The referral-program terms are snapshotted
   * at attribution time so later admin
   * configuration changes do not alter
   * this referral.
   */
  async attributeReferral(
    referredUserId: string,
    referralCode?: string,
    db:
      | Prisma.TransactionClient
      | PrismaService = this.prisma,
  ) {
    if (!referralCode) {
      return null;
    }

    const normalized =
      this.normalizeCode(referralCode);

    if (!normalized) {
      return null;
    }

    const referredUser =
      await db.user.findUnique({
        where: {
          id: referredUserId,
        },
        select: {
          id: true,
          role: true,
        },
      });

    if (!referredUser) {
      throw new NotFoundException(
        'Referred customer not found.',
      );
    }

    if (referredUser.role !== 'CUSTOMER') {
      return null;
    }

    const existingAttribution =
      await db.referral.findUnique({
        where: {
          referredUserId,
        },
        select: {
          id: true,
          referralCode: true,
          referrerId: true,
          status: true,
        },
      });

    if (existingAttribution) {
      return existingAttribution;
    }

    const config =
      await db.referralProgramConfig.findFirst({
        where: {
          isActive: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    if (!config) {
      throw new BadRequestException(
        'The referral program is currently unavailable.',
      );
    }

    const referral =
      await db.user.findUnique({
        where: {
          referralCode: normalized,
        },
        select: {
          id: true,
          referralCode: true,
          role: true,
          isActive: true,
        },
      });

    if (
      !referral ||
      referral.role !== 'CUSTOMER' ||
      !referral.isActive ||
      !referral.referralCode
    ) {
      throw new BadRequestException(
        'Invalid referral code.',
      );
    }

    if (referral.id === referredUserId) {
      throw new BadRequestException(
        'You cannot refer yourself.',
      );
    }

    try {
      return await db.referral.create({
        data: {
          referrerId: referral.id,
          referredUserId,
          referralCode:
            referral.referralCode,
          status: ReferralStatus.REGISTERED,
          riskStatus: ReferralRiskStatus.CLEAR,
          registeredAt: new Date(),

          // Snapshot the active program terms
          // permanently for this referral.
          rewardRatePercent:
            config.rewardRatePercent,
          maxRewardAmount:
            config.maxRewardAmount,
          minimumTransactionAmount:
            config.minimumTransactionAmount,
          holdDurationMinutes:
            config.holdDurationMinutes,
        },
        select: {
          id: true,
          referrerId: true,
          referredUserId: true,
          referralCode: true,
          status: true,
          registeredAt: true,
        },
      });
    } catch (error) {
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return db.referral.findUnique({
          where: {
            referredUserId,
          },
          select: {
            id: true,
            referrerId: true,
            referredUserId: true,
            referralCode: true,
            status: true,
            registeredAt: true,
          },
        });
      }

      throw error;
    }
  }

  /**
   * Correction 11:
   *
   * Detects high-confidence referral abuse
   * before a qualifying reward is created.
   *
   * Current rule:
   * - If the referrer owns the vendor that
   *   generated the qualifying order, the
   *   referral is blocked.
   *
   * This is deliberately conservative.
   * Shared addresses, schools, neighborhoods,
   * devices, or family relationships are NOT
   * automatically treated as fraud here because
   * those signals can legitimately overlap.
   */
  private async evaluateReferralRisk(
    tx: Prisma.TransactionClient,
    referral: {
      id: string;
      referrerId: string;
      referredUserId: string;
      riskStatus: ReferralRiskStatus;
    },
    order: {
      id: string;
      vendorId: string;
    },
  ) {
    if (
      referral.riskStatus ===
        ReferralRiskStatus.BLOCKED
    ) {
      return {
        status: ReferralRiskStatus.BLOCKED,
        blocked: true,
      };
    }

    const vendor =
      await tx.vendor.findUnique({
        where: {
          id: order.vendorId,
        },
        select: {
          id: true,
          ownerUserId: true,
        },
      });

    if (
      vendor &&
      vendor.ownerUserId ===
        referral.referrerId
    ) {
      await tx.referralRiskEvent.create({
        data: {
          referralId: referral.id,
          userId: referral.referrerId,
          type: 'REFERRER_OWNS_QUALIFYING_VENDOR',
          riskStatus:
            ReferralRiskStatus.BLOCKED,
          reason:
            'The referrer owns the vendor that processed the qualifying order.',
          metadata: {
            orderId: order.id,
            vendorId: order.vendorId,
            referrerId: referral.referrerId,
            referredUserId:
              referral.referredUserId,
          },
        },
      });

      await tx.referral.update({
        where: {
          id: referral.id,
        },
        data: {
          riskStatus:
            ReferralRiskStatus.BLOCKED,
          status:
            ReferralStatus.FRAUD_DETECTED,
        },
      });

      return {
        status: ReferralRiskStatus.BLOCKED,
        blocked: true,
      };
    }

    return {
      status: ReferralRiskStatus.CLEAR,
      blocked: false,
    };
  }

  /**
   * Processes a delivered order for referral
   * qualification.
   *
   * Rules:
   * - order must be DELIVERED
   * - payment must be SUCCESS
   * - payment must have a paidAt timestamp
   * - payment amount must equal order total
   * - active/processed refunds block qualification
   * - gross merchandise value is used
   * - delivery and service fees are excluded
   * - referral minimum is snapshotted
   * - only one qualifying order is allowed
   * - reward percentage is snapshotted
   * - reward maximum is snapshotted
   * - reward is created as HELD
   * - hold duration is snapshotted
   *
   * This method does NOT add money to the
   * normal Wallet.
   */
  async processDeliveredOrder(
    orderId: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const order =
          await tx.order.findUnique({
            where: {
              id: orderId,
            },
            select: {
              id: true,
              customerId: true,
              vendorId: true,
              status: true,
              grossMerchandiseAmount: true,
              totalAmount: true,
              payments: {
                where: {
                  status: 'SUCCESS',
                },
                orderBy: {
                  paidAt: 'desc',
                },
                take: 1,
                select: {
                  id: true,
                  status: true,
                  paidAt: true,
                  amount: true,
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
                  status: true,
                  amount: true,
                },
              },
            },
          });

        if (!order) {
          return null;
        }

        if (
          order.status !==
          'DELIVERED'
        ) {
          return null;
        }

        const payment =
          order.payments[0];

        if (
          !payment ||
          payment.status !==
            'SUCCESS' ||
          !payment.paidAt
        ) {
          return null;
        }

        if (
          payment.amount !==
          order.totalAmount
        ) {
          return null;
        }

        if (
          order.refunds.length > 0
        ) {
          return null;
        }

        const referral =
          await tx.referral.findUnique({
            where: {
              referredUserId:
                order.customerId,
            },
          });

        if (!referral) {
          return null;
        }

        const terminalOrQualifiedStatuses:
          ReferralStatus[] = [
            ReferralStatus.QUALIFIED,
            ReferralStatus.DELIVERED,
            ReferralStatus.VERIFIED,
            ReferralStatus.REWARDED,
            ReferralStatus.CLOSED,
            ReferralStatus.CANCELLED,
            ReferralStatus.REFUNDED,
            ReferralStatus.REVERSED,
            ReferralStatus.FRAUD_DETECTED,
            ReferralStatus.DISQUALIFIED,
          ];

        if (
          terminalOrQualifiedStatuses.includes(
            referral.status,
          )
        ) {
          return referral;
        }

        if (
          referral.riskStatus ===
            ReferralRiskStatus.BLOCKED
        ) {
          return referral;
        }

        if (
          order.grossMerchandiseAmount <
          referral.minimumTransactionAmount
        ) {
          return null;
        }

        const existingQualifyingOrder =
          await tx.referral.findFirst({
            where: {
              qualifyingOrderId:
                order.id,
            },
            select: {
              id: true,
              referredUserId: true,
            },
          });

        if (
          existingQualifyingOrder &&
          existingQualifyingOrder.id !==
            referral.id
        ) {
          return null;
        }

        /*
         * Correction 11 fraud check.
         *
         * This happens BEFORE the reward is
         * created. A blocked referral therefore
         * can never reach the HELD reward state.
         */
        const risk =
          await this.evaluateReferralRisk(
            tx,
            {
              id: referral.id,
              referrerId:
                referral.referrerId,
              referredUserId:
                referral.referredUserId,
              riskStatus:
                referral.riskStatus,
            },
            {
              id: order.id,
              vendorId:
                order.vendorId,
            },
          );

        if (risk.blocked) {
          return tx.referral.findUnique({
            where: {
              id: referral.id,
            },
          });
        }

        const rewardAmount =
          Math.min(
            Math.floor(
              (order.grossMerchandiseAmount *
                Number(
                  referral.rewardRatePercent,
                )) /
                100,
            ),
            referral.maxRewardAmount,
          );

        if (rewardAmount <= 0) {
          return null;
        }

        /*
         * Atomically claim the referral.
         *
         * If two DELIVERED events arrive
         * concurrently, only one can successfully
         * change the referral from an eligible state.
         */
        const updated =
          await tx.referral.updateMany({
            where: {
              id: referral.id,
              status: {
                in: [
                  ReferralStatus.PENDING,
                  ReferralStatus.REGISTERED,
                  ReferralStatus.FIRST_TRANSACTION,
                ],
              },
              qualifyingOrderId: null,
              riskStatus:
                ReferralRiskStatus.CLEAR,
            },
            data: {
              status:
                ReferralStatus.DELIVERED,
              qualifyingOrderId:
                order.id,
              qualifyingAmount:
                order.grossMerchandiseAmount,
              rewardAmount,
              qualifiedAt: new Date(),
              deliveredAt: new Date(),
            },
          });

        if (updated.count !== 1) {
          return tx.referral.findUnique({
            where: {
              id: referral.id,
            },
            include: {
              reward: true,
            },
          });
        }

        /*
         * Create the one-time referral reward.
         *
         * referralId is UNIQUE in the database,
         * so one referral can never receive
         * multiple reward records.
         *
         * The reward remains HELD for the
         * snapshotted duration.
         */
        const now = new Date();

        const holdUntil =
          new Date(
            now.getTime() +
              referral.holdDurationMinutes *
                60 *
                1000,
          );

        await tx.referralReward.create({
          data: {
            referralId:
              referral.id,
            referrerId:
              referral.referrerId,
            amount: rewardAmount,
            status: 'HELD',
            eligibleAt: now,
            holdUntil,
            reference:
              `REFERRAL-${referral.id}`,
          },
        });

        return tx.referral.findUnique({
          where: {
            id: referral.id,
          },
          include: {
            reward: true,
          },
        });
      },
    );
  }

  async getMyReferralDashboard(
    customerId: string,
  ) {
    const [
      referrals,
      rewards,
      codeInfo,
    ] = await Promise.all([
      this.prisma.referral.findMany({
        where: {
          referrerId: customerId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          referralCode: true,
          status: true,
          qualifyingOrderId: true,
          qualifyingAmount: true,
          rewardAmount: true,
          riskStatus: true,
          attributedAt: true,
          registeredAt: true,
          qualifiedAt: true,
          deliveredAt: true,
          verifiedAt: true,
          rewardedAt: true,
          closedAt: true,
          referredUser: {
            select: {
              id: true,
              fullName: true,
            },
          },
          reward: {
            select: {
              id: true,
              amount: true,
              status: true,
              eligibleAt: true,
              holdUntil: true,
              creditedAt: true,
            },
          },
        },
      }),

      this.prisma.referralReward.findMany({
        where: {
          referrerId: customerId,
          status: {
            in: [
              'HELD',
              'AVAILABLE',
            ],
          },
        },
        select: {
          amount: true,
        },
      }),

      this.getOrCreateReferralCode(
        customerId,
      ),
    ]);

    const successfulStatuses:
      ReferralStatus[] = [
        ReferralStatus.QUALIFIED,
        ReferralStatus.DELIVERED,
        ReferralStatus.VERIFIED,
        ReferralStatus.REWARDED,
        ReferralStatus.CLOSED,
      ];

    const successfulReferrals =
      referrals.filter((referral) =>
        successfulStatuses.includes(
          referral.status,
        ),
      ).length;

    const terminalStatuses:
      ReferralStatus[] = [
        ReferralStatus.REWARDED,
        ReferralStatus.CLOSED,
        ReferralStatus.DISQUALIFIED,
        ReferralStatus.CANCELLED,
        ReferralStatus.REFUNDED,
        ReferralStatus.REVERSED,
        ReferralStatus.FRAUD_DETECTED,
      ];

    const pendingReferrals =
      referrals.filter(
        (referral) =>
          !terminalStatuses.includes(
            referral.status,
          ),
      ).length;

    const totalEarned =
      referrals.reduce(
        (sum, referral) =>
          sum +
          (referral.reward?.creditedAt
            ? referral.reward.amount
            : 0),
        0,
      );

    const pendingCredits =
      rewards.reduce(
        (sum, reward) =>
          sum + reward.amount,
        0,
      );

    return {
      referralCode:
        codeInfo.referralCode,
      referralLink:
        codeInfo.referralLink,
      stats: {
        totalReferrals:
          referrals.length,
        successfulReferrals,
        pendingReferrals,
        totalEarned,
        pendingCredits,
      },
      referrals,
    };
  }

  async getActiveProgramConfig() {
    return this.prisma.referralProgramConfig.findFirst(
      {
        where: {
          isActive: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    );
  }
}