import { IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class RefundOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  amountKobo?: number;
}
