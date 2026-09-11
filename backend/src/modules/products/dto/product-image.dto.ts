import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ProductImageInput {
  @IsString()
  url: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class AddProductImagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageInput)
  images: ProductImageInput[];
}