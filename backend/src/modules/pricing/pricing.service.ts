import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma, SurgeLevel } from '@prisma/client';

import { PrismaService } from '../../config/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { UpdatePricingConfigDto } from './dto/update-pricing-config.dto';

const DEFAULT_PRICING = {
  serviceFeeRatePercent: 5,
  serviceFeeCapAmount: 100000, // ₦1,000
  baseDeliveryFee: 45000, // ₦450
  perKmDeliveryFee: 10000, // ₦100/km
  deliveryRadiusKm: 8,
  surgeEnabled: true,
  surgeLevel: SurgeLevel.NORMAL,
  surgeSlightlyHighAmount: 10000, // ₦100
  surgeHighAmount: 20000, // ₦200
  surgeVeryHighAmount: 30000, // ₦300
  surgeMaxAmount: 30000, // ₦300
};

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Returns the latest pricing configuration for a service area.
   * This includes paused configurations.
   */
  async getConfig(serviceAreaId: string) {
    const serviceArea = await this.prisma.serviceArea.findUnique({
      where: { id: serviceAreaId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!serviceArea) {
      throw new NotFoundException('Service area not found.');
    }

    let config = await this.prisma.pricingConfig.findFirst({
      where: { serviceAreaId },
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      config = await this.prisma.pricingConfig.create({
        data: {
          serviceAreaId,
          ...DEFAULT_PRICING,
          deliveryRadiusKm: new Prisma.Decimal(
            DEFAULT_PRICING.deliveryRadiusKm,
          ),
        },
      });
    }

    return {
      serviceArea,
      config,
    };
  }

  /**
   * Returns the currently active pricing configuration.
   * Checkout should use this method.
   */
  async getActiveConfig(serviceAreaId: string) {
    const config = await this.prisma.pricingConfig.findFirst({
      where: {
        serviceAreaId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!config) {
      throw new BadRequestException(
        'Pricing is currently unavailable for this service area.',
      );
    }

    return config;
  }

  /**
   * Calculate the service fee from the NET merchandise subtotal.
   */
  calculateServiceFee(
    netMerchandiseSubtotal: number,
    config: {
      serviceFeeRatePercent: Prisma.Decimal | number;
      serviceFeeCapAmount: number;
    },
  ) {
    if (netMerchandiseSubtotal <= 0) {
      return 0;
    }

    const rate = Number(config.serviceFeeRatePercent);

    const calculated = Math.floor(
      (netMerchandiseSubtotal * rate) / 100,
    );

    return Math.min(calculated, config.serviceFeeCapAmount);
  }

  /**
   * Calculate delivery fee using the pricing configuration.
   *
   * A delivery-zone override may be supplied for the base fee.
   * The service-area pricing remains the default.
   */
  calculateDeliveryFee(
    distanceKm: number,
    config: {
      baseDeliveryFee: number;
      perKmDeliveryFee: number;
      deliveryRadiusKm: Prisma.Decimal | number;
    },
    baseDeliveryFeeOverride?: number | null,
    maximumDistanceKm?: number | null,
  ) {
    if (distanceKm < 0) {
      throw new BadRequestException('Invalid delivery distance.');
    }

    const configuredRadius = Number(config.deliveryRadiusKm);

    if (distanceKm > configuredRadius) {
      throw new BadRequestException(
        `Delivery is only available within ${configuredRadius} km.`,
      );
    }

    if (
      maximumDistanceKm != null &&
      distanceKm > maximumDistanceKm
    ) {
      throw new BadRequestException(
        `Delivery is not available beyond ${maximumDistanceKm} km in this delivery zone.`,
      );
    }

    const baseFee =
      baseDeliveryFeeOverride != null
        ? baseDeliveryFeeOverride
        : config.baseDeliveryFee;

    const distanceFee = Math.round(
      distanceKm * config.perKmDeliveryFee,
    );

    return baseFee + distanceFee;
  }

  /**
   * Resolve the configured surge amount.
   */
  calculateSurgeFee(config: {
    surgeEnabled: boolean;
    surgeLevel: SurgeLevel;
    surgeSlightlyHighAmount: number;
    surgeHighAmount: number;
    surgeVeryHighAmount: number;
    surgeMaxAmount: number;
  }) {
    if (!config.surgeEnabled) {
      return 0;
    }

    let amount = 0;

    switch (config.surgeLevel) {
      case SurgeLevel.SLIGHTLY_HIGH:
        amount = config.surgeSlightlyHighAmount;
        break;

      case SurgeLevel.HIGH:
        amount = config.surgeHighAmount;
        break;

      case SurgeLevel.VERY_HIGH:
        amount = config.surgeVeryHighAmount;
        break;

      case SurgeLevel.NORMAL:
      default:
        amount = 0;
        break;
    }

    return Math.min(amount, config.surgeMaxAmount);
  }

  /**
   * Create a new pricing version.
   *
   * Existing pricing versions are never modified.
   * This preserves historical pricing for existing orders.
   */
  async updateConfig(
    serviceAreaId: string,
    dto: UpdatePricingConfigDto,
    actorId: string,
  ) {
    const serviceArea = await this.prisma.serviceArea.findUnique({
      where: { id: serviceAreaId },
    });

    if (!serviceArea) {
      throw new NotFoundException('Service area not found.');
    }

    const current = await this.prisma.pricingConfig.findFirst({
      where: { serviceAreaId },
      orderBy: { createdAt: 'desc' },
    });

    const next = {
      serviceFeeRatePercent:
        dto.serviceFeeRatePercent ??
        Number(
          current?.serviceFeeRatePercent ??
            DEFAULT_PRICING.serviceFeeRatePercent,
        ),

      serviceFeeCapAmount:
        dto.serviceFeeCapAmount ??
        current?.serviceFeeCapAmount ??
        DEFAULT_PRICING.serviceFeeCapAmount,

      baseDeliveryFee:
        dto.baseDeliveryFee ??
        current?.baseDeliveryFee ??
        DEFAULT_PRICING.baseDeliveryFee,

      perKmDeliveryFee:
        dto.perKmDeliveryFee ??
        current?.perKmDeliveryFee ??
        DEFAULT_PRICING.perKmDeliveryFee,

      deliveryRadiusKm:
        dto.deliveryRadiusKm ??
        Number(
          current?.deliveryRadiusKm ??
            DEFAULT_PRICING.deliveryRadiusKm,
        ),

      surgeEnabled:
        dto.surgeEnabled ??
        current?.surgeEnabled ??
        DEFAULT_PRICING.surgeEnabled,

      surgeLevel:
        dto.surgeLevel ??
        current?.surgeLevel ??
        DEFAULT_PRICING.surgeLevel,

      surgeSlightlyHighAmount:
        dto.surgeSlightlyHighAmount ??
        current?.surgeSlightlyHighAmount ??
        DEFAULT_PRICING.surgeSlightlyHighAmount,

      surgeHighAmount:
        dto.surgeHighAmount ??
        current?.surgeHighAmount ??
        DEFAULT_PRICING.surgeHighAmount,

      surgeVeryHighAmount:
        dto.surgeVeryHighAmount ??
        current?.surgeVeryHighAmount ??
        DEFAULT_PRICING.surgeVeryHighAmount,

      surgeMaxAmount:
        dto.surgeMaxAmount ??
        current?.surgeMaxAmount ??
        DEFAULT_PRICING.surgeMaxAmount,

      isActive:
        dto.isActive ??
        current?.isActive ??
        true,
    };

    this.validateConfig(next);

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.pricingConfig.updateMany({
        where: {
          serviceAreaId,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      return tx.pricingConfig.create({
        data: {
          serviceAreaId,
          isActive: next.isActive,
          serviceFeeRatePercent:
            next.serviceFeeRatePercent,
          serviceFeeCapAmount:
            next.serviceFeeCapAmount,
          baseDeliveryFee:
            next.baseDeliveryFee,
          perKmDeliveryFee:
            next.perKmDeliveryFee,
          deliveryRadiusKm:
            new Prisma.Decimal(next.deliveryRadiusKm),
          surgeEnabled:
            next.surgeEnabled,
          surgeLevel:
            next.surgeLevel,
          surgeSlightlyHighAmount:
            next.surgeSlightlyHighAmount,
          surgeHighAmount:
            next.surgeHighAmount,
          surgeVeryHighAmount:
            next.surgeVeryHighAmount,
          surgeMaxAmount:
            next.surgeMaxAmount,
        },
      });
    });

    await this.auditLog.record({
      actorId,
      action: 'PRICING_CONFIG_UPDATED',
      entityType: 'PricingConfig',
      entityId: created.id,
      before: current ?? null,
      after: created,
    });

    return created;
  }

  private validateConfig(config: {
    serviceFeeRatePercent: number;
    serviceFeeCapAmount: number;
    baseDeliveryFee: number;
    perKmDeliveryFee: number;
    deliveryRadiusKm: number;
    surgeEnabled: boolean;
    surgeLevel: SurgeLevel;
    surgeSlightlyHighAmount: number;
    surgeHighAmount: number;
    surgeVeryHighAmount: number;
    surgeMaxAmount: number;
    isActive: boolean;
  }) {
    if (config.serviceFeeRatePercent < 0 ||
        config.serviceFeeRatePercent > 100) {
      throw new BadRequestException(
        'Service fee rate must be between 0% and 100%.',
      );
    }

    if (config.serviceFeeCapAmount < 0) {
      throw new BadRequestException(
        'Service fee cap cannot be negative.',
      );
    }

    if (config.baseDeliveryFee < 0 ||
        config.perKmDeliveryFee < 0) {
      throw new BadRequestException(
        'Delivery fees cannot be negative.',
      );
    }

    if (config.deliveryRadiusKm <= 0) {
      throw new BadRequestException(
        'Delivery radius must be greater than zero.',
      );
    }

    if (
      config.surgeSlightlyHighAmount > config.surgeMaxAmount ||
      config.surgeHighAmount > config.surgeMaxAmount ||
      config.surgeVeryHighAmount > config.surgeMaxAmount
    ) {
      throw new BadRequestException(
        'Every surge level must be less than or equal to the surge maximum.',
      );
    }

    const selectedSurgeAmount = {
      [SurgeLevel.NORMAL]: 0,
      [SurgeLevel.SLIGHTLY_HIGH]:
        config.surgeSlightlyHighAmount,
      [SurgeLevel.HIGH]:
        config.surgeHighAmount,
      [SurgeLevel.VERY_HIGH]:
        config.surgeVeryHighAmount,
    }[config.surgeLevel];

    if (selectedSurgeAmount > config.surgeMaxAmount) {
      throw new BadRequestException(
        'Selected surge level exceeds the surge maximum.',
      );
    }

    if (
      config.surgeSlightlyHighAmount < 0 ||
      config.surgeHighAmount < 0 ||
      config.surgeVeryHighAmount < 0
    ) {
      throw new BadRequestException(
        'Surge amounts cannot be negative.',
      );
    }

    if (config.surgeMaxAmount < 0) {
      throw new BadRequestException(
        'Surge maximum cannot be negative.',
      );
    }

    if (config.surgeMaxAmount > 30000) {
      throw new BadRequestException(
        'Surge maximum cannot exceed ₦300.',
      );
    }
  }
}