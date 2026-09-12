import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';

@Injectable()
export class AdminProductsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogService) {}

  list() {
    return this.prisma.product.findMany({
      select: { id: true, name: true, priceAmount: true, discountAmount: true, isAvailable: true, vendorId: true, categoryId: true, createdAt: true, vendor: { select: { storeName: true, status: true } }, category: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setAvailability(id: string, isAvailable: boolean, actorId: string) {
    const before = await this.prisma.product.findUnique({ where: { id }, select: { id: true, isAvailable: true } });
    if (!before) throw new NotFoundException('Product not found.');
    const updated = await this.prisma.product.update({ where: { id }, data: { isAvailable }, select: { id: true, name: true, isAvailable: true, vendorId: true } });
    await this.audit.record({ actorId, action: isAvailable ? 'admin.product.enable' : 'admin.product.disable', entityType: 'Product', entityId: id, before, after: { isAvailable } });
    return updated;
  }
}
