import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CartOptionSelectionDto {
  @IsString() groupId: string;
  @IsArray() @IsString({ each: true }) optionItemIds: string[];
}
export class AddCartItemDto {
  @IsString() productId: string;
  @IsOptional() @IsString() variantId?: string;
  @IsInt() @Min(1) quantity: number;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CartOptionSelectionDto)
  optionSelections?: CartOptionSelectionDto[];
}
export class UpdateCartItemDto {
  @IsInt() @Min(1) quantity: number;
}
