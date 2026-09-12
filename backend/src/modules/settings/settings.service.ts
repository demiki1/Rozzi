import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
    const aliases: Record<string, string> = { 'dispatch.assignmentTimeoutSeconds': 'dispatchAssignmentTimeoutSeconds', 'dispatch.maxRiderDistanceKm': 'dispatchMaxRiderDistanceKm', 'dispatch.maxAssignmentAttempts': 'dispatchMaxAssignmentAttempts' };
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
    await this.prisma.$transaction(async (tx) => {
      for (const [rawKey, value] of Object.entries(dto)) {
        if (value === undefined) continue;
        const key = ({ dispatchAssignmentTimeoutSeconds: 'dispatch.assignmentTimeoutSeconds', dispatchMaxRiderDistanceKm: 'dispatch.maxRiderDistanceKm', dispatchMaxAssignmentAttempts: 'dispatch.maxAssignmentAttempts' } as Record<string,string>)[rawKey] ?? rawKey;
        const row = await tx.setting.findUnique({ where: { key } });
        const before = row?.value ?? DEFAULTS[key];
        await tx.setting.upsert({ where: { key }, update: { value: value as any }, create: { key, value: value as any } });
        changed[key] = { before, after: value };
      }

      if (dto.defaultCommissionRate !== undefined) {
        await tx.commissionConfig.updateMany({ where: { isActive: true }, data: { isActive: false } });
        await tx.commissionConfig.create({ data: { defaultRatePercent: dto.defaultCommissionRate, isActive: true } });
      }
    });

    if (Object.keys(changed).length) await this.audit.record({ actorId, action: 'settings.update', entityType: 'Setting', before: changed, after: changed });
    return this.list();
  }

  async upsert(dto: UpsertSettingDto, actorId: string) {
    if (dto.key === 'defaultCommissionRate') {
      const rate = Number(dto.value);
      if (!Number.isInteger(rate) || rate < 1 || rate > 100) throw new BadRequestException('Default commission rate must be between 1% and 100%.');
    }
    const before = await this.get(dto.key).catch(() => ({ key: dto.key, value: undefined }));
    const row = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.setting.upsert({ where: { key: dto.key }, update: { value: dto.value as any }, create: { key: dto.key, value: dto.value as any } });
      if (dto.key === 'defaultCommissionRate') {
        await tx.commissionConfig.updateMany({ where: { isActive: true }, data: { isActive: false } });
        await tx.commissionConfig.create({ data: { defaultRatePercent: Number(dto.value), isActive: true } });
      }
      return saved;
    });
    await this.audit.record({ actorId, action: 'setting.upsert', entityType: 'Setting', entityId: dto.key, before, after: row });
    return row;
  }
}
