import {
  BadRequestException,
  ConflictException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaService } from '../../config/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';

import { UpdateReferralProgramConfigDto } from './dto/referral-program-config.dto';

const DEFAULT_CONFIG = {
  rewardRatePercent: 4,
  maxRewardAmount: 50000,
  minimumTransactionAmount: 500000,
  holdDurationMinutes: 10,
};

@Injectable()
export class ReferralsAdminService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async onModuleInit() {
    await this.ensureInitialConfig();
  }

  async getConfig() {
    const configs =
      await this.prisma.referralProgramConfig.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

    if (configs.length === 0) {
      const initial = await this.ensureInitialConfig();

      return {
        current: initial,
        history: [initial],
        audit: [],
      };
    }

    const current =
      configs.find((config) => config.isActive) ??
      configs[0];

    const auditLogs =
      await this.audit.listRecent(
        'ReferralProgramConfig',
      );

    return {
      current,
      history: configs,
      audit: auditLogs,
    };
  }

  async updateConfig(
    dto: UpdateReferralProgramConfigDto,
    actorId: string,
  ) {
    const current =
      await this.prisma.referralProgramConfig.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });

    const next = {
      isActive:
        dto.isActive ??
        current?.isActive ??
        true,

      rewardRatePercent:
        dto.rewardRatePercent ??
        Number(
          current?.rewardRatePercent ??
            DEFAULT_CONFIG.rewardRatePercent,
        ),

      maxRewardAmount:
        dto.maxRewardAmountKobo ??
        current?.maxRewardAmount ??
        DEFAULT_CONFIG.maxRewardAmount,

      minimumTransactionAmount:
        dto.minimumTransactionAmountKobo ??
        current?.minimumTransactionAmount ??
        DEFAULT_CONFIG.minimumTransactionAmount,

      holdDurationMinutes:
        dto.holdDurationMinutes ??
        current?.holdDurationMinutes ??
        DEFAULT_CONFIG.holdDurationMinutes,
    };

    if (
      next.rewardRatePercent < 0 ||
      next.rewardRatePercent > 100
    ) {
      throw new BadRequestException(
        'Reward rate must be between 0% and 100%.',
      );
    }

    if (next.maxRewardAmount < 1) {
      throw new BadRequestException(
        'Maximum reward must be greater than zero.',
      );
    }

    if (next.minimumTransactionAmount < 1) {
      throw new BadRequestException(
        'Minimum transaction amount must be greater than zero.',
      );
    }

    if (next.holdDurationMinutes < 0) {
      throw new BadRequestException(
        'Hold duration cannot be negative.',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        /*
         * Always deactivate the previous active configuration.
         * This applies both when activating a new configuration
         * and when PAUSING the referral programme.
         */
        await tx.referralProgramConfig.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });

        let created;

        try {
          created =
            await tx.referralProgramConfig.create({
              data: {
                isActive: next.isActive,
                rewardRatePercent:
                  next.rewardRatePercent,
                maxRewardAmount:
                  next.maxRewardAmount,
                minimumTransactionAmount:
                  next.minimumTransactionAmount,
                holdDurationMinutes:
                  next.holdDurationMinutes,
              },
            });
        } catch (error) {
          if (
            error instanceof Error &&
            'code' in error &&
            (error as { code?: string }).code ===
              'P2002'
          ) {
            throw new ConflictException(
              'Another referral configuration became active. Please try again.',
            );
          }

          throw error;
        }

        await this.audit.record({
          actorId,
          action:
            'referral.program_config.update',
          entityType:
            'ReferralProgramConfig',
          entityId: created.id,

          before: current
            ? {
                id: current.id,
                isActive: current.isActive,
                rewardRatePercent:
                  Number(
                    current.rewardRatePercent,
                  ),
                maxRewardAmount:
                  current.maxRewardAmount,
                minimumTransactionAmount:
                  current.minimumTransactionAmount,
                holdDurationMinutes:
                  current.holdDurationMinutes,
              }
            : null,

          after: {
            id: created.id,
            isActive: created.isActive,
            rewardRatePercent:
              Number(created.rewardRatePercent),
            maxRewardAmount:
              created.maxRewardAmount,
            minimumTransactionAmount:
              created.minimumTransactionAmount,
            holdDurationMinutes:
              created.holdDurationMinutes,
          },
        });

        return created;
      },
    );
  }

  async ensureInitialConfig() {
    const existing =
      await this.prisma.referralProgramConfig.findFirst({
        orderBy: { createdAt: 'asc' },
      });

    if (existing) {
      return existing;
    }

    return this.prisma.referralProgramConfig.create({
      data: {
        isActive: true,
        rewardRatePercent:
          DEFAULT_CONFIG.rewardRatePercent,
        maxRewardAmount:
          DEFAULT_CONFIG.maxRewardAmount,
        minimumTransactionAmount:
          DEFAULT_CONFIG.minimumTransactionAmount,
        holdDurationMinutes:
          DEFAULT_CONFIG.holdDurationMinutes,
      },
    });
  }
}
