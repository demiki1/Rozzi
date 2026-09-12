import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/config/prisma.service';
import { SettingsAdminService } from '../../src/modules/settings/settings.service';
import { PricingService } from '../../src/modules/pricing/pricing.service';
import { OrdersService } from '../../src/modules/orders/orders.service';
import { LedgerService } from '../../src/modules/finance/ledger.service';
import { AdminRole, OrderDeliveryType, OrderStatus, UserRole } from '@prisma/client';

describe('Admin settings propagation e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let settings: SettingsAdminService;
  let pricing: PricingService;
  let orders: OrdersService;
  let ledger: LedgerService;
  let adminActorId: string;
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    settings = app.get(SettingsAdminService);
    pricing = app.get(PricingService);
    orders = app.get(OrdersService);
    ledger = app.get(LedgerService);
    const actor = await prisma.user.create({ data: { fullName: 'Admin Flow Actor', email: `actor-${unique}@example.com`, passwordHash: 'test-only', role: UserRole.ADMIN, adminRole: AdminRole.SUPER_ADMIN } });
    adminActorId = actor.id;
  });

  afterAll(async () => { await app.close(); });

  it('persists an admin operational setting', async () => {
    const before = await prisma.setting.findUnique({ where: { key: 'ordersEnabled' } });
    await settings.updateMany({ ordersEnabled: false } as any, adminActorId);
    const stored = await prisma.setting.findUnique({ where: { key: 'ordersEnabled' } });
    expect(stored?.value).toBe(false);
    expect(before?.value).not.toBe(stored?.value);
    await settings.updateMany({ ordersEnabled: true } as any, adminActorId);
  });

  it('propagates pricing configuration into a new order and then into the ledger payout', async () => {
    const country = await prisma.location.create({ data: { type: 'COUNTRY', name: `AdminFlowCountry-${unique}` } });
    const state = await prisma.location.create({ data: { type: 'STATE', name: `AdminFlowState-${unique}`, parentId: country.id } });
    const area = await prisma.serviceArea.create({ data: { locationId: state.id, name: `AdminFlowArea-${unique}`, status: 'ACTIVE', minimumOrderAmount: 0, baseDeliveryFee: 10_000, serviceFeeAmount: 0 } });

    const admin = await prisma.user.findUniqueOrThrow({ where: { id: adminActorId } });
    const customer = await prisma.user.create({ data: { fullName: 'Admin Flow Customer', email: `customer-${unique}@example.com`, passwordHash: 'test-only', role: UserRole.CUSTOMER } });
    const vendorOwner = await prisma.user.create({ data: { fullName: 'Admin Flow Vendor', email: `vendor-${unique}@example.com`, passwordHash: 'test-only', role: UserRole.VENDOR } });
    const riderOwner = await prisma.user.create({ data: { fullName: 'Admin Flow Rider', email: `rider-${unique}@example.com`, passwordHash: 'test-only', role: UserRole.RIDER } });

    const vendorType = await prisma.vendorType.create({ data: { name: `AdminFlowVendorType-${unique}` } });
    const vendor = await prisma.vendor.create({ data: { ownerUserId: vendorOwner.id, vendorTypeId: vendorType.id, storeName: `Admin Flow Store ${unique}`, status: 'APPROVED', isOpen: true } });
    await prisma.vendorLocation.create({ data: { vendorId: vendor.id, serviceAreaId: area.id, latitude: 6.5000000, longitude: 7.5000000 } });

    const category = await prisma.category.create({ data: { name: `AdminFlowCategory-${unique}` } });
    const product = await prisma.product.create({ data: { vendorId: vendor.id, categoryId: category.id, name: `Admin Flow Product ${unique}`, priceAmount: 100_000, isAvailable: true } });
    await prisma.inventory.create({ data: { productId: product.id, quantity: 5 } });

    await prisma.cart.create({ data: { customerId: customer.id, vendorId: vendor.id, items: { create: { productId: product.id, quantity: 1 } } } });
    const address = await prisma.address.create({ data: { customerId: customer.id, label: 'Home', addressText: 'Admin Flow Street', latitude: 6.5000000, longitude: 7.5000000 } });
    await prisma.commissionConfig.create({ data: { defaultRatePercent: 10, isActive: true } });

    const updated = await pricing.updateConfig(area.id, {
      serviceFeeRatePercent: 0,
      serviceFeeCapAmount: 100_000,
      baseDeliveryFee: 10_000,
      perKmDeliveryFee: 0,
      deliveryRadiusKm: 8,
      riderPayoutRatePercent: 90,
      surgeEnabled: false,
      surgeLevel: 'NORMAL',
      surgeSlightlyHighAmount: 0,
      surgeHighAmount: 0,
      surgeVeryHighAmount: 0,
    }, admin.id);

    const dbConfig = await prisma.pricingConfig.findUnique({ where: { id: updated.id } });
    expect(dbConfig?.isActive).toBe(true);
    expect(Number(dbConfig?.riderPayoutRatePercent)).toBe(90);

    const order = await orders.checkout(customer.id, { serviceAreaId: area.id, deliveryType: OrderDeliveryType.DELIVERY, addressId: address.id });
    expect(order.pricingConfigId).toBe(updated.id);
    expect(Number(order.riderPayoutRateSnapshot)).toBe(90);
    expect(order.deliveryFeeAmount).toBe(10_000);

    const rider = await prisma.rider.create({ data: { ownerUserId: riderOwner.id, vehicleType: 'MOTORCYCLE', status: 'APPROVED', isOnline: true } });
    await prisma.delivery.create({ data: { orderId: order.id, riderId: rider.id, assignedAt: new Date(), deliveredAt: new Date() } });
    await prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.DELIVERED } });

    await ledger.onOrderTransitioned({ orderId: order.id, orderNumber: order.orderNumber, customerId: customer.id, vendorId: vendor.id, fromStatus: OrderStatus.IN_TRANSIT, toStatus: OrderStatus.DELIVERED, deliveryType: 'DELIVERY' });

    const riderEntry = await prisma.ledgerEntry.findFirst({ where: { accountType: 'RIDER', accountId: rider.id, orderId: order.id, type: 'RIDER_EARNING' } });
    expect(riderEntry?.amount).toBe(9_000);
  });
});
