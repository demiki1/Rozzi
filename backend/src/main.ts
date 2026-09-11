import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const logger = new Logger('Bootstrap');

  app.use(helmet());

  // SECURITY (Phase 11 pass): was `origin: true`, which reflects whatever
  // Origin header the request sends and allows it — combined with
  // `credentials: true`, that means any website can make authenticated
  // requests on a logged-in user's behalf. CORS_ORIGIN should be a
  // comma-separated allowlist in any real deployment (e.g.
  // "https://app.example.com,https://admin.example.com"). Falling back to
  // reflecting all origins ONLY when unset, with a loud warning — so local
  // development isn't broken by this fix, but nobody ships that silently.
  const corsOriginEnv = process.env.CORS_ORIGIN?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && !corsOriginEnv) {
    throw new Error(
      'CORS_ORIGIN is required in production. Set it to a comma-separated allowlist of trusted frontend origins.',
    );
  }

  const requiredSecrets = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const;
  for (const name of requiredSecrets) {
    const value = process.env[name]?.trim();
    if (isProduction && (!value || value.length < 32 || value.startsWith('change_me'))) {
      throw new Error(`${name} must be a strong, non-default secret of at least 32 characters in production.`);
    }
  }

  // Keep local development secure by default too: when CORS_ORIGIN is omitted,
  // allow only the four ROZZI local frontends rather than reflecting arbitrary
  // origins. Production still requires an explicit allowlist above.
  const defaultLocalOrigins = [
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
  ];
  const corsOrigins = corsOriginEnv
    ? corsOriginEnv.split(',').map((origin: string) => origin.trim()).filter(Boolean)
    : defaultLocalOrigins;

  if (!corsOriginEnv) {
    logger.warn(
      `CORS_ORIGIN is not set — development mode is restricted to local ROZZI origins: ${defaultLocalOrigins.join(', ')}. Set CORS_ORIGIN before staging/production.`,
    );
  }

  app.enableCors({ origin: corsOrigins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties not in the DTO
      forbidNonWhitelisted: true, // reject unexpected fields instead of silently dropping
      transform: true,
    }),
  );

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`Backend listening on port ${port}`);
}

bootstrap();
