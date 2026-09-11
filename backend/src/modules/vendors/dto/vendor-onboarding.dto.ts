import { IsEnum, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { VendorDocumentStatus, VendorVerificationStatus } from '@prisma/client';
export class SaveVendorOnboardingDto { @IsOptional() @IsString() @MaxLength(1000) adminNote?: string; }
export class AddVendorDocumentDto { @IsString() @MaxLength(80) docType: string; @IsUrl({ require_protocol: true }) @MaxLength(1000) fileUrl: string; }
export class ReviewVendorVerificationDto { @IsEnum(VendorVerificationStatus) status: VendorVerificationStatus; @IsOptional() @IsString() @MaxLength(1000) reason?: string; @IsOptional() @IsString() @MaxLength(2000) note?: string; }
export class ReviewVendorDocumentDto { @IsEnum(VendorDocumentStatus) status: VendorDocumentStatus; @IsOptional() @IsString() @MaxLength(1000) reason?: string; }
