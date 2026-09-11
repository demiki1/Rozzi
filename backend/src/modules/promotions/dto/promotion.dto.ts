import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PromotionType } from '@prisma/client';
export class CreatePromotionDto {
 @IsString() @MaxLength(40) code:string;
 @IsString() @MaxLength(120) name:string;
 @IsEnum(PromotionType) type:PromotionType;
 @IsInt() @Min(1) value:number;
 @IsOptional() @IsInt() @Min(0) minOrderAmount?:number;
 @IsOptional() @IsInt() @Min(0) maxDiscount?:number;
 @IsOptional() @IsInt() @Min(1) usageLimit?:number;
 @IsOptional() @IsInt() @Min(1) perCustomerLimit?:number;
 @IsString() startsAt:string;
 @IsString() endsAt:string;
}
export class UpdatePromotionDto {
 @IsOptional() @IsString() @MaxLength(120) name?:string;
 @IsOptional() @IsBoolean() isActive?:boolean;
 @IsOptional() @IsInt() @Min(1) value?:number;
 @IsOptional() @IsInt() @Min(0) minOrderAmount?:number;
 @IsOptional() @IsInt() @Min(0) maxDiscount?:number;
 @IsOptional() @IsInt() @Min(1) usageLimit?:number;
 @IsOptional() @IsInt() @Min(1) perCustomerLimit?:number;
 @IsOptional() @IsString() endsAt?:string;
}
export class ApplyPromotionDto { @IsString() code:string; }
