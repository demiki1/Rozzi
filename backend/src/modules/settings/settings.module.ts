import { Module } from '@nestjs/common';
import { SettingsAdminService } from './settings.service';
import { SettingsController } from './settings.controller';
import { AuditModule } from '../audit/audit.module';

@Module({ imports: [AuditModule], providers: [SettingsAdminService], controllers: [SettingsController], exports: [SettingsAdminService] })
export class SettingsModule {}
