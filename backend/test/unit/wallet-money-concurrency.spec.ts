import { ConflictException } from '@nestjs/common';
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
    const originalSecret = process.env.PAYSTACK_SECRET_KEY;
    process.env.PAYSTACK_SECRET_KEY = 'test-secret';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, data: { status: 'success', amount: 5000, currency: 'NGN' } }) }) as never;
    try {
      const service = new WalletService(prisma as never);
      const result = await service.verifyTopUp('customer-1', 'ref-1');
      expect(result).toEqual({ success: true, balance: 10000, reference: 'ref-1' });
      expect(tx.wallet.update).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
      if (originalSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY;
      else process.env.PAYSTACK_SECRET_KEY = originalSecret;
    }
  });
});
