from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8-sig')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')

path = 'backend/src/modules/payments/payments.service.ts'
text = read(path)
old = '''      const wallet = await tx.wallet.findUnique({
        where: { customerId },
      });

      if (!wallet || !wallet.isActive) {
        throw new BadRequestException('Wallet is unavailable.');
      }

      if (wallet.balance < order.totalAmount) {
        throw new ConflictException('Insufficient wallet balance.');
      }

      const reference = `RZW-ORD-${order.orderNumber}-${uuidv4()}
        .slice(0, 8)
        .toUpperCase()}`;

      const before = wallet.balance;
      const after = before - order.totalAmount;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: after,
        },
      });'''
new = '''      const wallet = await tx.wallet.findUnique({
        where: { customerId },
      });

      if (!wallet || !wallet.isActive) {
        throw new BadRequestException('Wallet is unavailable.');
      }

      // Make the balance reservation atomic. Two concurrent order payments
      // cannot both spend the same observed wallet balance.
      const debited = await tx.wallet.updateMany({
        where: {
          id: wallet.id,
          isActive: true,
          balance: { gte: order.totalAmount },
        },
        data: {
          balance: { decrement: order.totalAmount },
        },
      });

      if (debited.count !== 1) {
        throw new ConflictException('Insufficient wallet balance.');
      }

      const updatedWallet = await tx.wallet.findUniqueOrThrow({
        where: { id: wallet.id },
        select: { balance: true },
      });

      const reference = `RZW-ORD-${order.orderNumber}-${uuidv4()}
        .slice(0, 8)
        .toUpperCase()}`;

      const after = updatedWallet.balance;
      const before = after + order.totalAmount;'''
if old not in text:
    raise SystemExit('wallet payment debit block anchor not found')
text = text.replace(old, new, 1)

old = '''    const result = await this.prisma.$transaction(
      async (tx) => {
        const wallet = await tx.wallet.findUnique({
          where: { id: transaction.walletId },
        });

        if (!wallet) {
          throw new NotFoundException('Wallet not found.');
        }

        const before = wallet.balance;
        const after = before + transaction.amount;

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: after },
        });

        return tx.walletTransaction.update({
          where: { id: transaction.id },
          data: {
            status: 'SUCCESS',
            balanceBefore: before,
            balanceAfter: after,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );'''
new = '''    const result = await this.prisma.$transaction(
      async (tx) => {
        // Re-read the funding transaction inside the serializable transaction.
        // The request-level read can be stale when two verification requests
        // started concurrently.
        const current = await tx.walletTransaction.findUnique({
          where: { id: transaction.id },
        });

        if (!current) {
          throw new NotFoundException('Wallet funding transaction not found.');
        }

        if (current.status === 'SUCCESS') {
          return current;
        }

        if (current.status !== 'PENDING') {
          throw new ConflictException('Wallet funding transaction is not pending.');
        }

        const wallet = await tx.wallet.findUnique({
          where: { id: current.walletId },
        });

        if (!wallet) {
          throw new NotFoundException('Wallet not found.');
        }

        const before = wallet.balance;
        const after = before + current.amount;

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: after },
        });

        return tx.walletTransaction.update({
          where: { id: current.id },
          data: {
            status: 'SUCCESS',
            balanceBefore: before,
            balanceAfter: after,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );'''
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
      order: { findUnique: jest.fn().mockResolvedValue({ id: 'order-1', customerId: 'customer-1', status: 'PENDING_PAYMENT', totalAmount: 5000, orderNumber: 'RZW-1' }) },
      payment: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'payment-1', amount: 5000 }) },
      wallet: {
        findUnique: jest.fn().mockResolvedValue({ id: 'wallet-1', balance: 5000, isActive: true }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ balance: 0 }),
      },
      walletTransaction: { create: jest.fn().mockResolvedValue({ id: 'wt-1' }) },
      paymentEvent: { create: jest.fn().mockResolvedValue({ id: 'event-1' }) },
    };
    const prisma = { $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new PaymentsService(prisma as never, { confirmPayment: jest.fn() } as never, { emit: jest.fn() } as never, { get: jest.fn() } as never);

    await service.payWithWallet('customer-1', 'order-1');

    expect(tx.wallet.updateMany).toHaveBeenCalledWith({
      where: { id: 'wallet-1', isActive: true, balance: { gte: 5000 } },
      data: { balance: { decrement: 5000 } },
    });
    expect(tx.wallet.findUniqueOrThrow).toHaveBeenCalledTimes(1);
    expect(tx.walletTransaction.create).toHaveBeenCalledTimes(1);
  });

  it('rejects the wallet order payment when the atomic debit loses the race', async () => {
    const tx = {
      order: { findUnique: jest.fn().mockResolvedValue({ id: 'order-1', customerId: 'customer-1', status: 'PENDING_PAYMENT', totalAmount: 5000, orderNumber: 'RZW-1' }) },
      payment: { findFirst: jest.fn().mockResolvedValue(null) },
      wallet: { findUnique: jest.fn().mockResolvedValue({ id: 'wallet-1', balance: 5000, isActive: true }), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma = { $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new PaymentsService(prisma as never, { confirmPayment: jest.fn() } as never, { emit: jest.fn() } as never, { get: jest.fn() } as never);

    await expect(service.payWithWallet('customer-1', 'order-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not credit a top-up again when it became successful before the verification transaction ran', async () => {
    const current = { id: 'wt-1', walletId: 'wallet-1', customerId: 'customer-1', type: 'TOP_UP', status: 'SUCCESS', amount: 5000, balanceAfter: 10000, metadata: { provider: 'PAYSTACK' } };
    const tx = { walletTransaction: { findUnique: jest.fn().mockResolvedValue(current) }, wallet: { findUnique: jest.fn(), update: jest.fn() } };
    const prisma = {
      walletTransaction: { findUnique: jest.fn().mockResolvedValue({ ...current, status: 'PENDING', balanceAfter: 5000 }) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, data: { status: 'success', amount: 5000, currency: 'NGN' } }) }) as never;
    try {
      const service = new WalletService(prisma as never);
      const result = await service.verifyTopUp('customer-1', 'ref-1');
      expect(result).toEqual({ success: true, balance: 10000, reference: 'ref-1' });
      expect(tx.wallet.update).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });
});
''', encoding='utf-8')
