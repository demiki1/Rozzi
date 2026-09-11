import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { UserRole } from '@prisma/client';

// Registration only ever creates CUSTOMER, VENDOR, or RIDER accounts here.
// ADMIN accounts are provisioned separately (seed script / super-admin
// invite) — never through this public endpoint.
export class RegisterDto {
  @IsString()
  fullName: string;

  @ValidateIf((o) => !o.phone)
  @IsEmail()
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsString()
  phone?: string;

  // Optional referral code supplied when a new customer registers
  // through a referral link.
  @IsOptional()
  @IsString()
  @MaxLength(64)
  referralCode?: string;

  // §37: baseline complexity on top of length — not maximally strict (no
  // symbol requirement), since overly aggressive rules mostly push people
  // toward predictable substitutions ("Password1!") without much real
  // security gain. Length + a letter + a number is a reasonable MVP floor.
  @IsString()
  @MinLength(8)
  @MaxLength(72, {
    message: 'Password must not exceed 72 characters.',
  })
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message:
      'Password must contain at least one letter and one number.',
  })
  password: string;

  @IsEnum([UserRole.CUSTOMER, UserRole.VENDOR, UserRole.RIDER])
  role: UserRole;
}