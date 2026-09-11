import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { vendorForUser } from '../../common/utils/vendor-context';
import { AuditLogService } from '../audit/audit-log.service';
import { StorageService } from '../storage/storage.service';
import { PUBLIC_VENDOR_SELECT } from './vendor-public-select';
import { RegisterVendorDto, UpdateVendorProfileDto } from './dto/vendor.dto';
import { OrderStatus, VendorStatus } from '@prisma/client';

@Injectable()
export class VendorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly storage: StorageService,
  ) {}

  // §26: registering never makes a store live. It always starts PENDING.
  async register(ownerUserId: string, dto: RegisterVendorDto) {
    const existing = await this.prisma.vendor.findUnique({ where: { ownerUserId } });
    if (existing) {
      throw new ConflictException('This account already has a vendor profile.');
    }

    const serviceArea = await this.prisma.serviceArea.findUnique({
      where: { id: dto.serviceAreaId },
    });
    if (!serviceArea) throw new NotFoundException('Service area not found.');

    return this.prisma.vendor.create({
      data: {
        ownerUserId,
        vendorTypeId: dto.vendorTypeId,
        storeName: dto.storeName,
        description: dto.description,
        phone: dto.phone,
        email: dto.email,
        status: VendorStatus.PENDING,
        locations: {
          create: [{ serviceAreaId: dto.serviceAreaId, address: dto.address }],
        },
      },
      include: { locations: true },
    });
  }

  async getDashboard(ownerUserId: string) {
    const vendor = await this.getByOwner(ownerUserId);
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const start7Days = new Date(startToday);
    start7Days.setDate(start7Days.getDate() - 6);
    const startPrevious7Days = new Date(start7Days);
    startPrevious7Days.setDate(startPrevious7Days.getDate() - 7);

    const [
      productsCount,
      orders,
      reviewSummary,
      lowStockProducts,
    ] = await Promise.all([
      this.prisma.product.count({ where: { vendorId: vendor.id } }),
      this.prisma.order.findMany({
        where: { vendorId: vendor.id, createdAt: { gte: startPrevious7Days } },
        include: { customer: { select: { fullName: true } }, items: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.findMany({
        where: { vendorId: vendor.id, vendorRating: { not: null } },
        select: { vendorRating: true },
      }),
      this.prisma.product.findMany({
        where: { vendorId: vendor.id, isAvailable: true, inventory: { quantity: { lte: 10 } } },
        select: { id: true, name: true, inventory: { select: { quantity: true } } },
        orderBy: { name: 'asc' },
        take: 8,
      }),
    ]);

    const currentOrders = orders.filter((o) => o.createdAt >= start7Days);
    const previousOrders = orders.filter((o) => o.createdAt >= startPrevious7Days && o.createdAt < start7Days);
    const todayOrders = orders.filter((o) => o.createdAt >= startToday);
    const delivered = (rows: typeof orders) => rows.filter((o) => o.status === OrderStatus.DELIVERED);
    const todayDelivered = delivered(todayOrders);
    const currentDelivered = delivered(currentOrders);
    const previousDelivered = delivered(previousOrders);
    const startSameDayLastWeek = new Date(startToday);
    startSameDayLastWeek.setDate(startSameDayLastWeek.getDate() - 7);
    const endSameDayLastWeek = new Date(startSameDayLastWeek);
    endSameDayLastWeek.setDate(endSameDayLastWeek.getDate() + 1);
    const lastWeekSameDayOrders = orders.filter((o) => o.createdAt >= startSameDayLastWeek && o.createdAt < endSameDayLastWeek);
    const lastWeekSameDayDelivered = delivered(lastWeekSameDayOrders);

    const sum = (rows: typeof orders) => rows.reduce((total, row) => total + row.totalAmount, 0);
    const todaySales = sum(todayDelivered);
    const currentSales = sum(currentDelivered);
    const previousSales = sum(previousDelivered);
    const sameDayLastWeekSales = sum(lastWeekSameDayDelivered);
    const averageOrderValue = currentDelivered.length ? Math.round(currentSales / currentDelivered.length) : 0;
    const salesChange = sameDayLastWeekSales ? ((todaySales - sameDayLastWeekSales) / sameDayLastWeekSales) * 100 : null;
    const orderChange = lastWeekSameDayOrders.length ? ((todayOrders.length - lastWeekSameDayOrders.length) / lastWeekSameDayOrders.length) * 100 : null;

    const ratingValues = reviewSummary.map((r) => r.vendorRating!).filter((r) => r > 0);
    const rating = ratingValues.length
      ? Number((ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length).toFixed(1))
      : 0;

    const chart = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start7Days);
      date.setDate(start7Days.getDate() + index);
      const next = new Date(date);
      next.setDate(date.getDate() + 1);
      const rows = currentDelivered.filter((o) => o.createdAt >= date && o.createdAt < next);
      return {
        date: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString('en-NG', { weekday: 'short' }),
        revenue: sum(rows),
        orders: rows.length,
      };
    });

    const productMap = new Map<string, { name: string; orders: number; revenue: number }>();
    for (const order of currentDelivered) {
      for (const item of order.items) {
        const existing = productMap.get(item.productId) ?? { name: item.nameSnapshot, orders: 0, revenue: 0 };
        existing.orders += item.quantity;
        existing.revenue += item.subtotalAmount;
        productMap.set(item.productId, existing);
      }
    }
    const popularProducts = [...productMap.entries()]
      .map(([productId, value]) => ({ productId, ...value }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5);

    const orderActivity = {
      new: orders.filter((o) => o.status === OrderStatus.PENDING_VENDOR).length,
      preparing: orders.filter((o) => o.status === OrderStatus.PREPARING || o.status === OrderStatus.ACCEPTED).length,
      ready: orders.filter((o) => o.status === OrderStatus.READY_FOR_PICKUP).length,
      delivery: orders.filter((o) => new Set<OrderStatus>([OrderStatus.RIDER_SEARCHING, OrderStatus.RIDER_ASSIGNED, OrderStatus.RIDER_ARRIVED_PICKUP, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT, OrderStatus.RIDER_ARRIVED]).has(o.status)).length,
      completed: orders.filter((o) => o.status === OrderStatus.DELIVERED).length,
    };

    return {
      vendor: {
        id: vendor.id,
        storeName: vendor.storeName,
        status: vendor.status,
        isOpen: vendor.isOpen,
        vendorType: vendor.vendorType?.name ?? null,
      },
      metrics: {
        todaySales,
        todayOrders: todayOrders.length,
        pendingOrders: orders.filter((o) => o.status === OrderStatus.PENDING_VENDOR).length,
        completedOrders: todayDelivered.length,
        averageOrderValue,
        rating,
        reviewCount: ratingValues.length,
        productsCount,
        salesChange: salesChange == null ? null : Number(salesChange.toFixed(1)),
        orderChange: orderChange == null ? null : Number(orderChange.toFixed(1)),
      },
      chart,
      orderActivity,
      popularProducts,
      lowStockProducts: lowStockProducts.map((p) => ({ id: p.id, name: p.name, quantity: p.inventory?.quantity ?? 0 })),
      recentOrders: orders.slice(0, 8).map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customer?.fullName ?? 'Customer',
        status: o.status,
        totalAmount: o.totalAmount,
        createdAt: o.createdAt,
      })),
    };
  }

  async getByOwner(ownerUserId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { ownerUserId },
      include: { locations: { include: { serviceArea: true } }, vendorType: true },
    });
    if (!vendor) throw new NotFoundException('No vendor profile found for this account.');
    return vendor;
  }

  async updateProfile(ownerUserId: string, dto: UpdateVendorProfileDto) {
    const vendor = await this.getByOwner(ownerUserId);
    const data: any = { ...dto };
    delete data.address;
    if (dto.logoUrl !== undefined) {
      data.logoUrl = dto.logoUrl === null ? null : await this.storage.getOwnedPublicImageUrl(ownerUserId, dto.logoUrl);
    }
    if (dto.coverImageUrl !== undefined) {
      data.coverImageUrl = dto.coverImageUrl === null ? null : await this.storage.getOwnedPublicImageUrl(ownerUserId, dto.coverImageUrl);
    }
    if (dto.minimumOrderAmount != null) data.minimumOrderAmount = Math.round(dto.minimumOrderAmount);
    const updated = await this.prisma.vendor.update({ where: { id: vendor.id }, data });
    if (dto.address !== undefined && vendor.locations[0]) {
      await this.prisma.vendorLocation.update({ where: { id: vendor.locations[0].id }, data: { address: dto.address } });
    }
    return this.getByOwner(ownerUserId);
  }

  async setOpenStatus(ownerUserId: string, isOpen: boolean) {
    const vendor = await this.getByOwner(ownerUserId);
    if (vendor.status !== VendorStatus.APPROVED) {
      throw new ForbiddenException('Only approved vendors can open for orders.');
    }
    return this.prisma.vendor.update({ where: { id: vendor.id }, data: { isOpen } });
  }

  async setTemporaryClosure(ownerUserId: string, until: string | null) {
    const vendor = await this.getByOwner(ownerUserId);
    const date = until ? new Date(until) : null;
    if (date && Number.isNaN(date.getTime())) throw new BadRequestException('Invalid closure date.');
    if (date && date <= new Date()) throw new BadRequestException('Closure must end in the future.');
    return this.prisma.vendor.update({ where: { id: vendor.id }, data: { temporaryClosureUntil: date, isOpen: false } });
  }

  async setOperationalMode(ownerUserId: string, mode: 'holiday' | 'busy', enabled: boolean, busyPreparationTimeMinutes?: number) {
    const vendor = await this.getByOwner(ownerUserId);
    if (mode === 'busy') {
      return this.prisma.vendor.update({ where: { id: vendor.id }, data: { busyMode: enabled, busyPreparationTimeMinutes: enabled ? busyPreparationTimeMinutes ?? vendor.busyPreparationTimeMinutes : null } });
    }
    return this.prisma.vendor.update({ where: { id: vendor.id }, data: { holidayMode: enabled, ...(enabled ? { isOpen: false } : {}) } });
  }

  async uploadDocument(ownerUserId: string, docType: string, fileUrl: string) {
    const vendor = await this.getByOwner(ownerUserId);
    if (!docType?.trim() || !fileUrl?.trim()) throw new BadRequestException('Document type and file URL are required.');
    return this.prisma.vendorDocument.create({ data: { vendorId: vendor.id, docType, fileUrl } });
  }

  async setDeliveryModels(ownerUserId: string, models: import('@prisma/client').DeliveryModel[]) {
    const vendor = await this.getByOwner(ownerUserId);
    if (!models?.length) throw new BadRequestException('Select at least one delivery model.');
    return this.prisma.vendor.update({ where: { id: vendor.id }, data: { supportedDeliveryModels: models } });
  }

  async addServiceArea(ownerUserId: string, serviceAreaId: string, address?: string) {
    const vendor = await this.getByOwner(ownerUserId);
    const serviceArea = await this.prisma.serviceArea.findUnique({ where: { id: serviceAreaId } });
    if (!serviceArea) throw new NotFoundException('Service area not found.');

    return this.prisma.vendorLocation.upsert({
      where: { vendorId_serviceAreaId: { vendorId: vendor.id, serviceAreaId } },
      update: { address },
      create: { vendorId: vendor.id, serviceAreaId, address },
    });
  }

  async getVendorAnalytics(ownerUserId: string, from?: string, to?: string) {
    const vendor = await vendorForUser(this.prisma, ownerUserId);
    const end = to ? new Date(to) : new Date();
    const start = from ? new Date(from) : new Date(end.getTime() - 29 * 86400000);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) throw new BadRequestException('Invalid analytics date range.');
    const where = { vendorId: vendor.id, createdAt: { gte: start, lte: end } };
    const [orders, deliveredAgg, statusCounts, productRows, dailyRows, reviews] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.aggregate({ where: { ...where, status: OrderStatus.DELIVERED }, _sum: { totalAmount: true }, _avg: { totalAmount: true } }),
      this.prisma.order.groupBy({ by: ['status'], where, _count: { id: true } }),
      this.prisma.orderItem.groupBy({ by: ['productId','nameSnapshot'], where: { order: { vendorId: vendor.id, createdAt: { gte: start, lte: end }, status: OrderStatus.DELIVERED } }, _sum: { quantity: true, subtotalAmount: true }, orderBy: { _sum: { subtotalAmount: 'desc' } }, take: 8 }),
      this.prisma.order.findMany({ where: { ...where, status: OrderStatus.DELIVERED }, select: { createdAt: true, totalAmount: true } }),
      this.prisma.review.findMany({ where: { vendorId: vendor.id, createdAt: { gte: start, lte: end }, vendorRating: { not: null } }, select: { vendorRating: true } }),
    ]);
    const delivered = statusCounts.find(x=>x.status===OrderStatus.DELIVERED)?._count.id ?? 0;
    const cancelled = statusCounts.find(x=>x.status===OrderStatus.CANCELLED)?._count.id ?? 0;
    const failed = statusCounts.find(x=>x.status===OrderStatus.FAILED)?._count.id ?? 0;
    const ratingValues = reviews.map(r=>r.vendorRating!).filter(Boolean);
    const daily = new Map<string,{orders:number;revenue:number}>();
    for (const row of dailyRows) { const k=new Date(row.createdAt).toISOString().slice(0,10); const v=daily.get(k)||{orders:0,revenue:0}; v.orders++; v.revenue+=row.totalAmount; daily.set(k,v); }
    return { range:{from:start.toISOString(),to:end.toISOString()}, summary:{orders,delivered,cancelled,failed,pending:Math.max(0,orders-delivered-cancelled-failed),revenue:deliveredAgg._sum.totalAmount??0,averageOrderValue:Math.round(deliveredAgg._avg.totalAmount??0),rating:ratingValues.length?Number((ratingValues.reduce((a,b)=>a+b,0)/ratingValues.length).toFixed(1)):0,reviewCount:ratingValues.length}, topProducts:productRows.map(p=>({productId:p.productId,name:p.nameSnapshot,quantitySold:p._sum.quantity??0,revenue:p._sum.subtotalAmount??0})), daily:Array.from(daily.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([date,v])=>({date,...v})), statuses:statusCounts.map(x=>({status:x.status,count:x._count.id})) };
  }

  async getVendorCustomers(ownerUserId: string, search?: string, status?: string) {
    const vendor = await vendorForUser(this.prisma, ownerUserId); const where:any={vendorId:vendor.id};
    if(status==='delivered') where.status=OrderStatus.DELIVERED; if(status==='cancelled') where.status=OrderStatus.CANCELLED;
    const orders=await this.prisma.order.findMany({where,orderBy:{createdAt:'desc'},take:1000,select:{customerId:true,status:true,totalAmount:true,createdAt:true,customer:{select:{id:true,fullName:true,email:true,phone:true}}}});
    const map=new Map<string,any>(); const q=search?.toLowerCase().trim();
    for(const o of orders){if(q&&!`${o.customer.fullName} ${o.customer.email||''} ${o.customer.phone||''}`.toLowerCase().includes(q))continue;const c=map.get(o.customerId)||{id:o.customer.id,fullName:o.customer.fullName,email:o.customer.email,phone:o.customer.phone,orderCount:0,deliveredOrders:0,totalSpent:0,firstOrderAt:o.createdAt,lastOrderAt:o.createdAt};c.orderCount++;if(o.status===OrderStatus.DELIVERED){c.deliveredOrders++;c.totalSpent+=o.totalAmount}if(o.createdAt<c.firstOrderAt)c.firstOrderAt=o.createdAt;if(o.createdAt>c.lastOrderAt)c.lastOrderAt=o.createdAt;map.set(o.customerId,c)}
    const items=Array.from(map.values()).sort((a,b)=>b.totalSpent-a.totalSpent); return {items,total:items.length};
  }

  async updateVendorSettings(ownerUserId: string, dto: UpdateVendorProfileDto) {
    const vendor=await vendorForUser(this.prisma, ownerUserId); const data:any={};
    for(const key of ['storeName','description','logoUrl','coverImageUrl','phone','operatingHoursStart','operatingHoursEnd','supportedDeliveryModels','deliveryRadiusKm','minimumOrderAmount','averagePreparationTimeMinutes','holidayMode','busyMode','busyPreparationTimeMinutes','operatingHoursJson']) if((dto as any)[key]!==undefined)data[key]=(dto as any)[key];
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl === null ? null : await this.storage.getOwnedPublicImageUrl(ownerUserId, dto.logoUrl);
    if (dto.coverImageUrl !== undefined) data.coverImageUrl = dto.coverImageUrl === null ? null : await this.storage.getOwnedPublicImageUrl(ownerUserId, dto.coverImageUrl);
    if((dto as any).address!==undefined) await this.prisma.vendorLocation.updateMany({where:{vendorId:vendor.id},data:{address:(dto as any).address}});
    return this.prisma.vendor.update({where:{id:vendor.id},data});
  }

  // ---- Public / customer-facing: vendors visible in a given service area ----
  // This is the query that enforces §65 (location isolation) and §85
  // (location-driven search): a customer in service area A never sees a
  // vendor that hasn't explicitly been assigned to A.
  async listForServiceArea(serviceAreaId: string) {
    return this.prisma.vendor.findMany({
      where: {
        status: VendorStatus.APPROVED,
        locations: { some: { serviceAreaId } },
      },
      select: PUBLIC_VENDOR_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPublicVendor(vendorId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, status: VendorStatus.APPROVED },
      select: { ...PUBLIC_VENDOR_SELECT, products: { where: { isAvailable: true } } },
    });
    if (!vendor) throw new NotFoundException('Vendor not found.');
    return vendor;
  }

  // ---- Admin: approval workflow (§26) ----

  async listAdmin(status?: import('@prisma/client').VendorStatus) {
    return this.prisma.vendor.findMany({
      where: status ? { status } : undefined,
      select: {
        id: true, storeName: true, status: true, isOpen: true, commissionRate: true,
        supportedDeliveryModels: true, createdAt: true, updatedAt: true,
        vendorType: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true, email: true, phone: true } },
        locations: { select: { serviceArea: { select: { id: true, name: true, status: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPending() {
    return this.prisma.vendor.findMany({
      where: { status: VendorStatus.PENDING },
      include: { locations: true, vendorType: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approve(vendorId: string, actorId: string) {
    const before = await this.getVendorOrThrow(vendorId);
    const updated = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: { status: VendorStatus.APPROVED },
    });
    await this.auditLog.record({
      actorId,
      action: 'vendor.approve',
      entityType: 'Vendor',
      entityId: vendorId,
      before: { status: before.status },
      after: { status: updated.status },
    });
    return updated;
  }

  async reject(vendorId: string, actorId: string, reason?: string) {
    const before = await this.getVendorOrThrow(vendorId);
    // `reason` is intentionally not persisted on the Vendor row yet — no
    // field for it in Phase 2's schema. It IS captured in the audit log
    // below, which is better than dropping it entirely, but a
    // `rejectionReason` column (or routing it through Support/
    // notifications) is still worth adding before relying on this in
    // production.
    const updated = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: { status: VendorStatus.REJECTED },
    });
    await this.auditLog.record({
      actorId,
      action: 'vendor.reject',
      entityType: 'Vendor',
      entityId: vendorId,
      before: { status: before.status },
      after: { status: updated.status, reason },
    });
    return updated;
  }

  async suspend(vendorId: string, actorId: string) {
    const before = await this.getVendorOrThrow(vendorId);
    const updated = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: { status: VendorStatus.SUSPENDED, isOpen: false },
    });
    await this.auditLog.record({
      actorId,
      action: 'vendor.suspend',
      entityType: 'Vendor',
      entityId: vendorId,
      before: { status: before.status },
      after: { status: updated.status },
    });
    return updated;
  }

  private async getVendorOrThrow(id: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found.');
    return vendor;
  }

  // ---- Vendor types (§8) ----

  async listVendorTypes() {
    return this.prisma.vendorType.findMany({ where: { isActive: true } });
  }

  async createVendorType(name: string) {
    if (!name?.trim()) throw new BadRequestException('Vendor type name is required.');
    return this.prisma.vendorType.create({ data: { name } });
  }
}
