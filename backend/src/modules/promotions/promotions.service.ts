import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { vendorForUser } from '../../common/utils/vendor-context';
import { CreatePromotionDto, UpdatePromotionDto } from './dto/promotion.dto';
import { Prisma, PromotionType } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';

@Injectable()
export class PromotionsService {
  constructor(private prisma: PrismaService, private audit: AuditLogService) {}

  private normalize(code: string) { return code.trim().toUpperCase(); }
  private async vendor(ownerUserId: string) { return vendorForUser(this.prisma, ownerUserId); }
  private dates(a: string, b: string) {
    const start = new Date(a), end = new Date(b);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw new BadRequestException('Promotion dates are invalid.');
    }
    return { start, end };
  }

  async validate(code: string, customerId: string, subtotal: number, vendorId?: string) {
    const normalizedCode = this.normalize(code);
    const now = new Date();
    const p = vendorId
      ? (await this.prisma.promotion.findFirst({ where: { code: normalizedCode, vendorId } })
        ?? await this.prisma.promotion.findFirst({ where: { code: normalizedCode, vendorId: null } }))
      : await this.prisma.promotion.findFirst({ where: { code: normalizedCode, vendorId: null } });
    if (!p || !p.isActive || p.startsAt > now || p.endsAt < now) throw new BadRequestException('Promotion is invalid or expired.');
    if (subtotal < p.minOrderAmount) throw new BadRequestException(`Minimum order for this promotion is ${p.minOrderAmount / 100} NGN.`);
    if (p.usageLimit !== null && p.usageCount >= p.usageLimit) throw new BadRequestException('Promotion usage limit reached.');
    if (p.perCustomerLimit) {
      const used = await this.prisma.order.count({ where: { customerId, promotionId: p.id } });
      if (used >= p.perCustomerLimit) throw new BadRequestException('You have reached this promotion limit.');
    }
    let discount = p.type === PromotionType.PERCENTAGE ? Math.floor(subtotal * p.value / 100) : p.value;
    if (p.maxDiscount !== null) discount = Math.min(discount, p.maxDiscount);
    discount = Math.min(discount, subtotal);
    return { id: p.id, code: p.code, discount };
  }

  async consumePromotion(tx: Prisma.TransactionClient, promotionId: string, customerId: string, subtotal: number, expectedDiscount: number) {
    await tx.$queryRaw`SELECT id FROM "promotions" WHERE id = ${promotionId} FOR UPDATE`;
    const p = await tx.promotion.findUnique({ where: { id: promotionId } });
    const now = new Date();
    if (!p || !p.isActive || p.startsAt > now || p.endsAt < now) throw new BadRequestException('Promotion is invalid or expired.');
    if (subtotal < p.minOrderAmount) throw new BadRequestException(`Minimum order for this promotion is ${p.minOrderAmount / 100} NGN.`);
    if (p.usageLimit !== null && p.usageCount >= p.usageLimit) throw new BadRequestException('Promotion usage limit reached.');
    if (p.perCustomerLimit) {
      const used = await tx.order.count({ where: { customerId, promotionId: p.id } });
      if (used >= p.perCustomerLimit) throw new BadRequestException('You have reached this promotion limit.');
    }
    let discount = p.type === PromotionType.PERCENTAGE ? Math.floor(subtotal * p.value / 100) : p.value;
    if (p.maxDiscount !== null) discount = Math.min(discount, p.maxDiscount);
    discount = Math.min(discount, subtotal);
    if (discount !== expectedDiscount) throw new BadRequestException('Promotion changed during checkout. Please retry.');
    await tx.promotion.update({ where: { id: p.id }, data: { usageCount: { increment: 1 } } });
    return p;
  }

  listPublic(vendorId?: string) {
    const now = new Date();
    return this.prisma.promotion.findMany({
      where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now }, OR: vendorId ? [{ vendorId }, { vendorId: null }] : [{ vendorId: null }] },
      select: { id: true, code: true, name: true, type: true, value: true, minOrderAmount: true, maxDiscount: true, startsAt: true, endsAt: true, vendorId: true },
      orderBy: { startsAt: 'desc' },
    });
  }

  listAdmin() { return this.prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } }); }
  async listMine(ownerUserId: string) { const v = await this.vendor(ownerUserId); return this.prisma.promotion.findMany({ where: { vendorId: v.id }, orderBy: { createdAt: 'desc' } }); }

  async createForVendor(ownerUserId: string, dto: CreatePromotionDto) {
    const v = await this.vendor(ownerUserId);
    const code = this.normalize(dto.code);
    const { start, end } = this.dates(dto.startsAt, dto.endsAt);
    if (dto.type === PromotionType.PERCENTAGE && dto.value > 100) throw new BadRequestException('Percentage discount cannot exceed 100%.');
    const exists = await this.prisma.promotion.findFirst({ where: { code, vendorId: v.id } });
    if (exists) throw new ConflictException('You already have a promotion with this code.');
    const created = await this.prisma.promotion.create({ data: { vendorId: v.id, code, name: dto.name.trim(), type: dto.type, value: dto.value, minOrderAmount: dto.minOrderAmount ?? 0, maxDiscount: dto.maxDiscount, usageLimit: dto.usageLimit, perCustomerLimit: dto.perCustomerLimit, startsAt: start, endsAt: end } });
    await this.audit.record({ actorId: ownerUserId, action: 'vendor.promotion.create', entityType: 'Promotion', entityId: created.id, after: created });
    return created;
  }

  async updateForVendor(ownerUserId: string, id: string, dto: UpdatePromotionDto) {
    const v = await this.vendor(ownerUserId);
    const before = await this.prisma.promotion.findFirst({ where: { id, vendorId: v.id } });
    if (!before) throw new NotFoundException('Promotion not found.');
    const nextType = before.type;
    if (dto.value !== undefined && nextType === PromotionType.PERCENTAGE && dto.value > 100) throw new BadRequestException('Percentage discount cannot exceed 100%.');
    let endsAt: Date | undefined = undefined;
    if (dto.endsAt) {
      const end = new Date(dto.endsAt);
      if (Number.isNaN(end.getTime()) || end <= before.startsAt) throw new BadRequestException('Invalid end date.');
      endsAt = end;
    }
    const updated = await this.prisma.promotion.update({ where: { id }, data: { ...dto, endsAt } });
    await this.audit.record({ actorId: ownerUserId, action: 'vendor.promotion.update', entityType: 'Promotion', entityId: id, before, after: updated });
    return updated;
  }

  async deactivateForVendor(ownerUserId: string, id: string) {
    const v = await this.vendor(ownerUserId);
    const before = await this.prisma.promotion.findFirst({ where: { id, vendorId: v.id } });
    if (!before) throw new NotFoundException('Promotion not found.');
    const updated = await this.prisma.promotion.update({ where: { id }, data: { isActive: false } });
    await this.audit.record({ actorId: ownerUserId, action: 'vendor.promotion.deactivate', entityType: 'Promotion', entityId: id, before: { isActive: before.isActive }, after: { isActive: false } });
    return updated;
  }

  async create(dto: CreatePromotionDto, actorId: string) {
    const code = this.normalize(dto.code);
    const { start, end } = this.dates(dto.startsAt, dto.endsAt);
    if (dto.type === PromotionType.PERCENTAGE && dto.value > 100) throw new BadRequestException('Percentage discount cannot exceed 100%.');
    const exists = await this.prisma.promotion.findFirst({ where: { code, vendorId: null } });
    if (exists) throw new ConflictException('A marketplace promotion with this code already exists.');
    const created = await this.prisma.promotion.create({ data: { code, name: dto.name.trim(), type: dto.type, value: dto.value, minOrderAmount: dto.minOrderAmount ?? 0, maxDiscount: dto.maxDiscount, usageLimit: dto.usageLimit, perCustomerLimit: dto.perCustomerLimit, startsAt: start, endsAt: end } });
    await this.audit.record({ actorId, action: 'admin.promotion.create', entityType: 'Promotion', entityId: created.id, after: created });
    return created;
  }

  async update(id: string, dto: UpdatePromotionDto, actorId: string) {
    const before = await this.prisma.promotion.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Promotion not found.');
    if (dto.value !== undefined && before.type === PromotionType.PERCENTAGE && dto.value > 100) throw new BadRequestException('Percentage discount cannot exceed 100%.');
    if (dto.endsAt && (Number.isNaN(new Date(dto.endsAt).getTime()) || new Date(dto.endsAt) <= before.startsAt)) throw new BadRequestException('Invalid end date.');
    const updated = await this.prisma.promotion.update({ where: { id }, data: { ...dto, endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined } });
    await this.audit.record({ actorId, action: 'admin.promotion.update', entityType: 'Promotion', entityId: id, before, after: updated });
    return updated;
  }

  async deactivate(id: string, actorId: string) {
    const before = await this.prisma.promotion.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Promotion not found.');
    const updated = await this.prisma.promotion.update({ where: { id }, data: { isActive: false } });
    await this.audit.record({ actorId, action: 'admin.promotion.deactivate', entityType: 'Promotion', entityId: id, before: { isActive: before.isActive }, after: { isActive: false } });
    return updated;
  }
}
