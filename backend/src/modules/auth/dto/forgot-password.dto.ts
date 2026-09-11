import { IsEmail, ValidateIf, IsString } from 'class-validator';
export class ForgotPasswordDto {
  @ValidateIf((o) => !o.phone)
  @IsEmail()
  email?: string;
  @ValidateIf((o) => !o.email)
  @IsString()
  phone?: string;
}
