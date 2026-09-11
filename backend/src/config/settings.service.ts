import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Minimal general-purpose settings reader over the `Setting` table (already
// defined in Phase 1's schema). Full admin CRUD for settings lands with the
// Phase 8 admin dashboard; this is just the read side, introduced now
// because DispatchService (§13) needs configurable values (timeout, max
// distance, max attempts) rather than hard-coded constants.
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getNumber(key: string, fallback: number): Promise<number> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    if (!row) return fallback;
    const value = typeof row.value === 'number' ? row.value : Number(row.value);
    return Number.isFinite(value) ? value : fallback;
  }

  async getBoolean(key: string, fallback: boolean): Promise<boolean> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    if (!row) return fallback;
    return typeof row.value === 'boolean' ? row.value : fallback;
  }

  async set(key: string, value: unknown) {
    return this.prisma.setting.upsert({
      where: { key },
      update: { value: value as any },
      create: { key, value: value as any },
    });
  }
}
