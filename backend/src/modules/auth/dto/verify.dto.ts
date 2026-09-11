import { IsEmail, IsString, ValidateIf } from 'class-validator';
export class VerifyDto { @IsString() token: string; }
export class ResendVerificationDto {
  @ValidateIf((o) => !o.phone) @IsEmail() email?: string;
  @ValidateIf((o) => !o.email) @IsString() phone?: string;
}
