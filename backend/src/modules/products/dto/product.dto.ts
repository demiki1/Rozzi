import { IsArray, IsBoolean, IsInt, IsOptional, IsString, IsIn, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class VariantInput {
  @IsString()
  name: string;

  @IsOptional()
  @IsInt()
  priceOverride?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  initialStock?: number;
}

export class CreateProductDto {
  @IsString()
  categoryId: string;

  @IsOptional()
  @IsString()
  vendorCategoryId?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsInt()
  @Min(0)
  priceAmount: number; // kobo

  @IsOptional()
  @IsInt()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  weightGrams?: number;

  @IsOptional()
  @IsInt()
  preparationTimeMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  initialStock?: number; // ignored if variants provided; each variant carries its own stock

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantInput)
  variants?: VariantInput[];
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  vendorCategoryId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  weightGrams?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  preparationTimeMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

export class AdjustStockDto {
  @IsInt()
  quantityDelta: number; // positive to restock, negative to manually deduct

  @IsOptional()
  @IsString()
  variantId?: string;
}

export class CreateVariantDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceOverride?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  initialStock?: number;
}

export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceOverride?: number | null;
}

export class ReorderVariantsDto {
  @IsArray()
  @IsString({ each: true })
  variantIds: string[];
}

export class ProductQueryDto {
  @IsOptional()
  @IsString()
  serviceAreaId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsIn(['newest','price_asc','price_desc','name_asc','name_desc'])
  sort?: string;
}
