import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/config/prisma.service';

// This is the exact scenario §51 calls out by name:
//
//   Customer places order. Payment succeeds. Vendor accepts. Vendor
//   prepares. Vendor marks ready. Rider assigned. Rider accepts. Rider
//   picks up. Rider delivers. Customer confirms OTP. Order becomes
//   delivered. Vendor settlement becomes pending. Rider earning becomes
//   pending.
//
// REQUIREMENTS TO RUN THIS FILE, stated plainly rather than assumed:
//   - A real Postgres database reachable via TEST_DATABASE_URL (or
//     DATABASE_URL), with migrations already applied.
//   - NODE_ENV=development, so the dev-only payment-confirmation stub
//     (`/orders/:id/dev-mark-paid`) is reachable — this test deliberately
//     avoids depending on live Paystack credentials, since §100 says not
//     to fake a real provider integration, and using the documented dev
//     stub is the honest way to exercise the rest of the lifecycle without
//     one.
//   - The test creates all its own fixtures (location, service area,
//     delivery zone, category, vendor type) rather than relying on
//     prisma/seed.ts, so it can run against a clean database.
//
// HONESTY NOTE: this file has not been executed in the environment it was
// written in (no network access to install dependencies or run a
// database). It is written to compile and to exercise the real HTTP
// surface via supertest — but "written correctly" and "verified passing"
// are different claims, and only the second one requires actually running
// it. Please run this and report back what breaks.
describe('Order lifecycle e2e (§51 critical scenario)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let serviceAreaId: string;
  let deliveryZoneId: string;
  let categoryId: string;

  let customerToken: string;
  let vendorToken: string;
  let vendorOwnerId: string;
  let riderToken: string;

  let vendorId: string;
  let productId: string;
  let orderId: string;
  let deliveryId: string;

  const unique = Date.now();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    // ---- Fixtures: location tree down to a service area + zone ----
    const country = await prisma.location.create({ data: { type: 'COUNTRY', name: `TestCountry-${unique}` } });
    const state = await prisma.location.create({
      data: { type: 'STATE', name: `TestState-${unique}`, parentId: country.id },
    });
    const serviceArea = await prisma.serviceArea.create({
      data: {
        locationId: state.id,
        name: `TestArea-${unique}`,
        status: 'ACTIVE',
        minimumOrderAmount: 0,
        baseDeliveryFee: 50_000,
        serviceFeeAmount: 10_000,
      },
    });
    serviceAreaId = serviceArea.id;
    const zone = await prisma.deliveryZone.create({
      data: { serviceAreaId, name: `TestZone-${unique}`, radiusKm: 10 },
    });
    deliveryZoneId = zone.id;

    const category = await prisma.category.create({ data: { name: `TestCategory-${unique}` } });
    categoryId = category.id;
    const vendorType = await prisma.vendorType.create({ data: { name: `TestVendorType-${unique}` } });

    // ---- Register three accounts: customer, vendor, rider ----
    const customerRes = await request(app.getHttpServer()).post('/api/auth/register').send({
      fullName: 'Test Customer',
      email: `customer-${unique}@example.com`,
      password: 'Password123',
      role: 'CUSTOMER',
    });
    customerToken = customerRes.body.accessToken;

    const vendorRes = await request(app.getHttpServer()).post('/api/auth/register').send({
      fullName: 'Test Vendor Owner',
      email: `vendor-${unique}@example.com`,
      password: 'Password123',
      role: 'VENDOR',
    });
    vendorToken = vendorRes.body.accessToken;
    const vendorPayload = JSON.parse(Buffer.from(vendorToken.split('.')[1], 'base64').toString());
    vendorOwnerId = vendorPayload.sub;

    const riderRes = await request(app.getHttpServer()).post('/api/auth/register').send({
      fullName: 'Test Rider',
      email: `rider-${unique}@example.com`,
      password: 'Password123',
      role: 'RIDER',
    });
    riderToken = riderRes.body.accessToken;

    // ---- Vendor registers a store, gets force-approved for the test
    // (bypassing the admin approval UI — this test is about the order
    // lifecycle, not re-testing Phase 3's approval workflow, which has its
    // own coverage) and adds a product ----
    const vendorRegRes = await request(app.getHttpServer())
      .post('/api/vendor/register')
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({ vendorTypeId: vendorType.id, storeName: `Test Store ${unique}`, serviceAreaId });
    vendorId = vendorRegRes.body.id;

    await prisma.vendor.update({ where: { id: vendorId }, data: { status: 'APPROVED', isOpen: true } });
    await prisma.vendorLocation.updateMany({
      where: { vendorId, serviceAreaId },
      data: { latitude: 6.5, longitude: 7.5 }, // arbitrary pickup coordinates for dispatch
    });

    const productRes = await request(app.getHttpServer())
      .post('/api/vendor/products')
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({ categoryId, name: 'Test Jollof Rice', priceAmount: 300_000, initialStock: 10 });
    productId = productRes.body.id;

    // ---- Rider registers, gets force-approved, goes online ----
    const riderRegRes = await request(app.getHttpServer())
      .post('/api/rider/register')
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ vehicleType: 'MOTORCYCLE', serviceAreaIds: [serviceAreaId] });

    await prisma.rider.update({ where: { id: riderRegRes.body.id }, data: { status: 'APPROVED' } });

    await request(app.getHttpServer())
      .post('/api/rider/me/location')
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ latitude: 6.51, longitude: 7.51 });

    await request(app.getHttpServer())
      .post('/api/rider/me/go-online')
      .set('Authorization', `Bearer ${riderToken}`)
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('customer adds the product to cart', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId, quantity: 2 });
    expect(res.status).toBe(201);
  });

  it('customer adds a delivery address', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/customer/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ label: 'Home', addressText: '1 Test Street' });
    expect(res.status).toBe(201);
    (global as any).__addressId = res.body.id;
  });

  it('customer checks out — order is created PENDING_PAYMENT with stock deducted', async () => {
    const addressId = (global as any).__addressId;
    const res = await request(app.getHttpServer())
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ serviceAreaId, deliveryType: 'DELIVERY', addressId });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING_PAYMENT');
    orderId = res.body.id;

    const product = await prisma.product.findUnique({ where: { id: productId }, include: { inventory: true } });
    expect(product?.inventory?.quantity).toBe(8); // 10 - 2 ordered
  });

  it('payment succeeds via the dev stub — order reaches PENDING_VENDOR', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/dev-mark-paid`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING_VENDOR');
  });

  it('vendor accepts, prepares, and marks the order ready', async () => {
    for (const step of ['accept', 'preparing', 'ready']) {
      const res = await request(app.getHttpServer())
        .post(`/api/vendor/orders/${orderId}/${step}`)
        .set('Authorization', `Bearer ${vendorToken}`);
      expect(res.status).toBe(201);
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe('READY_FOR_PICKUP');
  });

  it('dispatch auto-starts and offers the rider (event-driven, per Phase 9)', async () => {
    // Auto-dispatch runs as an async event listener — give it a moment.
    await new Promise((r) => setTimeout(r, 1000));

    const delivery = await prisma.delivery.findUnique({ where: { orderId } });
    expect(delivery).not.toBeNull();
    deliveryId = delivery!.id;

    const offers = await request(app.getHttpServer())
      .get('/api/rider/delivery-offers')
      .set('Authorization', `Bearer ${riderToken}`);
    expect(offers.body.length).toBeGreaterThan(0);

    // The OTP must never appear anywhere in this rider-facing payload.
    expect(JSON.stringify(offers.body)).not.toContain('deliveryCode');
  });

  it('rider accepts the offer — order reaches RIDER_ASSIGNED', async () => {
    const attempt = await prisma.deliveryAttempt.findFirst({ where: { deliveryId, status: 'OFFERED' } });
    expect(attempt).not.toBeNull();

    const res = await request(app.getHttpServer())
      .post(`/api/rider/delivery-offers/${attempt!.id}/accept`)
      .set('Authorization', `Bearer ${riderToken}`);
    expect(res.status).toBe(201);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe('RIDER_ASSIGNED');
  });

  it('rider progresses: arrived at pickup, picked up (OTP generated), departs, arrives', async () => {
    for (const step of ['arrived-pickup', 'picked-up', 'depart', 'arrived']) {
      const res = await request(app.getHttpServer())
        .post(`/api/rider/deliveries/${deliveryId}/${step}`)
        .set('Authorization', `Bearer ${riderToken}`);
      expect(res.status).toBe(201);
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe('RIDER_ARRIVED');
    expect(order?.deliveryCode).toMatch(/^\d{4}$/);
  });

  it('rider cannot complete delivery with the wrong code (§15)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/rider/deliveries/${deliveryId}/confirm-delivery`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ code: '0000' });
    expect(res.status).toBe(400);
  });

  it('customer confirms OTP — order becomes DELIVERED', async () => {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    const res = await request(app.getHttpServer())
      .post(`/api/rider/deliveries/${deliveryId}/confirm-delivery`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ code: order!.deliveryCode });
    expect(res.status).toBe(201);

    const updated = await prisma.order.findUnique({ where: { id: orderId } });
    expect(updated?.status).toBe('DELIVERED');
  });

  it('vendor settlement and rider earning become pending in the ledger (§77, §78)', async () => {
    // Booking happens in an async event listener — give it a moment.
    await new Promise((r) => setTimeout(r, 1000));

    const vendorEntries = await prisma.ledgerEntry.findMany({ where: { orderId, type: 'VENDOR_EARNING' } });
    const riderEntries = await prisma.ledgerEntry.findMany({ where: { orderId, type: 'RIDER_EARNING' } });
    const commissionEntries = await prisma.ledgerEntry.findMany({
      where: { orderId, type: 'PLATFORM_COMMISSION' },
    });

    expect(vendorEntries.length).toBe(1);
    expect(riderEntries.length).toBe(1);
    expect(commissionEntries.length).toBeGreaterThanOrEqual(1); // commission + service fee

    // ₦6,000 subtotal (2 × ₦3,000), no vendor commission rate override ⇒
    // default 10% from the Vendor model's schema default.
    expect(vendorEntries[0].amount + commissionEntries[0].amount).toBeLessThanOrEqual(600_000);
  });
});
