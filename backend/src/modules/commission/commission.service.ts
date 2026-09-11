import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class CommissionService {
  constructor(private readonly prisma: PrismaService) {}

  async getGlobalConfig() {
    const config = await this.prisma.commissionConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      throw new NotFoundException('Active commission configuration not found.');
    }

    return config;
  }

  async resolveRate(
    vendorId: string,
    categoryId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.Decimal> {
    const db = tx ?? this.prisma;

    const vendorCategory = await db.vendorCategoryCommission.findUnique({
      where: {
        vendorId_categoryId: {
          vendorId,
          categoryId,
        },
      },
    });

    if (vendorCategory) {
      return vendorCategory.ratePercent;
    }

    const vendor = await db.vendorCommission.findUnique({
      where: { vendorId },
    });

    if (vendor) {
      return vendor.ratePercent;
    }

    const category = await db.categoryCommission.findUnique({
      where: { categoryId },
    });

    if (category) {
      return category.ratePercent;
    }

    const global = await db.commissionConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!global) {
      throw new NotFoundException('Active commission configuration not found.');
    }

    return global.defaultRatePercent;
  }
}
