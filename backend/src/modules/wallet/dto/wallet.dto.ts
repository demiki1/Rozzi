import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class TopUpDto {
  @IsInt()
  @Min(10000)
  @Max(500000000)
  amount!: number;
}

export class WithdrawDto {
  @IsInt()
  @Min(10000)
  amount!: number;

  @IsString()
  bankName!: string;

  @IsString()
  accountName!: string;

  @IsString()
  accountNumber!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ApplyPromotionDto {
  @IsString()
  code!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  subtotalAmount?: number;

  @IsOptional()
  @IsString()
  vendorId?: string;
}
