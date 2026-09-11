import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min, Matches } from 'class-validator';

export class UpdateCapacityDto {
  @IsOptional() @IsInt() @Min(1) @Max(10000)
  maxOrdersPerHour?: number | null;
}

export class UpdateProductScheduleDto {
  @IsOptional() @IsBoolean() isAvailable?: boolean;
  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) availabilityStartTime?: string | null;
  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) availabilityEndTime?: string | null;
  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(0,{each:true}) @Max(6,{each:true}) availabilityDays?: number[];
}

export class BulkProductUpdateDto {
  @IsArray() @IsString({ each: true }) productIds: string[];
  @IsOptional() @IsInt() @Min(0) priceAmount?: number;
  @IsOptional() @IsInt() @Min(0) discountAmount?: number | null;
  @IsOptional() @IsString() vendorCategoryId?: string | null;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
}

export class BulkStockUpdateDto {
  @IsArray() items: Array<{ productId: string; quantity: number }>;
}

export class BulkAvailabilityDto {
  @IsArray() @IsString({ each: true }) productIds: string[];
  @IsBoolean() isAvailable: boolean;
}

export class BulkCategoryDto {
  @IsArray() @IsString({ each: true }) productIds: string[];
  @IsString() vendorCategoryId: string;
}

export class ImportProductsDto {
  @IsString() csv: string;
}

export class CreateMenuScheduleDto {
  @IsString() name: string;
  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime: string;
  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime: string;
  @IsArray() @IsInt({ each: true }) @Min(0,{each:true}) @Max(6,{each:true}) days: number[];
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) productIds?: string[];
}

export class UpdateMenuScheduleDto extends CreateMenuScheduleDto {}
