import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpdateReferralProgramConfigDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  rewardRatePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRewardAmountKobo?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minimumTransactionAmountKobo?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  holdDurationMinutes?: number;
}
