import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterReferralDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  referralCode?: string;
}
