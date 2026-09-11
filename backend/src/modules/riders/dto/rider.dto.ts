import { ArrayMinSize, IsArray, IsEnum, IsLatitude, IsLongitude, IsOptional, IsString, MaxLength } from 'class-validator';
import { VehicleType } from '@prisma/client';

export class RegisterRiderDto {
  @IsEnum(VehicleType) vehicleType: VehicleType;
  @IsOptional() @IsString() vehiclePlateNumber?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() profilePhotoUrl?: string;
  @IsOptional() @IsString() emergencyContactName?: string;
  @IsOptional() @IsString() emergencyContactPhone?: string;
  @IsOptional() @IsString() bankAccountName?: string;
  @IsOptional() @IsString() bankAccountNumber?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) serviceAreaIds: string[];
}

export class UpdateRiderProfileDto {
  @IsOptional() @IsEnum(VehicleType) vehicleType?: VehicleType;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() profilePhotoUrl?: string;
  @IsOptional() @IsString() vehiclePlateNumber?: string;
  @IsOptional() @IsString() emergencyContactName?: string;
  @IsOptional() @IsString() emergencyContactPhone?: string;
  @IsOptional() @IsString() bankAccountName?: string;
  @IsOptional() @IsString() bankAccountNumber?: string;
  @IsOptional() @IsString() bankName?: string;
}

export class UploadRiderDocumentDto {
  @IsString() docType: string;
  @IsString() fileUrl: string;
  @IsOptional() expiryDate?: string;
}
export class UpdateRiderLocationDto { @IsLatitude() latitude: number; @IsLongitude() longitude: number; }
export class RejectRiderDto { @IsOptional() @IsString() reason?: string; }
export class RiderIssueDto {
  @IsString() @MaxLength(80) category: string;
  @IsString() @MaxLength(120) subject: string;
  @IsString() @MaxLength(2000) description: string;
  @IsOptional() @IsString() deliveryId?: string;
}
