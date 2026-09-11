import { IsOptional, IsISO8601 } from 'class-validator';

export class DateRangeQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
