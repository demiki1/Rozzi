import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { vendorForUser } from '../../common/utils/vendor-context';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateReviewDto } from './dto/review.dto';
import { VendorReviewQueryDto, VendorReviewResponseDto } from './dto/vendor-review.dto';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogService) {}

  async create(customerId: string, orderId: string, dto: CreateReviewDto) {
    if (!orderId) throw new BadRequestException('Order ID is required.');
    if (!dto.vendorRating && !dto.riderRating && !dto.productRating && !dto.comment?.trim()) throw new BadRequestException('Provide at least one rating or review.');
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { delivery: true, items: true } });
    if (!order || order.customerId !== customerId) throw new NotFoundException('Order not found.');
    if (order.status !== OrderStatus.DELIVERED) throw new BadRequestException('Reviews are available after delivery.');
    const existing = await this.prisma.review.findUnique({ where: { orderId } });
    if (existing) throw new BadRequestException('This order has already been reviewed.');
    return this.prisma.review.create({ data: { orderId, customerId, vendorId: order.vendorId, riderId: order.delivery?.riderId ?? undefined, productId: order.items[0]?.productId, vendorRating: dto.vendorRating, riderRating: dto.riderRating, productRating: dto.productRating, title: dto.title?.trim() || null, comment: dto.comment?.trim() || null, photoUrls: dto.photoUrls || [] } });
  }


  async mine(customerId: string) {
    return this.prisma.review.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: { vendor: { select: { id: true, storeName: true, logoUrl: true } }, product: { select: { id: true, name: true } } },
    });
  }

  async customerProductSummary(productId: string) {
    const items = await this.listForProduct(productId);
    const ratings = items.map((r: any) => r.productRating).filter((r: any): r is number => r != null);
    return { summary: { rating: ratings.length ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)) : 0, count: ratings.length }, items };
  }

  async customerVendorSummary(vendorId: string) {
    const items = await this.listForVendor(vendorId);
    const ratings = items.map((r: any) => r.vendorRating).filter((r: any): r is number => r != null);
    return { summary: { rating: ratings.length ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)) : 0, count: ratings.length }, items };
  }

  listForVendor(vendorId: string) {
    return this.prisma.review.findMany({
      where: { vendorId }, orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, vendorRating: true, riderRating: true, productRating: true, comment: true, vendorResponse: true, vendorRespondedAt: true, createdAt: true },
    });
  }

  listForProduct(productId: string) {
    return this.prisma.review.findMany({ where: { productId }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, productRating: true, comment: true, vendorResponse: true, createdAt: true } });
  }

  async summaryForVendor(vendorId: string) {
    const rows = await this.prisma.review.findMany({ where: { vendorId }, select: { vendorRating: true, productRating: true, vendorResponse: true } });
    const vendorRatings = rows.map(r => r.vendorRating).filter((r): r is number => r != null);
    const productRatings = rows.map(r => r.productRating).filter((r): r is number => r != null);
    const distribution = [5,4,3,2,1].map(star => {
      const count = vendorRatings.filter(r => r === star).length;
      return { star, count, percentage: vendorRatings.length ? Number((count / vendorRatings.length * 100).toFixed(1)) : 0 };
    });
    return {
      count: vendorRatings.length,
      average: vendorRatings.length ? Number((vendorRatings.reduce((a,b)=>a+b,0)/vendorRatings.length).toFixed(2)) : 0,
      productAverage: productRatings.length ? Number((productRatings.reduce((a,b)=>a+b,0)/productRatings.length).toFixed(2)) : 0,
      productRatingCount: productRatings.length,
      responseCount: rows.filter(r => !!r.vendorResponse).length,
      responseRate: rows.length ? Number((rows.filter(r => !!r.vendorResponse).length / rows.length * 100).toFixed(1)) : 0,
      unansweredCount: rows.filter(r => !r.vendorResponse).length,
      distribution,
    };
  }

  async vendorOverview(ownerUserId: string, query: VendorReviewQueryDto) {
    const vendor = await this.getOwnedVendor(ownerUserId);
    const [summary, products, productRatings, recent] = await Promise.all([
      this.summaryForVendor(vendor.id),
      this.prisma.product.findMany({ where: { vendorId: vendor.id }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.review.groupBy({ where: { vendorId: vendor.id, productId: { not: null }, productRating: { not: null } }, by: ['productId'], _avg: { productRating: true }, _count: { productRating: true } }),
      this.listVendorReviews(vendor.id, { ...query, page: 1, pageSize: 8 }),
    ]);
    const ratingMap = new Map(productRatings.map(r => [r.productId!, { average: Number((r._avg.productRating || 0).toFixed(1)), count: r._count.productRating }]));
    return { vendor: { id: vendor.id, storeName: vendor.storeName }, summary, products: products.map(p => ({ ...p, rating: ratingMap.get(p.id) || { average: 0, count: 0 } })), recent: recent.items };
  }

  async listVendorReviews(ownerUserId: string, query: VendorReviewQueryDto) {
    const vendor = await this.getOwnedVendor(ownerUserId);
    return this.listVendorReviewsForVendor(vendor.id, query);
  }

  private async listVendorReviewsForVendor(vendorId: string, query: VendorReviewQueryDto) {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)));
    const where: any = { vendorId };
    if (query.rating) where.vendorRating = Number(query.rating);
    if (query.productId) where.productId = query.productId;
    if (query.responded !== undefined) where.vendorResponse = query.responded ? { not: null } : null;
    if (query.search) where.OR = [
      { comment: { contains: query.search, mode: 'insensitive' } },
      { customer: { fullName: { contains: query.search, mode: 'insensitive' } } },
    ];
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = this.parseDate(query.from, 'from');
      if (query.to) where.createdAt.lte = this.parseDate(query.to, 'to');
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page-1)*pageSize, take: pageSize,
        include: { customer: { select: { fullName: true } }, product: { select: { id: true, name: true } } },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total/pageSize) };
  }

  async respondToReview(ownerUserId: string, reviewId: string, dto: VendorReviewResponseDto) {
    const vendor = await this.getOwnedVendor(ownerUserId);
    const response = dto.response?.trim();
    if (!response) throw new BadRequestException('Response cannot be empty.');
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found.');
    if (review.vendorId !== vendor.id) throw new ConflictException('This review does not belong to your store.');
    if (review.vendorResponse) throw new BadRequestException('This review already has a vendor response.');
    const updated = await this.prisma.review.update({ where: { id: reviewId }, data: { vendorResponse: response, vendorRespondedAt: new Date() } });
    await this.audit.record({ actorId: ownerUserId, action: 'review.vendor_response', entityType: 'Review', entityId: reviewId, before: { vendorResponse: null }, after: { vendorResponse: response } });
    return updated;
  }

  private async getOwnedVendor(ownerUserId: string) {
    const vendor = await vendorForUser(this.prisma, ownerUserId);
    return { id: vendor.id, storeName: vendor.storeName };
  }

  private parseDate(value: string, label: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`Invalid ${label} date.`);
    return date;
  }
}
