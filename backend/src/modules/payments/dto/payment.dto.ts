import { IsString } from 'class-validator';

export class InitializePaymentDto {
  @IsString()
  orderId: string;
}
