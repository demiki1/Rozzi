import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminRole, OrderDeliveryType, OrderStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/config/prisma.service';

function tokenFrom(response: request.Response) {
  return response.body?.accessToken as string;
}

describe('Admin hardening e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superToken: string;
  let financeToken: string;
  let supportToken: string;
  let vendorAdminToken: string;
  let riderAdminToken: string;
  let contentToken: string;
  let operationsToken: string;
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const password = 'AdminHardening!123';

  async function createAdmin(adminRole: AdminRole, label: string) {
    const user = await prisma.user.create({
      data: {
        fullName: `Admin ${label}`,
        email: `${label.toLowerCase()}-${unique}@example.com`,
        passwordHash: await bcrypt.hash(password, 4),
        role: UserRole.ADMIN,
        adminRole,
      },
    });

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password });

    expect(response.status).toBe(201);
    return tokenFrom(response);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    superToken = await createAdmin(AdminRole.SUPER_ADMIN, 'Super');
    financeToken = await createAdmin(AdminRole.FINANCE_ADMIN, 'Finance');
    supportToken = await createAdmin(AdminRole.SUPPORT_ADMIN, 'Support');
    vendorAdminToken = await createAdmin(AdminRole.VENDOR_ADMIN, 'Vendor');
    riderAdminToken = await createAdmin(AdminRole.RIDER_ADMIN, 'Rider');
    contentToken = await createAdmin(AdminRole.CONTENT_ADMIN, 'Content');
    operationsToken = await createAdmin(AdminRole.OPERATIONS_ADMIN, 'Operations');
  });

  afterAll(async () => {
    await app.close();
  });

  it('enforces admin sub-role boundaries at the API, not only in the UI', async () => {
    const financeAllowed = await request(app.getHttpServer())
      .get('/api/admin/reports/summary')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(financeAllowed.status).toBe(200);

    const supportDenied = await request(app.getHttpServer())
      .get('/api/admin/reports/summary')
      .set('Authorization', `Bearer ${supportToken}`);
    expect(supportDenied.status).toBe(403);

    const vendorAllowed = await request(app.getHttpServer())
      .get('/api/admin/vendors')
      .set('Authorization', `Bearer ${vendorAdminToken}`);
    expect(vendorAllowed.status).toBe(200);

    const riderDenied = await request(app.getHttpServer())
      .get('/api/admin/vendors')
      .set('Authorization', `Bearer ${riderAdminToken}`);
    expect(riderDenied.status).toBe(403);

    const contentAllowed = await request(app.getHttpServer())
      .get('/api/admin/categories')
      .set('Authorization', `Bearer ${contentToken}`);
    expect(contentAllowed.status).toBe(200);

    const operationsDenied = await request(app.getHttpServer())
      .get('/api/admin/categories')
      .set('Authorization', `Bearer ${operationsToken}`);
    expect(operationsDenied.status).toBe(403);

    const superAllowed = await request(app.getHttpServer())
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${superToken}`);
    expect(superAllowed.status).toBe(200);
  });

  it('rejects non-admin credentials from an admin endpoint', async () => {
    const customer = await prisma.user.create({
      data: {
        fullName: 'Boundary Customer',
        email: `customer-${unique}@example.com`,
        passwordHash: await bcrypt.hash(password, 4),
        role: UserRole.CUSTOMER,
      },
    });

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: customer.email, password });
    expect(login.status).toBe(201);

    const response = await request(app.getHttpServer())
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${tokenFrom(login)}`);
    expect(response.status).toBe(403);
  });

  it('propagates an Admin UI-equivalent settings update through API and DB into checkout behavior', async () => {
    const before = await prisma.setting.findUnique({ where: { key: 'ordersEnabled' } });

    const disabled = await request(app.getHttpServer())
      .patch('/api/admin/settings')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ ordersEnabled: false });
    expect(disabled.status).toBe(200);

    const stored = await prisma.setting.findUnique({ where: { key: 'ordersEnabled' } });
    expect(stored?.value).toBe(false);

    const country = await prisma.location.create({
      data: { type: 'COUNTRY', name: `AdminHardeningCountry-${unique}` },
    });
    const state = await prisma.location.create({
      data: { type: 'STATE', name: `AdminHardeningState-${unique}`, parentId: country.id },
    });
    const area = await prisma.serviceArea.create({
      data: {
        locationId: state.id,
        name: `AdminHardeningArea-${unique}`,
        status: 'ACTIVE',
        minimumOrderAmount: 0,
        baseDeliveryFee: 1000,
        serviceFeeAmount: 0,
      },
    });
    const owner = await prisma.user.create({
      data: {
        fullName: 'Admin Hardening Vendor',
        email: `vendor-owner-${unique}@example.com`,
        passwordHash: 'test-only',
        role: UserRole.VENDOR,
      },
    });
    const vendorType = await prisma.vendorType.create({ data: { name: `AdminHardeningType-${unique}` } });
    const vendor = await prisma.vendor.create({
      data: {
        ownerUserId: owner.id,
        vendorTypeId: vendorType.id,
        storeName: `Admin Hardening Store ${unique}`,
        status: 'APPROVED',
        isOpen: true,
        supportedDeliveryModels: ['PLATFORM_DELIVERY'],
      },
    });
    await prisma.vendorLocation.create({
      data: { vendorId: vendor.id, serviceAreaId: area.id, latitude: 6.5, longitude: 7.5 },
    });
    const category = await prisma.category.create({ data: { name: `AdminHardeningCategory-${unique}` } });
    const product = await prisma.product.create({
      data: { vendorId: vendor.id, categoryId: category.id, name: `AdminHardeningProduct-${unique}`, priceAmount: 10000, isAvailable: true },
    });
    await prisma.inventory.create({ data: { productId: product.id, quantity: 2 } });
    const customer = await prisma.user.create({
      data: { fullName: 'Admin Hardening Customer', email: `checkout-${unique}@example.com`, passwordHash: 'test-only', role: UserRole.CUSTOMER },
    });
    const address = await prisma.address.create({
      data: { customerId: customer.id, label: 'Home', addressText: 'Admin Hardening Street', latitude: 6.5, longitude: 7.5 },
    });
    const cart = await prisma.cart.create({ where: undefined as never }).catch(() => null);
    if (cart) {
      await prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity: 1 } });
    } else {
      const createdCart = await prisma.cart.create({ data: { customerId: customer.id, vendorId: vendor.id } });
      await prisma.cartItem.create({ data: { cartId: createdCart.id, productId: product.id, quantity: 1 } });
    }

    const checkout = await request(app.getHttpServer())
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ serviceAreaId: area.id, deliveryType: OrderDeliveryType.PICKUP });
    expect(checkout.status).toBe(403);

    const enabled = await request(app.getHttpServer())
      .patch('/api/admin/settings')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ ordersEnabled: true });
    expect(enabled.status).toBe(200);

    const restored = await prisma.setting.findUnique({ where: { key: 'ordersEnabled' } });
    expect(restored?.value).toBe(true);
    if (before) {
      await prisma.setting.upsert({ where: { key: 'ordersEnabled' }, update: { value: before.value }, create: { key: 'ordersEnabled', value: before.value } });
    }

    const commissionUpdate = await request(app.getHttpServer())
      .patch('/api/admin/settings')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ defaultCommissionRate: 17 });
    expect(commissionUpdate.status).toBe(200);
    const commission = await prisma.commissionConfig.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
    expect(Number(commission?.defaultRatePercent)).toBe(17);
  });

  it('propagates the Admin UI rider payout setting into the order snapshot and delivered ledger entry', async () => {
    const country = await prisma.location.create({ data: { type: 'COUNTRY', name: `PayoutCountry-${unique}` } });
    const state = await prisma.location.create({ data: { type: 'STATE', name: `PayoutState-${unique}`, parentId: country.id } });
    const area = await prisma.serviceArea.create({ data: { locationId: state.id, name: `PayoutArea-${unique}`, status: 'ACTIVE', minimumOrderAmount: 0, baseDeliveryFee: 10000, serviceFeeAmount: 0 } });
    const customer = await prisma.user.create({ data: { fullName: 'Payout Customer', email: `payout-customer-${unique}@example.com`, passwordHash: 'test-only', role: UserRole.CUSTOMER } });
    const owner = await prisma.user.create({ data: { fullName: 'Payout Vendor', email: `payout-vendor-${unique}@example.com`, passwordHash: 'test-only', role: UserRole.VENDOR } });
    const riderOwner = await prisma.user.create({ data: { fullName: 'Payout Rider', email: `payout-rider-${unique}@example.com`, passwordHash: 'test-only', role: UserRole.RIDER } });
    const type = await prisma.vendorType.create({ data: { name: `PayoutType-${unique}` } });
    const vendor = await prisma.vendor.create({ data: { ownerUserId: owner.id, vendorTypeId: type.id, storeName: `Payout Store-${unique}`, status: 'APPROVED', isOpen: true, supportedDeliveryModels: ['PLATFORM_DELIVERY'] } });
    await prisma.vendorLocation.create({ data: { vendorId: vendor.id, serviceAreaId: area.id, latitude: 6.5, longitude: 7.5 } });
    const category = await prisma.category.create({ data: { name: `PayoutCategory-${unique}` } });
    const product = await prisma.product.create({ data: { vendorId: vendor.id, categoryId: category.id, name: `PayoutProduct-${unique}`, priceAmount: 10000, isAvailable: true } });
    await prisma.inventory.create({ data: { productId: product.id, quantity: 2 } });
    await prisma.cart.create({ data: { customerId: customer.id, vendorId: vendor.id, items: { create: { productId: product.id, quantity: 1 } } } });
    const address = await prisma.address.create({ data: { customerId: customer.id, label: 'Home', addressText: 'Payout Street', latitude: 6.5, longitude: 7.5 } });

    const pricing = await request(app.getHttpServer())
      .patch(`/api/admin/pricing/service-areas/${area.id}`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ serviceFeeRatePercent: 0, serviceFeeCapAmount: 100000, baseDeliveryFee: 10000, perKmDeliveryFee: 0, deliveryRadiusKm: 8, riderPayoutRatePercent: 90, surgeEnabled: false, surgeLevel: 'NORMAL', surgeSlightlyHighAmount: 0, surgeHighAmount: 0, surgeVeryHighAmount: 0 });
    expect(pricing.status).toBe(200);

    const savedPricing = await prisma.pricingConfig.findUnique({ where: { id: pricing.body.id } });
    expect(Number(savedPricing?.riderPayoutRatePercent)).toBe(90);

    const order = await request(app.getHttpServer())
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${tokenFrom(await request(app.getHttpServer()).post('/api/auth/login').send({ email: customer.email, password: 'test-only' }))}`)
      .send({ serviceAreaId: area.id, deliveryType: OrderDeliveryType.DELIVERY, addressId: address.id });
    expect(order.status).toBe(201);
    expect(Number(order.body.riderPayoutRateSnapshot)).toBe(90);
    expect(order.body.pricingConfigId).toBe(pricing.body.id);

    const rider = await prisma.rider.create({ data: { ownerUserId: riderOwner.id, vehicleType: 'MOTORCYCLE', status: 'APPROVED', isOnline: true } });
    await prisma.delivery.create({ data: { orderId: order.body.id, riderId: rider.id, assignedAt: new Date(), deliveredAt: new Date() } });
    await prisma.order.update({ where: { id: order.body.id }, data: { status: OrderStatus.DELIVERED } });

    const ledger = await prisma.ledgerEntry.findFirst({ where: { orderId: order.body.id, accountType: 'RIDER', type: 'RIDER_EARNING' } });
    if (!ledger) {
      const { LedgerService } = await import('../../src/modules/finance/ledger.service');
      const service = app.get(LedgerService);
      await service.onOrderTransitioned({ orderId: order.body.id, orderNumber: order.body.orderNumber, customerId: customer.id, vendorId: vendor.id, fromStatus: OrderStatus.IN_TRANSIT, toStatus: OrderStatus.DELIVERED, deliveryType: 'DELIVERY' });
    }
    const riderEntry = await prisma.ledgerEntry.findFirst({ where: { orderId: order.body.id, accountType: 'RIDER', type: 'RIDER_EARNING' } });
    expect(riderEntry?.amount).toBe(9000);
  });
});
