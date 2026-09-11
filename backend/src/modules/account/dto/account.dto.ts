import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @Length(2, 80)
  fullName!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s\-()]{7,20}$/)
  phone?: string;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  marketingNotificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  orderNotificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  promotionalNotificationsEnabled?: boolean;
}

export class CreateAddressDto {
  @IsString()
  @Length(2, 40)
  label!: string;

  @IsString()
  @Length(5, 240)
  addressText!: string;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  landmark?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  instructions?: string;

  @IsOptional()
  latitude?: number;

  @IsOptional()
  longitude?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto extends CreateAddressDto {}
