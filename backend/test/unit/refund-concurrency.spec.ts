import { PaymentsService } from '../../src/modules/payments/payments.service';

describe('PaymentsService refund allocation concurrency', () => {
  it('locks the payment row before checking and creating a refund', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      refund: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'refund-1',
          paymentId: 'payment-1',
          orderId: 'order-1',
          amount: 4000,
          status: 'PROCESSING',
        }),
      },
    };

    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          customerId: 'customer-1',
          status: 'PENDING_VENDOR',
          payments: [
            {
              id: 'payment-1',
              provider: 'PAYSTACK',
              providerTransactionId: 'provider-tx-1',
              reference: 'ref-1',
              amount: 10000,
              status: 'SUCCESS',
            },
          ],
        }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
      refund: {
        update: jest.fn().mockResolvedValue({
          id: 'refund-1',
          status: 'PROCESSED',
          amount: 4000,
        }),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 4000 } }),
      },
      payment: {
        update: jest.fn(),
      },
    };

    const provider = {
      refund: jest.fn().mockResolvedValue({
        status: 'processed',
        raw: { reference: 'provider-refund-1' },
      }),
    };

    const providers = {
      get: jest.fn().mockReturnValue(provider),
    };

    const ordersService = {
      transitionOrder: jest.fn(),
    };

    const eventEmitter = {
      emit: jest.fn(),
    };

    const service = new PaymentsService(
      prisma as never,
      ordersService as never,
      eventEmitter as never,
      providers as never,
    );

    await service.refundOrder('order-1', 'admin-1', 'test', 4000);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.refund.aggregate).toHaveBeenCalledTimes(1);
    expect(tx.refund.findFirst).toHaveBeenCalledTimes(1);
    expect(tx.refund.create).toHaveBeenCalledTimes(1);
    expect(prisma.refund.update).toHaveBeenCalledTimes(1);
    expect(provider.refund).toHaveBeenCalledWith('provider-tx-1', 4000);
  });

  it('locks the customer wallet and increments the balance atomically for wallet refunds', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      refund: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue({
          id: 'refund-1',
          status: 'PROCESSING',
        }),
        aggregate: jest.fn()
          .mockResolvedValueOnce({ _sum: { amount: 0 } })
          .mockResolvedValue({ _sum: { amount: 10000 } }),
        create: jest.fn().mockResolvedValue({ id: 'refund-1', status: 'PROCESSING', amount: 4000 }),
        update: jest.fn().mockResolvedValue({ id: 'refund-1', status: 'PROCESSED', amount: 4000 }),
      },
      wallet: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'wallet-1', balance: 10000, isActive: true })
          .mockResolvedValueOnce({ id: 'wallet-1', balance: 10000 }),
        update: jest.fn().mockResolvedValue({ balance: 14000 }),
      },
      walletTransaction: { create: jest.fn().mockResolvedValue({ id: 'wallet-tx-1' }) },
      payment: { update: jest.fn() },
    };

    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          customerId: 'customer-1',
          status: 'PENDING_VENDOR',
          orderNumber: 'RZ-1',
          payments: [{
            id: 'payment-1',
            provider: 'WALLET',
            reference: 'ref-1',
            amount: 10000,
            status: 'SUCCESS',
          }],
        }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      refund: {
        update: jest.fn(),
        aggregate: jest.fn(),
      },
      payment: { update: jest.fn() },
    };

    const ordersService = { transitionOrder: jest.fn() };
    const eventEmitter = { emit: jest.fn() };
    const providers = { get: jest.fn() };
    const service = new PaymentsService(
      prisma as never,
      ordersService as never,
      eventEmitter as never,
      providers as never,
    );

    await service.refundOrder('order-1', 'admin-1', 'wallet refund', 4000);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: { balance: { increment: 4000 } },
      select: { balance: true },
    });
    expect(tx.walletTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        balanceBefore: 10000,
        balanceAfter: 14000,
        amount: 4000,
      }),
    }));
  });

});
