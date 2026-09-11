import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../config/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', service: 'rozzi-api', database: 'ok' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'degraded',
        service: 'rozzi-api',
        database: 'unavailable',
      });
    }
  }
}
