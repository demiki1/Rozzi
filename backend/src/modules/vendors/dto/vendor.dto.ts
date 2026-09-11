import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DeliveryModel } from '@prisma/client';

export class RegisterVendorDto {
  @IsString()
  vendorTypeId: string;

  @IsString()
  storeName: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  // Vendor must be attached to at least one service area at registration —
  // "serve nothing until placed somewhere" would otherwise leak an
  // unscoped vendor into search results (see LocationsService notes).
  @IsString()
  serviceAreaId: string;

  @IsOptional()
  @IsString()
  address?: string;
}

export class UpdateVendorProfileDto {
  @IsOptional()
  @IsString()
  storeName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  coverImageUrl?: string | null;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  operatingHoursStart?: string;

  @IsOptional()
  @IsString()
  operatingHoursEnd?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(DeliveryModel, { each: true })
  supportedDeliveryModels?: DeliveryModel[];

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryRadiusKm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumOrderAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  averagePreparationTimeMinutes?: number;

  @IsOptional()
  @IsBoolean()
  holidayMode?: boolean;

  @IsOptional()
  @IsBoolean()
  busyMode?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  busyPreparationTimeMinutes?: number;

  @IsOptional()
  operatingHoursJson?: Record<string, { open?: string; close?: string; closed?: boolean }> ;
}

export class SetVendorOpenStatusDto {
  @IsBoolean()
  isOpen: boolean;
}

export class RejectVendorDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
