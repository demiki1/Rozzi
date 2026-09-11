import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateCommissionConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  defaultRatePercent?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
