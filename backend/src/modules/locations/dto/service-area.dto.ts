import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ServiceAreaStatus } from '@prisma/client';

export class CreateServiceAreaDto {
  @IsString()
  locationId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumOrderAmount?: number; // kobo

  @IsOptional()
  @IsString()
  operatingHoursStart?: string;

  @IsOptional()
  @IsString()
  operatingHoursEnd?: string;
}

export class UpdateServiceAreaStatusDto {
  @IsEnum(ServiceAreaStatus)
  status: ServiceAreaStatus;
}

export class UpdateServiceAreaDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumOrderAmount?: number;

  @IsOptional()
  @IsString()
  operatingHoursStart?: string;

  @IsOptional()
  @IsString()
  operatingHoursEnd?: string;
}