import { LedgerService } from '../../src/modules/finance/ledger.service';
import { LedgerAccountType, LedgerEntryType, OrderStatus } from '@prisma/client';

// The ledger now derives commission from immutable order-item snapshots.
// Keep the fixture aligned with that production contract rather than
// weakening LedgerService to support the old order-level-only fixture.
function buildPrismaMock(order: any) {
  const created: any[] = [];
  return {
    prisma: {
      ledgerEntry: {
        create: jest.fn(async ({ data }: any) => {
          created.push(data);
          return { id: `entry-${created.length}`, ...data, createdAt: new Date() };
        }),
        findFirst: jest.fn(async () => null),
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

  it('books vendor earning from item-level commission snapshots, and commission separately', async () => {
    const order = {
      id: 'order-1',
      orderNumber: 'RZW-00001',
      vendorId: 'vendor-1',
      subtotalAmount: 1_000_000,
      deliveryFeeAmount: 80_000,
      serviceFeeAmount: 15_000,
      commissionRateSnapshot: 10,
      items: [
        {
          subtotalAmount: 1_000_000,
          commissionRateSnapshot: 10,
          commissionAmountSnapshot: 100_000,
        },
      ],
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

    expect(commissionEntry.amount).toBe(100_000);
    expect(vendorEntry.amount).toBe(900_000);
    expect(vendorEntry.accountType).toBe(LedgerAccountType.VENDOR);
    expect(vendorEntry.accountId).toBe('vendor-1');
    expect(vendorEntry.amount + commissionEntry.amount).toBe(1_000_000);

    // Rider payout remains the full delivery fee in the current ledger model.
    expect(riderEntry.amount).toBe(order.deliveryFeeAmount);
    expect(riderEntry.accountId).toBe('rider-1');

    expect(serviceFeeEntry.amount).toBe(order.serviceFeeAmount);
  });

  it('does not book a rider earning for a pickup order with no assigned rider', async () => {
    const order = {
      id: 'order-2',
      orderNumber: 'RZW-00002',
      vendorId: 'vendor-1',
      subtotalAmount: 500_000,
      deliveryFeeAmount: 0,
      serviceFeeAmount: 0,
      commissionRateSnapshot: 10,
      items: [
        {
          subtotalAmount: 500_000,
          commissionRateSnapshot: 10,
          commissionAmountSnapshot: 50_000,
        },
      ],
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
    expect(created.find((e) => e.type === LedgerEntryType.VENDOR_EARNING).amount).toBe(450_000);
  });

  it('ignores transitions to any status other than DELIVERED', async () => {
    const order = { id: 'order-3' };
    const { prisma, created } = buildPrismaMock(order);
    const service = new LedgerService(prisma as any, auditLogMock);

    await service.onOrderTransitioned({
      orderId: 'order-3',
      orderNumber: 'RZW-00003',
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
    const order = {
      id: 'order-4',
      subtotalAmount: 100_000,
      commissionRateSnapshot: 10,
      items: [
        {
          subtotalAmount: 100_000,
          commissionRateSnapshot: 10,
          commissionAmountSnapshot: 10_000,
        },
      ],
      delivery: null,
    };
    const { prisma, created } = buildPrismaMock(order);
    (prisma.ledgerEntry.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-entry' });
    const service = new LedgerService(prisma as any, auditLogMock);

    await service.onOrderTransitioned({
      orderId: order.id,
      orderNumber: 'RZW-00004',
      customerId: 'customer-1',
      vendorId: 'vendor-1',
      fromStatus: OrderStatus.RIDER_ARRIVED,
      toStatus: OrderStatus.DELIVERED,
      deliveryType: 'DELIVERY',
    });

    expect(created.length).toBe(0);
  });
});
