import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
export class CreateReviewDto {
  @IsOptional() @IsString() orderId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) vendorRating?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) riderRating?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) productRating?: number;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() comment?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) photoUrls?: string[];
}
