import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SettingsService } from './settings.service';

@Global()
@Module({
  providers: [PrismaService, SettingsService],
  exports: [PrismaService, SettingsService],
})
export class PrismaModule {}
