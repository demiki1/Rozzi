import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { UpdateSettingsDto, UpsertSettingDto } from './dto/settings.dto';

const DEFAULTS: Record<string, unknown> = {
  marketplaceName: 'Rozzi',
  currency: 'NGN',
  defaultServiceFeeAmount: 0,
  defaultDeliveryFeeAmount: 0,
  minimumOrderAmount: 0,
  defaultCommissionRate: 10,
  ordersEnabled: true,
  customerRegistrationEnabled: true,
  vendorRegistrationEnabled: true,
  riderRegistrationEnabled: true,
  scheduledOrdersEnabled: false,
  dispatchAssignmentTimeoutSeconds: 60,
  dispatchMaxRiderDistanceKm: 8,
  dispatchMaxAssignmentAttempts: 5,
};

@Injectable()
export class SettingsAdminService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogService) {}

  async list() {
    const rows = await this.prisma.setting.findMany({ orderBy: { key: 'asc' } });
    const values: Record<string, unknown> = { ...DEFAULTS };
    const aliases: Record<string, string> = {
      'dispatch.assignmentTimeoutSeconds': 'dispatchAssignmentTimeoutSeconds',
      'dispatch.maxRiderDistanceKm': 'dispatchMaxRiderDistanceKm',
      'dispatch.maxAssignmentAttempts': 'dispatchMaxAssignmentAttempts',
    };
    for (const row of rows) values[aliases[row.key] ?? row.key] = row.value;
    return Object.entries(values).map(([key, value]) => ({ key, value }));
  }

  async get(key: string) {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    if (!row && !(key in DEFAULTS)) throw new NotFoundException('Setting not found.');
    return { key, value: row?.value ?? DEFAULTS[key] };
  }

  async updateMany(dto: UpdateSettingsDto, actorId: string) {
    const changed: Record<string, { before: unknown; after: unknown }> = {};
    for (const [rawKey, value] of Object.entries(dto)) {
      if (value === undefined) continue;
      const key = ({ dispatchAssignmentTimeoutSeconds: 'dispatch.assignmentTimeoutSeconds', dispatchMaxRiderDistanceKm: 'dispatch.maxRiderDistanceKm', dispatchMaxAssignmentAttempts: 'dispatch.maxAssignmentAttempts' } as Record<string,string>)[rawKey] ?? rawKey;
      const before = await this.get(key);
      await this.prisma.setting.upsert({
        where: { key },
        update: { value: value as any },
        create: { key, value: value as any },
      });
      changed[key] = { before: before.value, after: value };
    }
    if (Object.keys(changed).length) {
      await this.audit.record({ actorId, action: 'settings.update', entityType: 'Setting', before: changed, after: changed });
    }
    return this.list();
  }

  async upsert(dto: UpsertSettingDto, actorId: string) {
    const before = await this.get(dto.key).catch(() => ({ key: dto.key, value: undefined }));
    const row = await this.prisma.setting.upsert({ where: { key: dto.key }, update: { value: dto.value as any }, create: { key: dto.key, value: dto.value as any } });
    await this.audit.record({ actorId, action: 'setting.upsert', entityType: 'Setting', entityId: dto.key, before, after: row });
    return row;
  }
}
