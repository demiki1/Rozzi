import { IsBoolean, IsInt, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, Min } from 'class-validator';
export class CreateOutletDto {
 @IsString() name:string; @IsOptional() @IsString() address?:string; @IsOptional() @IsString() phone?:string; @IsOptional() @IsString() email?:string;
 @IsOptional() @IsLatitude() latitude?:string; @IsOptional() @IsLongitude() longitude?:string; @IsOptional() @IsNumber() @Min(0) deliveryRadiusKm?:number;
 @IsOptional() @IsInt() @Min(0) minimumOrderAmount?:number; @IsOptional() @IsInt() @Min(0) averagePreparationTimeMinutes?:number;
 @IsOptional() @IsBoolean() isActive?:boolean; @IsOptional() @IsBoolean() isOpen?:boolean;
 @IsOptional() operatingHoursJson?:Record<string,{open?:string;close?:string;closed?:boolean}>;
}
export class UpdateOutletDto extends CreateOutletDto {}
export class SetOutletStatusDto { @IsBoolean() isActive:boolean; }
export class SetOutletOpenDto { @IsBoolean() isOpen:boolean; }
