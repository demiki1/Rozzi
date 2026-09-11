import { IsIn, IsInt, IsPositive, IsString } from 'class-validator';

export class PresignDto {
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  contentType: string;

  @IsInt()
  @IsPositive()
  sizeBytes: number;
}
