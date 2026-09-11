import { LedgerService } from '../../src/modules/finance/ledger.service';
import { LedgerAccountType, LedgerEntryType, OrderStatus } from '@prisma/client';

// A hand-rolled mock rather than a mocking library, kept deliberately small
// — this test only needs to observe what LedgerService.record() (via
// prisma.ledgerEntry.create) gets called with, and to answer a couple of
// find queries with fixture data.
function buildPrismaMock(order: any) {
  const created: any[] = [];
  return {
    prisma: {
      ledgerEntry: {
        create: jest.fn(async ({ data }: any) => {
          created.push(data);
          return { id: `entry-${created.length}`, ...data, createdAt: new Date() };
        }),
        findFirst: jest.fn(async () => null), // no existing booking — not idempotency-skipped
      },
      order: {
        findUnique: jest.fn(async () => order),
      },
    },
    created,
  };
}

describe('LedgerService — order-delivered booking (§21)', () => {
  const auditLogMock = { record: jest.fn() } as any;

  it('books vendor earning as subtotal minus commission, and commission separately', async () => {
    const order = {
      id: 'order-1',
      orderNumber: 'VEL-00001',
      vendorId: 'vendor-1',
      subtotalAmount: 1_000_000, // ₦10,000 in kobo
      deliveryFeeAmount: 80_000, // ₦800
      serviceFeeAmount: 15_000, // ₦150
      commissionRateSnapshot: 10, // 10%
      delivery: { riderId: 'rider-1' },
    };
    const { prisma, created } = buildPrismaMock(order);
    const service = new LedgerService(prisma as any, auditLogMock);

    await service.onOrderTransitioned({
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: 'customer-1',
      vendorId: order.vendorId,
      fromStatus: OrderStatus.RIDER_ARRIVED,
      toStatus: OrderStatus.DELIVERED,
      deliveryType: 'DELIVERY',
    });

    const vendorEntry = created.find((e) => e.type === LedgerEntryType.VENDOR_EARNING);
    const commissionEntry = created.find(
      (e) => e.type === LedgerEntryType.PLATFORM_COMMISSION && e.description?.includes('Commission'),
    );
    const serviceFeeEntry = created.find(
      (e) => e.type === LedgerEntryType.PLATFORM_COMMISSION && e.description?.includes('Service fee'),
    );
    const riderEntry = created.find((e) => e.type === LedgerEntryType.RIDER_EARNING);

    // 10% of ₦10,000 subtotal = ₦1,000 commission; vendor keeps the rest.
    expect(commissionEntry.amount).toBe(100_000);
    expect(vendorEntry.amount).toBe(900_000);
    expect(vendorEntry.accountType).toBe(LedgerAccountType.VENDOR);
    expect(vendorEntry.accountId).toBe('vendor-1');

    // Commission is computed on the PRODUCT SUBTOTAL only — never on
    // delivery or service fees, which aren't the vendor's revenue.
    expect(vendorEntry.amount + commissionEntry.amount).toBe(order.subtotalAmount);

    // Rider gets the full delivery fee (documented simplification — see
    // the comment in LedgerService).
    expect(riderEntry.amount).toBe(order.deliveryFeeAmount);
    expect(riderEntry.accountId).toBe('rider-1');

    // Service fee is booked as its own distinctly-described platform entry.
    expect(serviceFeeEntry.amount).toBe(order.serviceFeeAmount);
  });

  it('does not book a rider earning for a pickup order with no assigned rider', async () => {
    const order = {
      id: 'order-2',
      orderNumber: 'VEL-00002',
      vendorId: 'vendor-1',
      subtotalAmount: 500_000,
      deliveryFeeAmount: 0,
      serviceFeeAmount: 0,
      commissionRateSnapshot: 10,
      delivery: null,
    };
    const { prisma, created } = buildPrismaMock(order);
    const service = new LedgerService(prisma as any, auditLogMock);

    await service.onOrderTransitioned({
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: 'customer-1',
      vendorId: order.vendorId,
      fromStatus: OrderStatus.READY_FOR_PICKUP,
      toStatus: OrderStatus.DELIVERED,
      deliveryType: 'PICKUP',
    });

    expect(created.find((e) => e.type === LedgerEntryType.RIDER_EARNING)).toBeUndefined();
  });

  it('ignores transitions to any status other than DELIVERED', async () => {
    const order = { id: 'order-3' };
    const { prisma, created } = buildPrismaMock(order);
    const service = new LedgerService(prisma as any, auditLogMock);

    await service.onOrderTransitioned({
      orderId: 'order-3',
      orderNumber: 'VEL-00003',
      customerId: 'customer-1',
      vendorId: 'vendor-1',
      fromStatus: OrderStatus.PREPARING,
      toStatus: OrderStatus.READY_FOR_PICKUP,
      deliveryType: 'DELIVERY',
    });

    expect(created.length).toBe(0);
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it('does not double-book an order that already has a VENDOR_EARNING entry (idempotency)', async () => {
    const order = { id: 'order-4', subtotalAmount: 100_000, commissionRateSnapshot: 10, delivery: null };
    const { prisma, created } = buildPrismaMock(order);
    (prisma.ledgerEntry.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-entry' }); // already booked
    const service = new LedgerService(prisma as any, auditLogMock);

    await service.onOrderTransitioned({
      orderId: order.id,
      orderNumber: 'VEL-00004',
      customerId: 'customer-1',
      vendorId: 'vendor-1',
      fromStatus: OrderStatus.RIDER_ARRIVED,
      toStatus: OrderStatus.DELIVERED,
      deliveryType: 'DELIVERY',
    });

    expect(created.length).toBe(0);
  });
});
