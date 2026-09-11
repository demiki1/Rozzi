import { IsOptional, IsString, Length } from 'class-validator';

export class ConfirmDeliveryDto {
  @IsString()
  @Length(4, 8)
  code: string;
}

export class DeclineOfferDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
