import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { vendorForUser } from '../../common/utils/vendor-context';
import { AuditLogService } from '../audit/audit-log.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService, private readonly auditLog: AuditLogService) {}

  async listMine(ownerUserId: string, search?: string, status?: string) {
    const vendor = await this.getOwnedVendor(ownerUserId);
    const rows = await this.prisma.inventory.findMany({
      where: {
        OR: [
          { product: { vendorId: vendor.id, ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}) } },
          { variant: { product: { vendorId: vendor.id, ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}) } } },
        ],
      },
      include: { product: { select: { id: true, name: true, sku: true, unit: true, isAvailable: true, vendorCategory: { select: { id: true, name: true } } } }, variant: { select: { id: true, name: true, productId: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.filter(r => {
      const qty = r.quantity;
      const threshold = r.lowStockThreshold;
      if (status === 'out') return qty === 0;
      if (status === 'low') return qty > 0 && qty <= threshold;
      if (status === 'healthy') return qty > threshold;
      return true;
    });
  }

  async summary(ownerUserId: string) {
    const rows = await this.listMine(ownerUserId);
    return {
      totalItems: rows.length,
      totalUnits: rows.reduce((s, r) => s + r.quantity, 0),
      lowStock: rows.filter(r => r.quantity > 0 && r.quantity <= r.lowStockThreshold).length,
      outOfStock: rows.filter(r => r.quantity === 0).length,
    };
  }

  async history(ownerUserId: string, inventoryId: string, limit = 50) {
    const inventory = await this.getOwnedInventory(ownerUserId, inventoryId);
    return this.prisma.stockMovement.findMany({
      where: { inventoryId: inventory.id },
      include: { actor: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  async adjust(ownerUserId: string, inventoryId: string, dto: { quantityDelta: number; reason: string }) {
    if (!dto.reason?.trim()) throw new BadRequestException('A stock adjustment reason is required.');
    const inventory = await this.getOwnedInventory(ownerUserId, inventoryId);
    return this.prisma.$transaction(async tx => {
      const current = await tx.inventory.findUnique({ where: { id: inventory.id } });
      if (!current) throw new NotFoundException('Inventory record not found.');
      const next = current.quantity + dto.quantityDelta;
      if (next < 0) throw new BadRequestException('Adjustment would result in negative stock.');
      const result = await tx.inventory.updateMany({ where: { id: current.id, quantity: current.quantity }, data: { quantity: next } });
      if (!result.count) throw new BadRequestException('Stock changed concurrently. Please retry.');
      const movement = await tx.stockMovement.create({ data: { inventoryId: current.id, quantityDelta: dto.quantityDelta, quantityBefore: current.quantity, quantityAfter: next, reason: dto.reason.trim(), actorId: ownerUserId, referenceType: 'MANUAL_ADJUSTMENT' } });
      return { inventory: { ...current, quantity: next }, movement };
    }).then(async result => { await this.auditLog.record({ actorId: ownerUserId, action: 'inventory.adjust', entityType: 'Inventory', entityId: inventoryId, before: { quantity: result.movement.quantityBefore }, after: { quantity: result.movement.quantityAfter, reason: result.movement.reason } }); return result; });
  }

  async setQuantity(ownerUserId: string, inventoryId: string, dto: { quantity: number; reason: string }) {
    const inventory = await this.getOwnedInventory(ownerUserId, inventoryId);
    return this.adjust(ownerUserId, inventoryId, { quantityDelta: dto.quantity - inventory.quantity, reason: dto.reason });
  }

  async threshold(ownerUserId: string, inventoryId: string, value: number) {
    const inventory = await this.getOwnedInventory(ownerUserId, inventoryId);
    const updated = await this.prisma.inventory.update({ where: { id: inventory.id }, data: { lowStockThreshold: value } });
    await this.auditLog.record({ actorId: ownerUserId, action: 'inventory.threshold.update', entityType: 'Inventory', entityId: inventoryId, before: { lowStockThreshold: inventory.lowStockThreshold }, after: { lowStockThreshold: value } });
    return updated;
  }

  async bulkAdjust(ownerUserId: string, items: { inventoryId: string; quantityDelta: number; reason: string }[]) {
    if (!items.length) throw new BadRequestException('At least one inventory item is required.');
    if (items.length > 100) throw new BadRequestException('Bulk updates are limited to 100 items.');
    const results = [] as any[];
    for (const item of items) results.push(await this.adjust(ownerUserId, item.inventoryId, item));
    return { updated: results.length, results };
  }

  private async getOwnedVendor(ownerUserId: string) {
    return vendorForUser(this.prisma, ownerUserId);
  }

  private async getOwnedInventory(ownerUserId: string, inventoryId: string) {
    const vendor = await this.getOwnedVendor(ownerUserId);
    const inventory = await this.prisma.inventory.findFirst({ where: { id: inventoryId, OR: [{ product: { vendorId: vendor.id } }, { variant: { product: { vendorId: vendor.id } } }] } });
    if (!inventory) throw new NotFoundException('Inventory record not found.');
    return inventory;
  }
}
