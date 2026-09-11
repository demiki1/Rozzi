import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpsertSettingDto {
  @IsString()
  key!: string;

  value!: unknown;
}

export class UpdateSettingsDto {
  @IsOptional() @IsString() marketplaceName?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsInt() @Min(0) defaultServiceFeeAmount?: number;
  @IsOptional() @IsInt() @Min(0) defaultDeliveryFeeAmount?: number;
  @IsOptional() @IsInt() @Min(0) minimumOrderAmount?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) defaultCommissionRate?: number;
  @IsOptional() @IsBoolean() ordersEnabled?: boolean;
  @IsOptional() @IsBoolean() customerRegistrationEnabled?: boolean;
  @IsOptional() @IsBoolean() vendorRegistrationEnabled?: boolean;
  @IsOptional() @IsBoolean() riderRegistrationEnabled?: boolean;
  @IsOptional() @IsInt() @Min(1) dispatchAssignmentTimeoutSeconds?: number;
  @IsOptional() @IsInt() @Min(1) dispatchMaxRiderDistanceKm?: number;
  @IsOptional() @IsInt() @Min(1) dispatchMaxAssignmentAttempts?: number;
}
