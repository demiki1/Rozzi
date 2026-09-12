from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8-sig')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')

# Harden wallet order payments against concurrent spending by making the debit
# itself conditional and atomic. No schema or migration change is required.
path = 'backend/src/modules/payments/payments.service.ts'
text = read(path)
old = """      if (!wallet || !wallet.isActive) {\n        throw new BadRequestException('Wallet is unavailable.');\n      }\n\n      if (wallet.balance < order.totalAmount) {\n        throw new ConflictException('Insufficient wallet balance.');\n      }\n\n      const reference = `RZW-ORD-${order.orderNumber}-${uuidv4()}\n        .slice(0, 8)\n        .toUpperCase()}`;\n\n      const before = wallet.balance;\n      const after = before - order.totalAmount;\n\n      await tx.wallet.update({\n        where: { id: wallet.id },\n        data: {\n          balance: after,\n        },\n      });"""
new = """      if (!wallet || !wallet.isActive) {\n        throw new BadRequestException('Wallet is unavailable.');\n      }\n\n      // Make the balance reservation atomic. Two concurrent order payments\n      // cannot both spend the same observed wallet balance.\n      const debited = await tx.wallet.updateMany({\n        where: {\n          id: wallet.id,\n          isActive: true,\n          balance: { gte: order.totalAmount },\n        },\n        data: {\n          balance: { decrement: order.totalAmount },\n        },\n      });\n\n      if (debited.count !== 1) {\n        throw new ConflictException('Insufficient wallet balance.');\n      }\n\n      const updatedWallet = await tx.wallet.findUniqueOrThrow({\n        where: { id: wallet.id },\n        select: { balance: true },\n      });\n\n      const reference = `RZW-ORD-${order.orderNumber}-${uuidv4()}\n        .slice(0, 8)\n        .toUpperCase()}`;\n\n      const after = updatedWallet.balance;\n      const before = after + order.totalAmount;"""
if old not in text:
    raise SystemExit('wallet payment debit block anchor not found')
text = text.replace(old, new, 1)

old = """    const result = await this.prisma.$transaction(\n      async (tx) => {\n        const wallet = await tx.wallet.findUnique({\n          where: { id: transaction.walletId },\n        });\n\n        if (!wallet) {\n          throw new NotFoundException('Wallet not found.');\n        }\n\n        const before = wallet.balance;\n        const after = before + transaction.amount;\n\n        await tx.wallet.update({\n          where: { id: wallet.id },\n          data: { balance: after },\n        });\n\n        return tx.walletTransaction.update({\n          where: { id: transaction.id },\n          data: {\n            status: 'SUCCESS',\n            balanceBefore: before,\n            balanceAfter: after,\n          },\n        });\n      },\n      {\n        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,\n      },\n    );"""
new = """    const result = await this.prisma.$transaction(\n      async (tx) => {\n        // Re-read the funding transaction inside the same serializable\n        // transaction. The request-level read above may be stale if two\n        // verification requests started at the same time.\n        const current = await tx.walletTransaction.findUnique({\n          where: { id: transaction.id },\n        });\n\n        if (!current) {\n          throw new NotFoundException('Wallet funding transaction not found.');\n        }\n\n        if (current.status === 'SUCCESS') {\n          return current;\n        }\n\n        if (current.status !== 'PENDING') {\n          throw new ConflictException('Wallet funding transaction is not pending.');\n        }\n\n        const wallet = await tx.wallet.findUnique({\n          where: { id: current.walletId },\n        });\n\n        if (!wallet) {\n          throw new NotFoundException('Wallet not found.');\n        }\n\n        const before = wallet.balance;\n        const after = before + current.amount;\n\n        await tx.wallet.update({\n          where: { id: wallet.id },\n          data: { balance: after },\n        });\n\n        return tx.walletTransaction.update({\n          where: { id: current.id },\n          data: {\n            status: 'SUCCESS',\n            balanceBefore: before,\n            balanceAfter: after,\n          },\n        });\n      },\n      {\n        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,\n      },\n    );"""
if old not in text:
    raise SystemExit('wallet top-up transaction anchor not found')
text = text.replace(old, new, 1)
write(path, text)

Path('backend/test/unit/wallet-money-concurrency.spec.ts').write_text(r'''import { ConflictException } from '@nestjs/common';
import { PaymentsService } from '../../src/modules/payments/payments.service';
import { WalletService } from '../../src/modules/wallet/wallet.service';

describe('wallet money concurrency hardening', () => {
  it('uses an atomic conditional debit for concurrent wallet order payments', async () => {
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          customerId: 'customer-1',
          status: 'PENDING_PAYMENT',
          totalAmount: 5000,
          orderNumber: 'RZW-1',
        }),
      },
      payment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'payment-1', amount: 5000 }),
      },
      wallet: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'wallet-1',
          balance: 5000,
          isActive: true,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ balance: 0 }),
      },
      walletTransaction: {
        create: jest.fn().mockResolvedValue({ id: 'wt-1' }),
      },
      paymentEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const ordersService = { confirmPayment: jest.fn() };
    const eventEmitter = { emit: jest.fn() };
    const providers = { get: jest.fn() };

    const service = new PaymentsService(
      prisma as never,
      ordersService as never,
      eventEmitter as never,
      providers as never,
    );

    await service.payWithWallet('customer-1', 'order-1');

    expect(tx.wallet.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'wallet-1',
        isActive: true,
        balance: { gte: 5000 },
      },
      data: {
        balance: { decrement: 5000 },
      },
    });
    expect(tx.wallet.findUniqueOrThrow).toHaveBeenCalledTimes(1);
    expect(tx.walletTransaction.create).toHaveBeenCalledTimes(1);
  });

  it('rejects the wallet order payment when the atomic debit loses the race', async () => {
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          customerId: 'customer-1',
          status: 'PENDING_PAYMENT',
          totalAmount: 5000,
          orderNumber: 'RZW-1',
        }),
      },
      payment: { findFirst: jest.fn().mockResolvedValue(null) },
      wallet: {
        findUnique: jest.fn().mockResolvedValue({ id: 'wallet-1', balance: 5000, isActive: true }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = { $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new PaymentsService(
      prisma as never,
      { confirmPayment: jest.fn() } as never,
      { emit: jest.fn() } as never,
      { get: jest.fn() } as never,
    );

    await expect(service.payWithWallet('customer-1', 'order-1')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.wallet.updateMany).toHaveBeenCalledTimes(1);
  });

  it('does not credit a top-up again when the transaction became successful before the verification transaction ran', async () => {
    const current = {
      id: 'wt-1',
      walletId: 'wallet-1',
      customerId: 'customer-1',
      type: 'TOP_UP',
      status: 'SUCCESS',
      amount: 5000,
      balanceAfter: 10000,
      metadata: { provider: 'PAYSTACK' },
    };
    const tx = {
      walletTransaction: {
        findUnique: jest.fn().mockResolvedValue(current),
      },
      wallet: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    const prisma = {
      walletTransaction: {
        findUnique: jest.fn().mockResolvedValue({
          ...current,
          status: 'PENDING',
          balanceAfter: 5000,
        }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: true,
        data: { status: 'success', amount: 5000, currency: 'NGN' },
      }),
    }) as never;

    try {
      const service = new WalletService(prisma as never);
      const result = await service.verifyTopUp('customer-1', 'ref-1');
      expect(result.success).toBe(true);
      expect(result.balance).toBe(10000);
      expect(tx.wallet.update).not.toHaveBeenCalled();
      expect(tx.walletTransaction.findUnique).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
''', encoding='utf-8')
