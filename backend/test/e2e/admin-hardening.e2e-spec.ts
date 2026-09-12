import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminRole, DeliveryModel, OrderDeliveryType, OrderStatus, UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/config/prisma.service';
import { LedgerService } from '../../src/modules/finance/ledger.service';

function tokenFrom(response: request.Response) {
  return response.body?.accessToken as string;
}

describe('Admin hardening e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let ledger: LedgerService;
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
    return prisma.user.create({ data: { fullName: `Admin ${label}`, email: `${label.toLowerCase()}-${unique}@example.com`, passwordHash: await bcrypt.hash(password, 4), role: UserRole.ADMIN, adminRole } });
  }

  function signToken(user: { id: string; role: UserRole }) {
    return jwt.sign({ sub: user.id, role: user.role }, { secret: process.env.JWT_ACCESS_SECRET });
  }

  async function createUser(role: UserRole, label: string) {
    const user = await prisma.user.create({ data: { fullName: label, email: `${label.toLowerCase().replace(/\s+/g, '-')}-${unique}@example.com`, passwordHash: await bcrypt.hash(password, 4), role } });
    return { user, token: signToken(user) };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    ledger = app.get(LedgerService);

    const superAdmin = await createAdmin(AdminRole.SUPER_ADMIN, 'Super');
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email: superAdmin.email, password });
    expect(login.status).toBe(201);
    superToken = tokenFrom(login);

    financeToken = signToken(await createAdmin(AdminRole.FINANCE_ADMIN, 'Finance'));
    supportToken = signToken(await createAdmin(AdminRole.SUPPORT_ADMIN, 'Support'));
    vendorAdminToken = signToken(await createAdmin(AdminRole.VENDOR_ADMIN, 'Vendor'));
    riderAdminToken = signToken(await createAdmin(AdminRole.RIDER_ADMIN, 'Rider'));
    contentToken = signToken(await createAdmin(AdminRole.CONTENT_ADMIN, 'Content'));
    operationsToken = signToken(await createAdmin(AdminRole.OPERATIONS_ADMIN, 'Operations'));
  });

  afterAll(async () => { await app.close(); });

  it('enforces admin sub-role boundaries at the API, not only in the UI', async () => {
    expect((await request(app.getHttpServer()).get('/api/admin/reports/summary').set('Authorization', `Bearer ${financeToken}`)).status).toBe(200);
    expect((await request(app.getHttpServer()).get('/api/admin/reports/summary').set('Authorization', `Bearer ${supportToken}`)).status).toBe(403);
    expect((await request(app.getHttpServer()).get('/api/admin/vendors').set('Authorization', `Bearer ${vendorAdminToken}`)).status).toBe(200);
    expect((await request(app.getHttpServer()).get('/api/admin/vendors').set('Authorization', `Bearer ${riderAdminToken}`)).status).toBe(403);
    expect((await request(app.getHttpServer()).get('/api/admin/categories').set('Authorization', `Bearer ${contentToken}`)).status).toBe(200);
    expect((await request(app.getHttpServer()).get('/api/admin/categories').set('Authorization', `Bearer ${operationsToken}`)).status).toBe(403);
    expect((await request(app.getHttpServer()).get('/api/admin/settings').set('Authorization', `Bearer ${superToken}`)).status).toBe(200);
  });

  it('rejects non-admin credentials from an admin endpoint', async () => {
    const { token } = await createUser(UserRole.CUSTOMER, 'Boundary Customer');
    const response = await request(app.getHttpServer()).get('/api/admin/settings').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
  });

  it('propagates Admin UI settings through API and DB into checkout behavior', async () => {
    const beforeOrders = await prisma.setting.findUnique({ where: { key: 'ordersEnabled' } });
    const beforeOrdersEnabled = beforeOrders?.value === false ? false : true;
    const beforeMinimum = await prisma.setting.findUnique({ where: { key: 'minimumOrderAmount' } });
    const beforeMinimumAmount = typeof beforeMinimum?.value === 'number' ? beforeMinimum.value : Number(beforeMinimum?.value ?? 0);

    const disabled = await request(app.getHttpServer()).patch('/api/admin/settings').set('Authorization', `Bearer ${superToken}`).send({ ordersEnabled: false });
    expect(disabled.status).toBe(200);
    expect((await prisma.setting.findUnique({ where: { key: 'ordersEnabled' } }))?.value).toBe(false);

    const country = await prisma.location.create({ data: { type: 'COUNTRY', name: `AdminHardeningCountry-${unique}` } });
    const state = await prisma.location.create({ data: { type: 'STATE', name: `AdminHardeningState-${unique}`, parentId: country.id } });
    const area = await prisma.serviceArea.create({ data: { locationId: state.id, name: `AdminHardeningArea-${unique}`, status: 'ACTIVE', minimumOrderAmount: 0, baseDeliveryFee: 1000, serviceFeeAmount: 0 } });
    const vendorOwner = await createUser(UserRole.VENDOR, 'Admin Hardening Vendor');
    const vendorType = await prisma.vendorType.create({ data: { name: `AdminHardeningType-${unique}` } });
    const vendor = await prisma.vendor.create({ data: { ownerUserId: vendorOwner.user.id, vendorTypeId: vendorType.id, storeName: `Admin Hardening Store ${unique}`, status: 'APPROVED', isOpen: true, supportedDeliveryModels: [DeliveryModel.PLATFORM_DELIVERY, DeliveryModel.CUSTOMER_PICKUP] } });
    await prisma.vendorLocation.create({ data: { vendorId: vendor.id, serviceAreaId: area.id, latitude: 6.5, longitude: 7.5 } });
    const category = await prisma.category.create({ data: { name: `AdminHardeningCategory-${unique}` } });
    const product = await prisma.product.create({ data: { vendorId: vendor.id, categoryId: category.id, name: `AdminHardeningProduct-${unique}`, priceAmount: 10000, isAvailable: true } });
    await prisma.inventory.create({ data: { productId: product.id, quantity: 2 } });
    const customer = await createUser(UserRole.CUSTOMER, 'Admin Hardening Customer');
    await prisma.address.create({ data: { customerId: customer.user.id, label: 'Home', addressText: 'Admin Hardening Street', latitude: 6.5, longitude: 7.5 } });
    await prisma.cart.create({ data: { customerId: customer.user.id, vendorId: vendor.id, items: { create: { productId: product.id, quantity: 1 } } } });

    const checkout = await request(app.getHttpServer()).post('/api/orders/checkout').set('Authorization', `Bearer ${customer.token}`).send({ serviceAreaId: area.id, deliveryType: OrderDeliveryType.PICKUP });
    expect(checkout.status).toBe(400);
    expect(checkout.body?.error?.message ?? checkout.body?.message).toContain('Orders are currently disabled');

    const enabled = await request(app.getHttpServer()).patch('/api/admin/settings').set('Authorization', `Bearer ${superToken}`).send({ ordersEnabled: true });
    expect(enabled.status).toBe(200);

    const commissionBefore = await prisma.commissionConfig.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
    const commissionBeforeRate = commissionBefore ? Number(commissionBefore.defaultRatePercent) : 10;
    const commissionUpdate = await request(app.getHttpServer()).patch('/api/admin/settings').set('Authorization', `Bearer ${superToken}`).send({ defaultCommissionRate: 17 });
    expect(commissionUpdate.status).toBe(200);
    expect(Number((await prisma.commissionConfig.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } }))?.defaultRatePercent)).toBe(17);

    const minimumUpdate = await request(app.getHttpServer()).patch('/api/admin/settings').set('Authorization', `Bearer ${superToken}`).send({ minimumOrderAmount: 20000 });
    expect(minimumUpdate.status).toBe(200);
    expect((await prisma.setting.findUnique({ where: { key: 'minimumOrderAmount' } }))?.value).toBe(20000);

    await prisma.cartItem.deleteMany({ where: { cart: { customerId: customer.user.id } } });
    const cart = await prisma.cart.findUniqueOrThrow({ where: { customerId: customer.user.id } });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity: 1 } });

    const tooSmall = await request(app.getHttpServer()).post('/api/orders/checkout').set('Authorization', `Bearer ${customer.token}`).send({ serviceAreaId: area.id, deliveryType: OrderDeliveryType.PICKUP });
    expect(tooSmall.status).toBe(400);
    expect(tooSmall.body?.error?.message ?? tooSmall.body?.message).toContain('minimum order of 200 NGN');

    const minimumReset = await request(app.getHttpServer()).patch('/api/admin/settings').set('Authorization', `Bearer ${superToken}`).send({ minimumOrderAmount: beforeMinimumAmount });
    expect(minimumReset.status).toBe(200);

    const placed = await request(app.getHttpServer()).post('/api/orders/checkout').set('Authorization', `Bearer ${customer.token}`).send({ serviceAreaId: area.id, deliveryType: OrderDeliveryType.PICKUP });
    expect(placed.status).toBe(201);
    expect(Number(placed.body.commissionRateSnapshot)).toBe(17);

    await prisma.setting.upsert({ where: { key: 'ordersEnabled' }, update: { value: beforeOrdersEnabled }, create: { key: 'ordersEnabled', value: beforeOrdersEnabled } });
    await prisma.commissionConfig.updateMany({ where: { isActive: true }, data: { isActive: false } });
    await prisma.commissionConfig.create({ data: { defaultRatePercent: commissionBeforeRate, isActive: true } });
  });

  it('propagates the Admin UI rider payout setting into the order snapshot and delivered ledger entry', async () => {
    const country = await prisma.location.create({ data: { type: 'COUNTRY', name: `PayoutCountry-${unique}` } });
    const state = await prisma.location.create({ data: { type: 'STATE', name: `PayoutState-${unique}`, parentId: country.id } });
    const area = await prisma.serviceArea.create({ data: { locationId: state.id, name: `PayoutArea-${unique}`, status: 'ACTIVE', minimumOrderAmount: 0, baseDeliveryFee: 10000, serviceFeeAmount: 0 } });
    const customer = await createUser(UserRole.CUSTOMER, 'Payout Customer');
    const vendorOwner = await createUser(UserRole.VENDOR, 'Payout Vendor');
    const riderOwner = await createUser(UserRole.RIDER, 'Payout Rider');
    const type = await prisma.vendorType.create({ data: { name: `PayoutType-${unique}` } });
    const vendor = await prisma.vendor.create({ data: { ownerUserId: vendorOwner.user.id, vendorTypeId: type.id, storeName: `Payout Store-${unique}`, status: 'APPROVED', isOpen: true, supportedDeliveryModels: [DeliveryModel.PLATFORM_DELIVERY] } });
    await prisma.vendorLocation.create({ data: { vendorId: vendor.id, serviceAreaId: area.id, latitude: 6.5, longitude: 7.5 } });
    const category = await prisma.category.create({ data: { name: `PayoutCategory-${unique}` } });
    const product = await prisma.product.create({ data: { vendorId: vendor.id, categoryId: category.id, name: `PayoutProduct-${unique}`, priceAmount: 10000, isAvailable: true } });
    await prisma.inventory.create({ data: { productId: product.id, quantity: 2 } });
    await prisma.cart.create({ data: { customerId: customer.user.id, vendorId: vendor.id, items: { create: { productId: product.id, quantity: 1 } } } });
    const address = await prisma.address.create({ data: { customerId: customer.user.id, label: 'Home', addressText: 'Payout Street', latitude: 6.5, longitude: 7.5 } });

    const pricing = await request(app.getHttpServer()).patch(`/api/admin/pricing/service-areas/${area.id}`).set('Authorization', `Bearer ${superToken}`).send({ serviceFeeRatePercent: 0, serviceFeeCapAmount: 100000, baseDeliveryFee: 10000, perKmDeliveryFee: 0, deliveryRadiusKm: 8, riderPayoutRatePercent: 90, surgeEnabled: false, surgeLevel: 'NORMAL', surgeSlightlyHighAmount: 0, surgeHighAmount: 0, surgeVeryHighAmount: 0 });
    expect(pricing.status).toBe(200);
    expect(Number((await prisma.pricingConfig.findUnique({ where: { id: pricing.body.id } }))?.riderPayoutRatePercent)).toBe(90);

    const order = await request(app.getHttpServer()).post('/api/orders/checkout').set('Authorization', `Bearer ${customer.token}`).send({ serviceAreaId: area.id, deliveryType: OrderDeliveryType.DELIVERY, addressId: address.id });
    expect(order.status).toBe(201);
    expect(Number(order.body.riderPayoutRateSnapshot)).toBe(90);
    expect(order.body.pricingConfigId).toBe(pricing.body.id);
    expect(order.body.deliveryFeeAmount).toBe(10000);

    const rider = await prisma.rider.create({ data: { ownerUserId: riderOwner.user.id, vehicleType: 'MOTORCYCLE', status: 'APPROVED', isOnline: true } });
    await prisma.delivery.create({ data: { orderId: order.body.id, riderId: rider.id, assignedAt: new Date(), deliveredAt: new Date() } });
    await prisma.order.update({ where: { id: order.body.id }, data: { status: OrderStatus.DELIVERED } });
    await ledger.onOrderTransitioned({ orderId: order.body.id, orderNumber: order.body.orderNumber, customerId: customer.user.id, vendorId: vendor.id, fromStatus: OrderStatus.IN_TRANSIT, toStatus: OrderStatus.DELIVERED, deliveryType: 'DELIVERY' });

    const riderEntry = await prisma.ledgerEntry.findFirst({ where: { orderId: order.body.id, accountType: 'RIDER', accountId: rider.id, type: 'RIDER_EARNING' } });
    expect(riderEntry?.amount).toBe(9000);
  });
});
