import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { vendorForUser } from '../../common/utils/vendor-context';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateVendorCategoryDto, ReorderVendorCategoriesDto, UpdateVendorCategoryDto } from './dto/vendor-category.dto';

@Injectable()
export class VendorCategoriesService {
  constructor(private readonly prisma: PrismaService, private readonly auditLog: AuditLogService) {}

  async listMine(ownerUserId: string) {
    const vendor = await this.getOwnedVendor(ownerUserId);
    return this.prisma.vendorCategory.findMany({
      where: { vendorId: vendor.id },
      include: { _count: { select: { products: true } } },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(ownerUserId: string, dto: CreateVendorCategoryDto) {
    const vendor = await this.getOwnedVendor(ownerUserId);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Category name is required.');

    const duplicate = await this.prisma.vendorCategory.findFirst({ where: { vendorId: vendor.id, name: { equals: name, mode: 'insensitive' } } });
    if (duplicate) throw new BadRequestException('You already have a category with this name.');

    const max = await this.prisma.vendorCategory.aggregate({ where: { vendorId: vendor.id }, _max: { displayOrder: true } });
    const created = await this.prisma.vendorCategory.create({
      data: {
        vendorId: vendor.id,
        name,
        imageUrl: dto.imageUrl,
        displayOrder: dto.displayOrder ?? ((max._max.displayOrder ?? -1) + 1),
        availabilityStartTime: dto.availabilityStartTime,
        availabilityEndTime: dto.availabilityEndTime,
      },
    });
    await this.auditLog.record({ actorId: ownerUserId, action: 'vendor_category.create', entityType: 'VendorCategory', entityId: created.id, after: created });
    return created;
  }

  async update(ownerUserId: string, id: string, dto: UpdateVendorCategoryDto) {
    const before = await this.getOwnedCategory(ownerUserId, id);
    const name = dto.name?.trim();
    if (name === '') throw new BadRequestException('Category name cannot be empty.');
    if (name && name.toLowerCase() !== before.name.toLowerCase()) {
      const duplicate = await this.prisma.vendorCategory.findFirst({ where: { vendorId: before.vendorId, id: { not: id }, name: { equals: name, mode: 'insensitive' } } });
      if (duplicate) throw new BadRequestException('You already have a category with this name.');
    }
    const updated = await this.prisma.vendorCategory.update({ where: { id }, data: { ...dto, ...(name ? { name } : {}) } });
    await this.auditLog.record({ actorId: ownerUserId, action: 'vendor_category.update', entityType: 'VendorCategory', entityId: id, before, after: updated });
    return updated;
  }

  async reorder(ownerUserId: string, dto: ReorderVendorCategoriesDto) {
    const vendor = await this.getOwnedVendor(ownerUserId);
    const categories = await this.prisma.vendorCategory.findMany({ where: { vendorId: vendor.id }, select: { id: true } });
    const allowed = new Set(categories.map((c) => c.id));
    if (dto.categoryIds.length !== categories.length || dto.categoryIds.some((id) => !allowed.has(id))) {
      throw new BadRequestException('The category order must contain every category belonging to your store exactly once.');
    }
    await this.prisma.$transaction(dto.categoryIds.map((id, index) => this.prisma.vendorCategory.update({ where: { id }, data: { displayOrder: index } })));
    await this.auditLog.record({ actorId: ownerUserId, action: 'vendor_category.reorder', entityType: 'VendorCategory', entityId: vendor.id, after: { categoryIds: dto.categoryIds } });
    return this.listMine(ownerUserId);
  }

  async setActive(ownerUserId: string, id: string, isActive: boolean) {
    const before = await this.getOwnedCategory(ownerUserId, id);
    const updated = await this.prisma.vendorCategory.update({ where: { id }, data: { isActive } });
    await this.auditLog.record({ actorId: ownerUserId, action: isActive ? 'vendor_category.activate' : 'vendor_category.deactivate', entityType: 'VendorCategory', entityId: id, before: { isActive: before.isActive }, after: { isActive: updated.isActive } });
    return updated;
  }

  private async getOwnedVendor(ownerUserId: string) {
    return vendorForUser(this.prisma, ownerUserId);
  }

  private async getOwnedCategory(ownerUserId: string, id: string) {
    const vendor = await this.getOwnedVendor(ownerUserId);
    const category = await this.prisma.vendorCategory.findFirst({ where: { id, vendorId: vendor.id } });
    if (!category) throw new NotFoundException('Vendor category not found.');
    return category;
  }
}
