import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class VendorReviewQueryDto {
  @IsOptional() @Transform(({ value }) => value === undefined || value === '' ? undefined : Number(value)) @IsInt() @Min(1) @Max(5) rating?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value) @IsBoolean() responded?: boolean;
  @IsOptional() @Transform(({ value }) => value === undefined || value === '' ? undefined : Number(value)) @IsInt() @Min(1) page?: number;
  @IsOptional() @Transform(({ value }) => value === undefined || value === '' ? undefined : Number(value)) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}

export class VendorReviewResponseDto {
  @IsString() @MaxLength(1000) response!: string;
}
