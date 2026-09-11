import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateVendorCategoryDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsString()
  availabilityStartTime?: string;

  @IsOptional()
  @IsString()
  availabilityEndTime?: string;
}

export class UpdateVendorCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  availabilityStartTime?: string;

  @IsOptional()
  @IsString()
  availabilityEndTime?: string;
}

export class ReorderVendorCategoriesDto {
  @IsString({ each: true })
  categoryIds: string[];
}
