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
});
