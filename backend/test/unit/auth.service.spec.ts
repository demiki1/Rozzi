import * as bcrypt from 'bcrypt';
import { AuthService } from '../../src/modules/auth/auth.service';
import {
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';

describe('AuthService security behavior', () => {
  const prisma: any = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const jwt: any = {
    sign: jest
      .fn()
      .mockReturnValueOnce('access')
      .mockReturnValueOnce('refresh'),
    verify: jest.fn(),
  };

  const config: any = {
    get: jest.fn(
      (key: string, fallback?: string) =>
        ({
          JWT_ACCESS_SECRET: 'a',
          JWT_REFRESH_SECRET: 'b',
          JWT_ACCESS_EXPIRES_IN: '15m',
          JWT_REFRESH_EXPIRES_IN: '30d',
        } as any)[key] ?? fallback,
    ),
  };

  const email: any = {
    send: jest.fn(),
  };

  const sms: any = {
    send: jest.fn(),
  };

  const referrals: any = {
    attributeReferral: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('does not register over an existing email or phone', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'existing',
    });

    const service = new AuthService(
      prisma,
      jwt,
      config,
      email,
      sms,
      referrals,
    );

    await expect(
      service.register({
        fullName: 'Test',
        email: 'a@example.com',
        password: 'Password1',
        role: 'CUSTOMER',
      } as any),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('uses the same invalid-credentials response for missing users and bad passwords', async () => {
    const service = new AuthService(
      prisma,
      jwt,
      config,
      email,
      sms,
      referrals,
    );

    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'missing@example.com',
        password: 'Password1',
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      role: 'CUSTOMER',
      isActive: true,
      passwordHash: await bcrypt.hash(
        'Correct1',
        4,
      ),
    });

    await expect(
      service.login({
        email: 'u1@example.com',
        password: 'Wrong1',
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});