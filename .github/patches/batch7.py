from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8-sig')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')

path = 'backend/src/modules/payments/payments.service.ts'
text = read(path)
old = """    // Never allow cumulative successful/pending refunds to exceed the payment.\n    const refundedTotals = await this.prisma.refund.aggregate({\n      where: {\n        paymentId: payment.id,\n        status: {\n          in: ['REQUESTED', 'PROCESSING', 'PROCESSED'],\n        },\n      },\n      _sum: {\n        amount: true,\n      },\n    });\n\n    const alreadyAllocated = refundedTotals._sum.amount ?? 0;\n    const remaining = payment.amount - alreadyAllocated;\n\n    if (refundAmount > remaining) {\n      throw new BadRequestException(\n        `Refund amount exceeds the remaining refundable balance of ${remaining} kobo.`,\n      );\n    }\n\n    // A pending provider refund must settle before another refund attempt is\n    // created; otherwise a retry could double-submit money to the provider.\n    const existing = await this.prisma.refund.findFirst({\n      where: {\n        paymentId: payment.id,\n        status: {\n          in: ['REQUESTED', 'PROCESSING'],\n        },\n      },\n      orderBy: {\n        createdAt: 'desc',\n      },\n    });\n\n    if (existing) {\n      return existing;\n    }\n\n    const refund = await this.prisma.refund.create({\n      data: {\n        paymentId: payment.id,\n        orderId,\n        amount: refundAmount,\n        reason,\n        requestedByUserId: actorId,\n        status: 'PROCESSING',\n      },\n    });"""
new = """    // Serialize refund allocation on the payment row. Without a row lock, two\n    // concurrent admin requests can both observe the same remaining balance\n    // and create refunds whose combined amount exceeds the original payment.\n    // The lock also makes the pending-refund check atomic with allocation.\n    const refund = await this.prisma.$transaction(async (tx) => {\n      await tx.$queryRaw`\n        SELECT id FROM \"Payment\" WHERE id = ${payment.id} FOR UPDATE\n      `;\n\n      // Never allow cumulative successful/pending refunds to exceed the payment.\n      const refundedTotals = await tx.refund.aggregate({\n        where: {\n          paymentId: payment.id,\n          status: {\n            in: ['REQUESTED', 'PROCESSING', 'PROCESSED'],\n          },\n        },\n        _sum: {\n          amount: true,\n        },\n      });\n\n      const alreadyAllocated = refundedTotals._sum.amount ?? 0;\n      const remaining = payment.amount - alreadyAllocated;\n\n      if (refundAmount > remaining) {\n        throw new BadRequestException(\n          `Refund amount exceeds the remaining refundable balance of ${remaining} kobo.`,\n        );\n      }\n\n      // A pending provider refund must settle before another refund attempt is\n      // created; otherwise a retry could double-submit money to the provider.\n      const existing = await tx.refund.findFirst({\n        where: {\n          paymentId: payment.id,\n          status: {\n            in: ['REQUESTED', 'PROCESSING'],\n          },\n        },\n        orderBy: {\n          createdAt: 'desc',\n        },\n      });\n\n      if (existing) {\n        return existing;\n      }\n\n      return tx.refund.create({\n        data: {\n          paymentId: payment.id,\n          orderId,\n          amount: refundAmount,\n          reason,\n          requestedByUserId: actorId,\n          status: 'PROCESSING',\n        },\n      });\n    });"""
if old not in text:
    raise SystemExit('refund allocation block anchor not found')
text = text.replace(old, new, 1)
write(path, text)

Path('backend/test/unit/refund-concurrency.spec.ts').write_text(r'''import { PaymentsService } from '../../src/modules/payments/payments.service';

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
        aggregate: jest.fn(),
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
''', encoding='utf-8')
