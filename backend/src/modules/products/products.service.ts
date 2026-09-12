import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { vendorForUser } from '../../common/utils/vendor-context';
import { CreateProductDto, UpdateProductDto, ProductQueryDto, CreateVariantDto, UpdateVariantDto, ReorderVariantsDto } from './dto/product.dto';
import { PUBLIC_VENDOR_SELECT } from '../vendors/vendor-public-select';
import { VendorStatus } from '@prisma/client';
import { StorageService } from '../storage/storage.service';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  // ---- Vendor: manage own products ----

  async create(ownerUserId: string, dto: CreateProductDto) {
    const vendor = await this.getOwnedVendor(ownerUserId);
    if ((dto.discountAmount ?? 0) > dto.priceAmount) {
      throw new BadRequestException('Discount cannot exceed the product price.');
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          vendorId: vendor.id,
          categoryId: dto.categoryId,
          vendorCategoryId: await this.validateVendorCategory(tx, vendor.id, dto.vendorCategoryId),
          name: dto.name,
          description: dto.description,
          sku: dto.sku,
          priceAmount: dto.priceAmount,
          discountAmount: dto.discountAmount,
          unit: dto.unit,
          weightGrams: dto.weightGrams,
          preparationTimeMinutes: dto.preparationTimeMinutes,
          isAvailable: dto.isAvailable,
        },
      });

      if (dto.variants?.length) {
        for (const v of dto.variants) {
          const variant = await tx.productVariant.create({
            data: { productId: product.id, name: v.name, priceOverride: v.priceOverride },
          });
          await tx.inventory.create({
            data: { variantId: variant.id, quantity: v.initialStock ?? 0 },
          });
        }
      } else {
        await tx.inventory.create({
          data: { productId: product.id, quantity: dto.initialStock ?? 0 },
        });
      }

      return tx.product.findUnique({
        where: { id: product.id },
        include: { variants: { include: { inventory: true } }, inventory: true },
      });
    });
  }
  
  async addImages(
    ownerUserId: string,
    productId: string,
    images: { url: string; sortOrder?: number }[],
  ) {
    await this.getOwnedProduct(ownerUserId, productId);

    if (!images.length) {
      throw new BadRequestException('At least one image is required.');
    }

    if (images.length > 10) {
      throw new BadRequestException('A product can have a maximum of 10 images.');
    }

    await Promise.all(images.map((image) => this.storage.getOwnedPublicImageUrl(ownerUserId, image.url)));

    return this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.productImage.count({
        where: { productId },
      });

      if (existingCount + images.length > 10) {
        throw new BadRequestException('A product can have a maximum of 10 images.');
      }

      await tx.productImage.createMany({
        data: images.map((image, index) => ({
          productId,
          url: image.url,
          sortOrder: image.sortOrder ?? existingCount + index,
        })),
      });

      return tx.productImage.findMany({
        where: { productId },
        orderBy: { sortOrder: 'asc' },
      });
    });
  }

  async update(ownerUserId: string, productId: string, dto: UpdateProductDto) {
    const existing = await this.getOwnedProduct(ownerUserId, productId);
    const nextPrice = dto.priceAmount ?? existing.priceAmount;
    const nextDiscount = dto.discountAmount ?? existing.discountAmount ?? 0;
    if (nextDiscount > nextPrice) {
      throw new BadRequestException('Discount cannot exceed the product price.');
    }
    const data: any = { ...dto };
    if (dto.vendorCategoryId !== undefined) {
      data.vendorCategoryId = await this.validateVendorCategory(this.prisma, existing.vendorId, dto.vendorCategoryId);
    }
    return this.prisma.product.update({ where: { id: productId }, data, include: { inventory: true, variants: { include: { inventory: true } }, category: true, vendorCategory: true, images: true } });
  }

  async listVariants(ownerUserId: string) {
    const vendor = await this.getOwnedVendor(ownerUserId);
    return this.prisma.productVariant.findMany({
      where: { product: { vendorId: vendor.id } },
      include: { product: { select: { id: true, name: true, priceAmount: true, isAvailable: true } }, inventory: true },
      orderBy: [{ productId: 'asc' }, { displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createVariant(ownerUserId: string, productId: string, dto: CreateVariantDto) {
    const product = await this.getOwnedProduct(ownerUserId, productId);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Variant name is required.');
    const duplicate = await this.prisma.productVariant.findFirst({ where: { productId, name } });
    if (duplicate) throw new BadRequestException('A variant with this name already exists for this product.');
    const max = await this.prisma.productVariant.aggregate({ where: { productId }, _max: { displayOrder: true } });
    return this.prisma.$transaction(async tx => {
      const variant = await tx.productVariant.create({ data: { productId: product.id, name, priceOverride: dto.priceOverride, displayOrder: (max._max.displayOrder ?? -1) + 1 } });
      await tx.inventory.create({ data: { variantId: variant.id, quantity: dto.initialStock ?? 0 } });
      return tx.productVariant.findUnique({ where: { id: variant.id }, include: { inventory: true, product: { select: { id: true, name: true, priceAmount: true } } } });
    });
  }

  async updateVariant(ownerUserId: string, variantId: string, dto: UpdateVariantDto) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId }, include: { product: true } });
    if (!variant) throw new NotFoundException('Variant not found.');
    await this.getOwnedProduct(ownerUserId, variant.productId);
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Variant name cannot be empty.');
      const duplicate = await this.prisma.productVariant.findFirst({ where: { productId: variant.productId, name, NOT: { id: variantId } } });
      if (duplicate) throw new BadRequestException('A variant with this name already exists for this product.');
    }
    return this.prisma.productVariant.update({ where: { id: variantId }, data: { ...(dto.name !== undefined ? { name: dto.name.trim() } : {}), ...(dto.priceOverride !== undefined ? { priceOverride: dto.priceOverride } : {}) }, include: { inventory: true, product: { select: { id: true, name: true, priceAmount: true } } } });
  }

  async deleteVariant(ownerUserId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundException('Variant not found.');
    await this.getOwnedProduct(ownerUserId, variant.productId);
    return this.prisma.productVariant.delete({ where: { id: variantId } });
  }

  async reorderVariants(ownerUserId: string, productId: string, dto: ReorderVariantsDto) {
    await this.getOwnedProduct(ownerUserId, productId);
    const variants = await this.prisma.productVariant.findMany({ where: { productId }, select: { id: true } });
    const allowed = new Set(variants.map(v => v.id));
    if (dto.variantIds.length !== variants.length || dto.variantIds.some(id => !allowed.has(id)) || new Set(dto.variantIds).size !== dto.variantIds.length) {
      throw new BadRequestException('Variant ordering must contain every variant exactly once.');
    }
    await this.prisma.$transaction(dto.variantIds.map((id, index) => this.prisma.productVariant.update({ where: { id }, data: { displayOrder: index } })));
    return this.prisma.productVariant.findMany({ where: { productId }, include: { inventory: true }, orderBy: { displayOrder: 'asc' } });
  }

  async duplicate(ownerUserId: string, productId: string) {
    const original = await this.getOwnedProduct(ownerUserId, productId);
    const source = await this.prisma.product.findUnique({ where: { id: original.id }, include: { inventory: true, variants: { include: { inventory: true } }, optionGroups: { include: { items: true } } } });
    if (!source) throw new NotFoundException('Product not found.');
    return this.prisma.$transaction(async (tx) => {
      const copy = await tx.product.create({
        data: {
          vendorId: original.vendorId,
          categoryId: original.categoryId,
          vendorCategoryId: original.vendorCategoryId,
          name: `${original.name} (Copy)`,
          description: original.description,
          sku: original.sku ? `${original.sku}-COPY` : undefined,
          priceAmount: original.priceAmount,
          discountAmount: original.discountAmount,
          unit: original.unit,
          weightGrams: original.weightGrams,
          preparationTimeMinutes: original.preparationTimeMinutes,
          availabilityStartTime: original.availabilityStartTime,
          availabilityEndTime: original.availabilityEndTime,
          availabilityDays: original.availabilityDays,
          isAvailable: false,
        },
      });
      const variants = source.variants;
      for (const v of variants) {
        const variant = await tx.productVariant.create({ data: { productId: copy.id, name: v.name, priceOverride: v.priceOverride, displayOrder: v.displayOrder } });
        await tx.inventory.create({ data: { variantId: variant.id, quantity: v.inventory?.quantity ?? 0 } });
      }
      if (!variants.length && source.inventory) {
        await tx.inventory.create({ data: { productId: copy.id, quantity: source.inventory.quantity } });
      }
      for (const group of source.optionGroups) {
        const copiedGroup = await tx.productOptionGroup.create({
          data: { productId: copy.id, name: group.name, isRequired: group.isRequired, minSelections: group.minSelections, maxSelections: group.maxSelections, isActive: group.isActive, availabilityStartTime: group.availabilityStartTime, availabilityEndTime: group.availabilityEndTime, displayOrder: group.displayOrder },
        });
        if (group.items.length) {
          await tx.productOptionItem.createMany({ data: group.items.map(item => ({ groupId: copiedGroup.id, name: item.name, additionalPrice: item.additionalPrice, isAvailable: item.isAvailable, stockQuantity: item.stockQuantity, lowStockThreshold: item.lowStockThreshold, displayOrder: item.displayOrder })) });
        }
      }
      const images = await tx.productImage.findMany({ where: { productId: original.id } });
      if (images.length) {
        await tx.productImage.createMany({ data: images.map(image => ({ productId: copy.id, url: image.url, sortOrder: image.sortOrder })) });
      }
      return tx.product.findUnique({ where: { id: copy.id }, include: { inventory: true, variants: { include: { inventory: true } }, optionGroups: { include: { items: true } }, category: true, vendorCategory: true, images: true } });
    });
  }

  async remove(ownerUserId: string, productId: string) {
    await this.getOwnedProduct(ownerUserId, productId);
    // Soft delete by disabling — an order may still reference this product
    // historically, so we never hard-delete a product with order history.
    return this.prisma.product.update({ where: { id: productId }, data: { isAvailable: false } });
  }

  async listMine(ownerUserId: string) {
    const vendor = await this.getOwnedVendor(ownerUserId);
    return this.prisma.product.findMany({
      where: { vendorId: vendor.id },
      include: { inventory: true, variants: { include: { inventory: true } }, category: true, vendorCategory: true, images: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // §41: adjust stock inside a transaction with a row lock, so two
  // concurrent adjustments (or an adjustment racing an order deduction)
  // can't corrupt the quantity. Prisma doesn't expose SELECT ... FOR UPDATE
  // directly for all DBs, so we use an atomic conditional update instead:
  // the WHERE clause re-checks quantity, and a zero-row update means someone
  // else moved first — we throw and let the caller retry, rather than ever
  // computing "current - 1" from a stale read.
  async adjustStock(ownerUserId: string, productId: string, quantityDelta: number, variantId?: string) {
    await this.getOwnedProduct(ownerUserId, productId);

    return this.prisma.$transaction(async (tx) => {
      if (variantId) {
        const variant = await tx.productVariant.findFirst({
          where: { id: variantId, productId },
          select: { id: true },
        });
        if (!variant) throw new NotFoundException('Variant not found for this product.');
      }

      const inventory = variantId
        ? await tx.inventory.findUnique({ where: { variantId } })
        : await tx.inventory.findUnique({ where: { productId } });

      if (!inventory) throw new NotFoundException('Inventory record not found for this product/variant.');

      const newQuantity = inventory.quantity + quantityDelta;
      if (newQuantity < 0) {
        throw new BadRequestException('Adjustment would result in negative stock.');
      }

      const result = await tx.inventory.updateMany({
        where: { id: inventory.id, quantity: inventory.quantity }, // optimistic check
        data: { quantity: newQuantity },
      });

      if (result.count === 0) {
        throw new BadRequestException('Stock was changed concurrently — please retry.');
      }

      return tx.inventory.findUnique({ where: { id: inventory.id } });
    });
  }

  // Called from OrderService in Phase 4 when an order is placed. Kept here
  // now so the concurrency-safe pattern exists before it's needed, per the
  // spec's explicit requirement (§41) that this race condition be handled
  // from the start rather than retrofitted.
  async deductStockForOrder(tx: any, productId: string, quantity: number, variantId?: string, actorId?: string, referenceId?: string) {
    const inventory = variantId
      ? await tx.inventory.findUnique({ where: { variantId } })
      : await tx.inventory.findUnique({ where: { productId } });

    if (!inventory || inventory.quantity < quantity) {
      throw new BadRequestException('This product no longer has enough stock.');
    }

    const result = await tx.inventory.updateMany({
      where: { id: inventory.id, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } },
    });

    if (result.count === 0) {
      throw new BadRequestException('This product just sold out — please remove it from your cart.');
    }

    await tx.stockMovement.create({
      data: {
        inventoryId: inventory.id,
        quantityDelta: -quantity,
        quantityBefore: inventory.quantity,
        quantityAfter: inventory.quantity - quantity,
        reason: 'Order checkout',
        referenceType: 'ORDER_CHECKOUT',
        referenceId,
        actorId,
      },
    });
  }


  private async validateVendorCategory(client: any, vendorId: string, vendorCategoryId?: string) {
    if (!vendorCategoryId) return undefined;
    const category = await client.vendorCategory.findFirst({ where: { id: vendorCategoryId, vendorId } });
    if (!category) throw new BadRequestException('Vendor category does not belong to your store.');
    if (!category.isActive) throw new BadRequestException('That vendor category is inactive.');
    return vendorCategoryId;
  }

  // ---- Public: location-scoped search (§40, §85) ----

  async search(query: ProductQueryDto) {
    const page = Math.max(query.page ?? 1, 1);
    const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    const where: any = {
      isAvailable: true,
      vendor: { status: VendorStatus.APPROVED, isOpen: true },
    };

    if (query.serviceAreaId) {
      where.vendor.locations = { some: { serviceAreaId: query.serviceAreaId } };
    }
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.priceAmount = {};
      if (query.minPrice !== undefined) where.priceAmount.gte = query.minPrice;
      if (query.maxPrice !== undefined) where.priceAmount.lte = query.maxPrice;
    }
    if (query.minPrice !== undefined && query.maxPrice !== undefined && query.minPrice > query.maxPrice) {
      throw new BadRequestException('Minimum price cannot exceed maximum price.');
    }
    const orderBy = query.sort === 'price_asc' ? { priceAmount: 'asc' as const }
      : query.sort === 'price_desc' ? { priceAmount: 'desc' as const }
      : query.sort === 'name_asc' ? { name: 'asc' as const }
      : query.sort === 'name_desc' ? { name: 'desc' as const }
      : { createdAt: 'desc' as const };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { vendor: { select: PUBLIC_VENDOR_SELECT }, category: true, images: { orderBy: { sortOrder: 'asc' } }, variants: { select: { id: true } }, optionGroups: { where: { isActive: true }, select: { id: true, isRequired: true, minSelections: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getPublicProduct(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, isAvailable: true, vendor: { status: VendorStatus.APPROVED, isOpen: true } },
      include: {
        vendor: { select: PUBLIC_VENDOR_SELECT },
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { include: { inventory: true }, orderBy: { displayOrder: 'asc' } },
        optionGroups: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
          include: { items: { where: { isAvailable: true }, orderBy: { displayOrder: 'asc' } } },
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found.');
    return { ...product, optionGroups: product.optionGroups.filter((group) => this.isWithinAvailabilityWindow(group.availabilityStartTime, group.availabilityEndTime)) };
  }

  private isWithinAvailabilityWindow(start?: string | null, end?: string | null) {
    if (!start && !end) return true;
    const now = new Date();
    const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (start && end) return start <= end ? current >= start && current <= end : current >= start || current <= end;
    return start ? current >= start : current <= end!;
  }

  // ---- helpers ----

  private async getOwnedVendor(ownerUserId: string) {
    return vendorForUser(this.prisma, ownerUserId);
  }

  private async getOwnedProduct(ownerUserId: string, productId: string) {
    const vendor = await this.getOwnedVendor(ownerUserId);
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found.');
    if (product.vendorId !== vendor.id) {
      throw new ForbiddenException('This product does not belong to your store.');
    }
    return product;
  }
}
