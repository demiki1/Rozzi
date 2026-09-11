import { IsArray, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AdjustInventoryDto {
  @IsInt()
  quantityDelta: number;

  @IsString()
  reason: string;
}

export class SetInventoryDto {
  @IsInt()
  @Min(0)
  quantity: number;

  @IsString()
  reason: string;
}

export class UpdateThresholdDto {
  @IsInt()
  @Min(0)
  @Max(100000000)
  lowStockThreshold: number;
}

export class BulkInventoryItemDto {
  @IsString()
  inventoryId: string;

  @IsInt()
  quantityDelta: number;

  @IsString()
  reason: string;
}

export class BulkAdjustInventoryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkInventoryItemDto)
  items: BulkInventoryItemDto[];
}
