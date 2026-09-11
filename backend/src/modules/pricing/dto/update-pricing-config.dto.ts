import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { SurgeLevel } from '@prisma/client';

export class UpdatePricingConfigDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  serviceFeeRatePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  serviceFeeCapAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  baseDeliveryFee?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  perKmDeliveryFee?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  deliveryRadiusKm?: number;

  @IsOptional()
  @IsBoolean()
  surgeEnabled?: boolean;

  @IsOptional()
  @IsEnum(SurgeLevel)
  surgeLevel?: SurgeLevel;

  @IsOptional()
  @IsInt()
  @Min(0)
  surgeSlightlyHighAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  surgeHighAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  surgeVeryHighAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  surgeMaxAmount?: number;
}