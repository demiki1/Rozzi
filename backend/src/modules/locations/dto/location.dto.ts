import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LocationType } from '@prisma/client';

export class CreateLocationDto {
  @IsEnum(LocationType)
  type: LocationType;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}

export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  isActive?: boolean;
}
