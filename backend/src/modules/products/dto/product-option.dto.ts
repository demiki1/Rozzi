import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateOptionGroupDto {
  @IsString() name: string;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(50) minSelections?: number;
  @IsOptional() @IsInt() @Min(1) @Max(50) maxSelections?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() availabilityStartTime?: string | null;
  @IsOptional() @IsString() availabilityEndTime?: string | null;
}

export class UpdateOptionGroupDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(50) minSelections?: number;
  @IsOptional() @IsInt() @Min(1) @Max(50) maxSelections?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() availabilityStartTime?: string | null;
  @IsOptional() @IsString() availabilityEndTime?: string | null;
}

export class ReorderOptionGroupsDto {
  @IsString({ each: true }) groupIds: string[];
}

export class CreateOptionItemDto {
  @IsString() name: string;
  @IsOptional() @IsInt() @Min(0) additionalPrice?: number;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
  @IsOptional() @IsInt() @Min(0) stockQuantity?: number | null;
  @IsOptional() @IsInt() @Min(0) lowStockThreshold?: number | null;
}

export class UpdateOptionItemDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() @Min(0) additionalPrice?: number;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
  @IsOptional() @IsInt() @Min(0) stockQuantity?: number | null;
  @IsOptional() @IsInt() @Min(0) lowStockThreshold?: number | null;
}

export class ReorderOptionItemsDto {
  @IsString({ each: true }) itemIds: string[];
}
