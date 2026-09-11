import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // Public listing only ever shows active categories, ordered the way
  // admin configured (§25) — customers never see a raw DB order.
  async listActive() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async listAll() {
    return this.prisma.category.findMany({ orderBy: { displayOrder: 'asc' } });
  }

  async create(dto: CreateCategoryDto, actorId: string) {
    const created = await this.prisma.category.create({ data: dto });
    await this.auditLog.record({
      actorId,
      action: 'category.create',
      entityType: 'Category',
      entityId: created.id,
      after: created,
    });
    return created;
  }

  async update(id: string, dto: UpdateCategoryDto, actorId: string) {
    const before = await this.getOrThrow(id);
    const updated = await this.prisma.category.update({ where: { id }, data: dto });
    await this.auditLog.record({
      actorId,
      action: 'category.update',
      entityType: 'Category',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async deactivate(id: string, actorId: string) {
    const before = await this.getOrThrow(id);
    const updated = await this.prisma.category.update({ where: { id }, data: { isActive: false } });
    await this.auditLog.record({
      actorId,
      action: 'category.deactivate',
      entityType: 'Category',
      entityId: id,
      before: { isActive: before.isActive },
      after: { isActive: updated.isActive },
    });
    return updated;
  }

  private async getOrThrow(id: string) {
    const cat = await this.prisma.category.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found.');
    return cat;
  }
}
