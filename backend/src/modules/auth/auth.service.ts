import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../config/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  EmailProvider,
  SmsProvider,
  EMAIL_PROVIDER,
  SMS_PROVIDER,
} from '../notifications/interfaces/notification-provider.interface';
import {
  Prisma,
  VerificationTokenType,
  UserRole,
} from '@prisma/client';
import { Response } from 'express';
import { ReferralsService } from '../referrals/referrals.service';

const BCRYPT_ROUNDS = 12;
const TOKEN_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(EMAIL_PROVIDER)
    private readonly email: EmailProvider,
    @Inject(SMS_PROVIDER)
    private readonly sms: SmsProvider,
    private readonly referrals: ReferralsService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : undefined,
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as any,
      },
    });

    if (existing) {
      throw new ConflictException(
        'An account with this email or phone already exists.',
      );
    }

    const passwordHash = await bcrypt.hash(
      dto.password,
      BCRYPT_ROUNDS,
    );

    const user = await this.prisma.$transaction(async (tx) => {
      let createdUser;

      try {
        createdUser = await tx.user.create({
          data: {
            fullName: dto.fullName,
            email: dto.email,
            phone: dto.phone,
            passwordHash,
            role: dto.role,
          },
        });
      } catch (error) {
        // The pre-check above is not sufficient against two
        // simultaneous registration requests. The database UNIQUE
        // constraint remains the final authority.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            'An account with this email or phone already exists.',
          );
        }

        throw error;
      }

      // Referral attribution must happen in the same database
      // transaction as customer creation.
      //
      // Only CUSTOMER registrations can participate in the
      // customer referral program.
      if (
        dto.role === UserRole.CUSTOMER &&
        dto.referralCode
      ) {
        await this.referrals.attributeReferral(
          createdUser.id,
          dto.referralCode,
          tx,
        );
      }

      return createdUser;
    });

    await this.issueVerification(user.id);

    return this.issueTokens(user.id, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : undefined,
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as any,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Incorrect email or password.',
      );
    }

    if (
      !(await bcrypt.compare(
        dto.password,
        user.passwordHash,
      ))
    ) {
      throw new UnauthorizedException(
        'Incorrect email or password.',
      );
    }

    const requireVerification =
      this.config.get<string>(
        'REQUIRE_ACCOUNT_VERIFICATION',
        'false',
      ) === 'true';

    if (
      requireVerification &&
      user.email &&
      !user.isEmailVerified &&
      user.phone &&
      !user.isPhoneVerified
    ) {
      throw new UnauthorizedException(
        'Account verification required.',
      );
    }

    return this.issueTokens(user.id, user.role);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : undefined,
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as any,
      },
    });

    // Always return the same response to prevent account enumeration.
    if (!user || !user.isActive) {
      return {
        message:
          'If an account matches, a reset message will be sent.',
      };
    }

    await this.prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
    });

    const raw = randomBytes(32).toString('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(
          Date.now() + TOKEN_TTL_MS,
        ),
      },
    });

    const resetUrl = `${this.config.get<string>(
      'CUSTOMER_APP_URL',
      'http://localhost:3002',
    )}/reset-password?token=${encodeURIComponent(raw)}`;

    if (user.email) {
      await this.email.send(
        user.email,
        'Reset your Rozzi password',
        `Reset your password using this link: ${resetUrl}`,
      );
    }

    if (user.phone) {
      await this.sms.send(
        user.phone,
        `Rozzi password reset link: ${resetUrl}`,
      );
    }

    return {
      message:
        'If an account matches, a reset message will be sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const row =
      await this.prisma.passwordResetToken.findFirst({
        where: {
          tokenHash: this.hashToken(dto.token),
          usedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

    if (!row) {
      throw new BadRequestException(
        'Invalid or expired reset token.',
      );
    }

    const passwordHash = await bcrypt.hash(
      dto.password,
      BCRYPT_ROUNDS,
    );

    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          id: row.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      if (consumed.count !== 1) {
        throw new BadRequestException('Invalid or expired reset token.');
      }

      await tx.user.update({
        where: { id: row.userId },
        data: { passwordHash },
      });

      await tx.refreshToken.updateMany({
        where: { userId: row.userId, revoked: false },
        data: { revoked: true },
      });
    });

    return {
      success: true,
    };
  }

  async verifyEmail(dto: { token: string }) {
    return this.consumeVerification(
      dto.token,
      VerificationTokenType.EMAIL_VERIFICATION,
    );
  }

  async verifyPhone(dto: { token: string }) {
    return this.consumeVerification(
      dto.token,
      VerificationTokenType.PHONE_VERIFICATION,
    );
  }

  async resendVerification(dto: {
    email?: string;
    phone?: string;
  }) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : undefined,
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as any,
      },
    });

    if (user) {
      await this.issueVerification(user.id);
    }

    return {
      message:
        'If an account matches, a verification message will be sent.',
    };
  }

  private async issueVerification(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return;
    }

    if (user.email && !user.isEmailVerified) {
      await this.sendVerification(
        user.id,
        VerificationTokenType.EMAIL_VERIFICATION,
        user.email,
      );
    }

    if (user.phone && !user.isPhoneVerified) {
      await this.sendVerification(
        user.id,
        VerificationTokenType.PHONE_VERIFICATION,
        user.phone,
      );
    }
  }

  private async sendVerification(
    userId: string,
    type: VerificationTokenType,
    destination: string,
  ) {
    await this.prisma.verificationToken.deleteMany({
      where: {
        userId,
        type,
        usedAt: null,
      },
    });

    const raw = randomBytes(32).toString('hex');

    await this.prisma.verificationToken.create({
      data: {
        userId,
        type,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(
          Date.now() + TOKEN_TTL_MS,
        ),
      },
    });

    if (
      type ===
      VerificationTokenType.EMAIL_VERIFICATION
    ) {
      const url = `${this.config.get<string>(
        'CUSTOMER_APP_URL',
        'http://localhost:3002',
      )}/verify-email?token=${encodeURIComponent(raw)}`;

      await this.email.send(
        destination,
        'Verify your Rozzi account',
        `Verify your account: ${url}`,
      );
    } else {
      await this.sms.send(
        destination,
        `Rozzi verification token: ${raw}`,
      );
    }
  }

  private async consumeVerification(
    raw: string,
    type: VerificationTokenType,
  ) {
    const row =
      await this.prisma.verificationToken.findFirst({
        where: {
          tokenHash: this.hashToken(raw),
          type,
          usedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

    if (!row) {
      throw new BadRequestException(
        'Invalid or expired verification token.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.verificationToken.updateMany({
        where: {
          id: row.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      if (consumed.count !== 1) {
        throw new BadRequestException('Invalid or expired verification token.');
      }

      await tx.user.update({
        where: { id: row.userId },
        data:
          type === VerificationTokenType.EMAIL_VERIFICATION
            ? { isEmailVerified: true }
            : { isPhoneVerified: true },
      });
    });

    return {
      success: true,
    };
  }

  refreshCookieName() {
    return this.config.get<string>(
      'AUTH_REFRESH_COOKIE_NAME',
      'rozzi_admin_refresh',
    );
  }

  setRefreshCookie(
    res: Response,
    refreshToken: string,
  ) {
    const secure =
      this.config.get<string>(
        'AUTH_COOKIE_SECURE',
        this.config.get<string>('NODE_ENV') ===
          'production'
          ? 'true'
          : 'false',
      ) === 'true';

    const sameSite = (
      this.config.get<string>(
        'AUTH_COOKIE_SAMESITE',
        'lax',
      ) || 'lax'
    ) as 'lax' | 'strict' | 'none';

    const maxAge =
      (parseInt(
        (
          this.config.get<string>(
            'JWT_REFRESH_EXPIRES_IN',
            '30d',
          ) || '30d'
        ).replace(/\D/g, ''),
        10,
      ) || 30) *
      86400000;

    res.cookie(
      this.refreshCookieName(),
      refreshToken,
      {
        httpOnly: true,
        secure,
        sameSite,
        maxAge,
        path: '/api/auth',
      },
    );
  }

  readRefreshCookie(cookieHeader?: string) {
    if (!cookieHeader) {
      return undefined;
    }

    const prefix = `${this.refreshCookieName()}=`;

    const pair = cookieHeader
      .split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith(prefix));

    return pair
      ? decodeURIComponent(
          pair.slice(prefix.length),
        )
      : undefined;
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };

    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>(
          'JWT_REFRESH_SECRET',
        ),
      });
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired refresh token.',
      );
    }

    const stored =
      await this.prisma.refreshToken.findFirst({
        where: {
          userId: payload.sub,
          tokenHash: this.hashToken(refreshToken),
          revoked: false,
        },
      });

    if (
      !stored ||
      stored.expiresAt < new Date()
    ) {
      throw new UnauthorizedException(
        'Refresh token not recognized.',
      );
    }

    // Rotate atomically: two concurrent requests presenting
    // the same refresh token must not both succeed.
    const rotated =
      await this.prisma.refreshToken.updateMany({
        where: {
          id: stored.id,
          revoked: false,
        },
        data: {
          revoked: true,
        },
      });

    if (rotated.count !== 1) {
      throw new UnauthorizedException(
        'Refresh token already used or revoked.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Account is inactive.',
      );
    }

    return this.issueTokens(
      user.id,
      user.role,
    );
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revoked: false,
      },
      data: {
        revoked: true,
      },
    });

    return {
      success: true,
    };
  }

  private async issueTokens(
    userId: string,
    role: string,
  ) {
    const accessToken = this.jwt.sign(
      {
        sub: userId,
        role,
      },
      {
        secret: this.config.get<string>(
          'JWT_ACCESS_SECRET',
        ),
        expiresIn:
          this.config.get<string>(
            'JWT_ACCESS_EXPIRES_IN',
            '15m',
          ),
      },
    );

    const refreshToken = this.jwt.sign(
      {
        sub: userId,
        jti: uuidv4(),
      },
      {
        secret: this.config.get<string>(
          'JWT_REFRESH_SECRET',
        ),
        expiresIn:
          this.config.get<string>(
            'JWT_REFRESH_EXPIRES_IN',
            '30d',
          ),
      },
    );

    const days =
      parseInt(
        (
          this.config.get<string>(
            'JWT_REFRESH_EXPIRES_IN',
            '30d',
          ) || '30d'
        ).replace(/\D/g, ''),
        10,
      ) || 30;

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(
          Date.now() +
            days * 86400000,
        ),
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private hashToken(token: string) {
    return createHash('sha256')
      .update(token)
      .digest('hex');
  }
}