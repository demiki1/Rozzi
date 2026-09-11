import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { DeliveryModel, OrderDeliveryType } from '@prisma/client';

export class CheckoutDto {
  @IsString()
  serviceAreaId: string;

  @IsEnum(OrderDeliveryType)
  deliveryType: OrderDeliveryType;

  // For DELIVERY orders: PLATFORM_DELIVERY or SELF_DELIVERY.
  // CUSTOMER_PICKUP is selected automatically for PICKUP orders.
  @IsOptional()
  @IsEnum(DeliveryModel)
  deliveryModel?: DeliveryModel;

  // Required when deliveryType is DELIVERY; validated in the service
  // rather than at the DTO level since the requirement is conditional.
  @IsOptional()
  @IsString()
  addressId?: string;

  @IsOptional()
  @IsString()
  deliveryZoneId?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  promotionCode?: string;

  // Scheduled orders are disabled by default and only accepted when the admin
  // setting `scheduledOrdersEnabled` is true.
  @IsOptional()
  @IsISO8601()
  scheduledFor?: string;
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateAddressDto {
  @IsString()
  label: string;

  @IsString()
  addressText: string;

  @IsOptional()
  @IsString()
  landmark?: string;

  @IsOptional()
  @IsString()
  instructions?: string;
}

