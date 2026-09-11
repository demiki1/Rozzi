import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { vendorForUser } from '../../common/utils/vendor-context';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateOptionGroupDto, CreateOptionItemDto, ReorderOptionGroupsDto, ReorderOptionItemsDto, UpdateOptionGroupDto, UpdateOptionItemDto } from './dto/product-option.dto';

@Injectable()
export class ProductOptionsService {
  constructor(private readonly prisma: PrismaService, private readonly auditLog: AuditLogService) {}

  async listMine(ownerUserId: string) {
    const vendor = await this.getOwnedVendor(ownerUserId);
    return this.prisma.productOptionGroup.findMany({
      where: { product: { vendorId: vendor.id } },
      include: { product: { select: { id: true, name: true, priceAmount: true, isAvailable: true } }, items: { orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] } },
      orderBy: [{ productId: 'asc' }, { displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createGroup(ownerUserId: string, productId: string, dto: CreateOptionGroupDto) {
    await this.getOwnedProduct(ownerUserId, productId);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Option group name is required.');
    const min = dto.minSelections ?? (dto.isRequired ? 1 : 0);
    const max = dto.maxSelections ?? 1;
    this.validateBounds(min, max);
    const duplicate = await this.prisma.productOptionGroup.findFirst({ where: { productId, name: { equals: name, mode: 'insensitive' } } });
    if (duplicate) throw new BadRequestException('An option group with this name already exists for this product.');
    const maxOrder = await this.prisma.productOptionGroup.aggregate({ where: { productId }, _max: { displayOrder: true } });
    const group = await this.prisma.productOptionGroup.create({ data: { productId, name, isRequired: dto.isRequired ?? false, minSelections: min, maxSelections: max, isActive: dto.isActive ?? true, availabilityStartTime: dto.availabilityStartTime, availabilityEndTime: dto.availabilityEndTime, displayOrder: (maxOrder._max.displayOrder ?? -1) + 1 }, include: { items: true } });
    await this.auditLog.record({ actorId: ownerUserId, action: 'product_option_group.create', entityType: 'ProductOptionGroup', entityId: group.id, after: group });
    return group;
  }

  async updateGroup(ownerUserId: string, groupId: string, dto: UpdateOptionGroupDto) {
    const group = await this.getOwnedGroup(ownerUserId, groupId);
    const name = dto.name?.trim();
    if (name === '') throw new BadRequestException('Option group name cannot be empty.');
    if (name && name.toLowerCase() !== group.name.toLowerCase()) {
      const duplicate = await this.prisma.productOptionGroup.findFirst({ where: { productId: group.productId, id: { not: groupId }, name: { equals: name, mode: 'insensitive' } } });
      if (duplicate) throw new BadRequestException('An option group with this name already exists for this product.');
    }
    const min = dto.minSelections ?? group.minSelections;
    const max = dto.maxSelections ?? group.maxSelections;
    this.validateBounds(min, max);
    const updated = await this.prisma.productOptionGroup.update({ where: { id: groupId }, data: { ...(name !== undefined ? { name } : {}), ...(dto.isRequired !== undefined ? { isRequired: dto.isRequired } : {}), minSelections: min, maxSelections: max, ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}), ...(dto.availabilityStartTime !== undefined ? { availabilityStartTime: dto.availabilityStartTime } : {}), ...(dto.availabilityEndTime !== undefined ? { availabilityEndTime: dto.availabilityEndTime } : {}) }, include: { items: true } });
    await this.auditLog.record({ actorId: ownerUserId, action: 'product_option_group.update', entityType: 'ProductOptionGroup', entityId: groupId, before: group, after: updated });
    return updated;
  }

  async setGroupActive(ownerUserId: string, groupId: string, isActive: boolean) {
    const group = await this.getOwnedGroup(ownerUserId, groupId);
    const updated = await this.prisma.productOptionGroup.update({ where: { id: groupId }, data: { isActive } });
    await this.auditLog.record({ actorId: ownerUserId, action: isActive ? 'product_option_group.activate' : 'product_option_group.deactivate', entityType: 'ProductOptionGroup', entityId: groupId, before: { isActive: group.isActive }, after: { isActive } });
    return updated;
  }

  async reorderGroups(ownerUserId: string, productId: string, dto: ReorderOptionGroupsDto) {
    await this.getOwnedProduct(ownerUserId, productId);
    const groups = await this.prisma.productOptionGroup.findMany({ where: { productId }, select: { id: true } });
    this.validateCompleteOrder(dto.groupIds, groups.map(g => g.id), 'group');
    await this.prisma.$transaction(dto.groupIds.map((id, index) => this.prisma.productOptionGroup.update({ where: { id }, data: { displayOrder: index } })));
    return this.listMine(ownerUserId);
  }

  async createItem(ownerUserId: string, groupId: string, dto: CreateOptionItemDto) {
    const group = await this.getOwnedGroup(ownerUserId, groupId);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Option item name is required.');
    const duplicate = await this.prisma.productOptionItem.findFirst({ where: { groupId, name: { equals: name, mode: 'insensitive' } } });
    if (duplicate) throw new BadRequestException('An option item with this name already exists in this group.');
    const maxOrder = await this.prisma.productOptionItem.aggregate({ where: { groupId }, _max: { displayOrder: true } });
    const item = await this.prisma.productOptionItem.create({ data: { groupId, name, additionalPrice: dto.additionalPrice ?? 0, isAvailable: dto.isAvailable ?? true, stockQuantity: dto.stockQuantity, lowStockThreshold: dto.lowStockThreshold, displayOrder: (maxOrder._max.displayOrder ?? -1) + 1 } });
    await this.auditLog.record({ actorId: ownerUserId, action: 'product_option_item.create', entityType: 'ProductOptionItem', entityId: item.id, after: item });
    return item;
  }

  async updateItem(ownerUserId: string, itemId: string, dto: UpdateOptionItemDto) {
    const item = await this.getOwnedItem(ownerUserId, itemId);
    const name = dto.name?.trim();
    if (name === '') throw new BadRequestException('Option item name cannot be empty.');
    if (name && name.toLowerCase() !== item.name.toLowerCase()) {
      const duplicate = await this.prisma.productOptionItem.findFirst({ where: { groupId: item.groupId, id: { not: itemId }, name: { equals: name, mode: 'insensitive' } } });
      if (duplicate) throw new BadRequestException('An option item with this name already exists in this group.');
    }
    const updated = await this.prisma.productOptionItem.update({ where: { id: itemId }, data: { ...(name !== undefined ? { name } : {}), ...(dto.additionalPrice !== undefined ? { additionalPrice: dto.additionalPrice } : {}), ...(dto.isAvailable !== undefined ? { isAvailable: dto.isAvailable } : {}), ...(dto.stockQuantity !== undefined ? { stockQuantity: dto.stockQuantity } : {}), ...(dto.lowStockThreshold !== undefined ? { lowStockThreshold: dto.lowStockThreshold } : {}) } });
    await this.auditLog.record({ actorId: ownerUserId, action: 'product_option_item.update', entityType: 'ProductOptionItem', entityId: itemId, before: item, after: updated });
    return updated;
  }

  async setItemActive(ownerUserId: string, itemId: string, isAvailable: boolean) {
    const item = await this.getOwnedItem(ownerUserId, itemId);
    const updated = await this.prisma.productOptionItem.update({ where: { id: itemId }, data: { isAvailable } });
    await this.auditLog.record({ actorId: ownerUserId, action: isAvailable ? 'product_option_item.activate' : 'product_option_item.deactivate', entityType: 'ProductOptionItem', entityId: itemId, before: { isAvailable: item.isAvailable }, after: { isAvailable } });
    return updated;
  }

  async deleteItem(ownerUserId: string, itemId: string) {
    const item = await this.getOwnedItem(ownerUserId, itemId);
    await this.prisma.productOptionItem.delete({ where: { id: itemId } });
    await this.auditLog.record({ actorId: ownerUserId, action: 'product_option_item.delete', entityType: 'ProductOptionItem', entityId: itemId, before: item });
    return { success: true };
  }

  async reorderItems(ownerUserId: string, groupId: string, dto: ReorderOptionItemsDto) {
    await this.getOwnedGroup(ownerUserId, groupId);
    const items = await this.prisma.productOptionItem.findMany({ where: { groupId }, select: { id: true } });
    this.validateCompleteOrder(dto.itemIds, items.map(i => i.id), 'item');
    await this.prisma.$transaction(dto.itemIds.map((id, index) => this.prisma.productOptionItem.update({ where: { id }, data: { displayOrder: index } })));
    return this.prisma.productOptionItem.findMany({ where: { groupId }, orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] });
  }

  private validateBounds(min: number, max: number) {
    if (min < 0 || max < 1 || min > max) throw new BadRequestException('Minimum selections cannot exceed maximum selections.');
  }
  private validateCompleteOrder(received: string[], expected: string[], label: string) {
    const a = [...received].sort(), b = [...expected].sort();
    if (a.length !== b.length || a.some((id, i) => id !== b[i])) throw new BadRequestException(`The ${label} order must contain every ${label} belonging to this product exactly once.`);
  }
  private async getOwnedVendor(ownerUserId: string) { return vendorForUser(this.prisma, ownerUserId); }
  private async getOwnedProduct(ownerUserId: string, productId: string) { const vendor = await this.getOwnedVendor(ownerUserId); const product = await this.prisma.product.findFirst({ where: { id: productId, vendorId: vendor.id } }); if (!product) throw new NotFoundException('Product not found.'); return product; }
  private async getOwnedGroup(ownerUserId: string, groupId: string) { const vendor = await this.getOwnedVendor(ownerUserId); const group = await this.prisma.productOptionGroup.findFirst({ where: { id: groupId, product: { vendorId: vendor.id } }, include: { product: true, items: true } }); if (!group) throw new NotFoundException('Option group not found.'); return group; }
  private async getOwnedItem(ownerUserId: string, itemId: string) { const vendor = await this.getOwnedVendor(ownerUserId); const item = await this.prisma.productOptionItem.findFirst({ where: { id: itemId, group: { product: { vendorId: vendor.id } } }, include: { group: { include: { product: true } } } }); if (!item) throw new NotFoundException('Option item not found.'); return item; }
}
