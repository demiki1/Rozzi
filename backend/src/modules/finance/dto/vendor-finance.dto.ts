import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

export class UpsertVendorPaymentAccountDto {
  @IsString() @Length(2, 100) bankName!: string;
  @IsOptional() @IsString() @Length(2, 20) bankCode?: string;
  @IsString() @Length(2, 120) accountName!: string;
  @IsString() @Matches(/^\d{10}$/, { message: 'Account number must be 10 digits.' }) accountNumber!: string;
  @IsOptional() @IsString() @Length(2, 100) providerAccountId?: string;
  @IsOptional() @IsIn(['BANK_TRANSFER']) payoutMethod?: string;
}

export class VendorFinanceRangeDto {
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}

export class VendorFinanceTransactionDto extends VendorFinanceRangeDto {
  @IsOptional() @IsString() type?: string;
}

export class VendorPayoutRequestDto {
  @IsOptional() @IsInt() @Min(1) amount?: number;
}
