from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8-sig')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')

path = 'backend/src/modules/payments/payments.service.ts'
text = read(path)
old = '''        const wallet = await tx.wallet.findUnique({
          where: {
            customerId: order.customerId,
          },
        });

        if (!wallet || !wallet.isActive) {
          throw new BadRequestException(
            'Customer wallet is unavailable for refund.',
          );
        }

        const before = wallet.balance;
        const after = before + refundAmount;

        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: after,
          },
        });
'''
new = '''        const wallet = await tx.wallet.findUnique({
          where: {
            customerId: order.customerId,
          },
        });

        if (!wallet || !wallet.isActive) {
          throw new BadRequestException(
            'Customer wallet is unavailable for refund.',
          );
        }

        // Serialize wallet refund balance accounting with concurrent wallet
        // spends/refunds. The existing payment/refund allocation lock protects
        // refund duplication; this wallet-row lock protects the wallet ledger
        // from stale absolute-balance writes.
        await tx.$queryRaw`
          SELECT id FROM "Wallet" WHERE id = ${wallet.id} FOR UPDATE
        `;

        const currentWallet = await tx.wallet.findUnique({
          where: { id: wallet.id },
          select: { balance: true },
        });

        if (!currentWallet) {
          throw new BadRequestException(
            'Customer wallet is unavailable for refund.',
          );
        }

        const before = currentWallet.balance;
        const updatedWallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: refundAmount },
          },
          select: { balance: true },
        });
        const after = updatedWallet.balance;
'''
if old not in text:
    raise SystemExit('wallet refund balance block not found')
text = text.replace(old, new, 1)
write(path, text)

test_path = 'backend/test/unit/refund-concurrency.spec.ts'
test = read(test_path)
addition = '''\n\n  it('locks the customer wallet and increments the balance atomically for wallet refunds', async () => {\n    const tx = {\n      $queryRaw: jest.fn().mockResolvedValue([]),\n      refund: {\n        findFirst: jest.fn().mockResolvedValue(null),\n        findUnique: jest.fn().mockResolvedValue({\n          id: 'refund-1',\n          status: 'PROCESSING',\n        }),\n        aggregate: jest.fn()\n          .mockResolvedValueOnce({ _sum: { amount: 0 } })\n          .mockResolvedValue({ _sum: { amount: 10000 } }),\n        create: jest.fn().mockResolvedValue({ id: 'refund-1', status: 'PROCESSING', amount: 4000 }),\n        update: jest.fn().mockResolvedValue({ id: 'refund-1', status: 'PROCESSED', amount: 4000 }),\n      },\n      wallet: {\n        findUnique: jest.fn()\n          .mockResolvedValueOnce({ id: 'wallet-1', balance: 10000, isActive: true })\n          .mockResolvedValueOnce({ id: 'wallet-1', balance: 10000 }),\n        update: jest.fn().mockResolvedValue({ balance: 14000 }),\n      },\n      walletTransaction: { create: jest.fn().mockResolvedValue({ id: 'wallet-tx-1' }) },\n      payment: { update: jest.fn() },\n    };\n\n    const prisma = {\n      order: {\n        findUnique: jest.fn().mockResolvedValue({\n          id: 'order-1',\n          customerId: 'customer-1',\n          status: 'PENDING_VENDOR',\n          orderNumber: 'RZ-1',\n          payments: [{\n            id: 'payment-1',\n            provider: 'WALLET',\n            reference: 'ref-1',\n            amount: 10000,\n            status: 'SUCCESS',\n          }],\n        }),\n      },\n      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),\n      refund: {\n        update: jest.fn(),\n        aggregate: jest.fn(),\n      },\n      payment: { update: jest.fn() },\n    };\n\n    const ordersService = { transitionOrder: jest.fn() };\n    const eventEmitter = { emit: jest.fn() };\n    const providers = { get: jest.fn() };\n    const service = new PaymentsService(\n      prisma as never,\n      ordersService as never,\n      eventEmitter as never,\n      providers as never,\n    );\n\n    await service.refundOrder('order-1', 'admin-1', 'wallet refund', 4000);\n\n    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);\n    expect(tx.wallet.update).toHaveBeenCalledWith({\n      where: { id: 'wallet-1' },\n      data: { balance: { increment: 4000 } },\n      select: { balance: true },\n    });\n    expect(tx.walletTransaction.create).toHaveBeenCalledWith(expect.objectContaining({\n      data: expect.objectContaining({\n        balanceBefore: 10000,\n        balanceAfter: 14000,\n        amount: 4000,\n      }),\n    }));\n  });\n'''
if addition.strip() not in test:
    marker = '\n});\n'
    if not test.endswith(marker):
        raise SystemExit('refund test ending not found')
    test = test[:-len(marker)] + addition + marker
write(test_path, test)
