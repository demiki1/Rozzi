import { ConflictException } from '@nestjs/common';
import { WalletService } from '../../src/modules/wallet/wallet.service';

describe('WalletService withdrawal concurrency', () => {
  function makeService(debitCount: number) {
    const tx = {
      wallet: {
        findUnique: jest.fn().mockResolvedValue({ id: 'wallet-1', balance: 10000, isActive: true }),
        updateMany: jest.fn().mockResolvedValue({ count: debitCount }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ balance: 5000 }),
      },
      walletTransaction: { create: jest.fn().mockResolvedValue({ id: 'wt-1' }) },
      walletWithdrawal: { create: jest.fn().mockResolvedValue({ reference: 'RZW-WD-1', status: 'REQUESTED' }) },
    };
    const prisma = { $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    return { service: new WalletService(prisma as never), tx };
  }

  it('uses an atomic conditional debit before creating a withdrawal', async () => {
    const { service, tx } = makeService(1);

    await service.withdraw('customer-1', {
      amount: 5000,
      bankName: 'Bank',
      accountName: 'Customer',
      accountNumber: '1234567890',
    });

    expect(tx.wallet.updateMany).toHaveBeenCalledWith({
      where: { id: 'wallet-1', isActive: true, balance: { gte: 5000 } },
      data: { balance: { decrement: 5000 } },
    });
    expect(tx.wallet.findUniqueOrThrow).toHaveBeenCalledTimes(1);
    expect(tx.walletTransaction.create).toHaveBeenCalledTimes(1);
    expect(tx.walletWithdrawal.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a withdrawal when another concurrent withdrawal consumes the remaining balance first', async () => {
    const { service, tx } = makeService(0);

    await expect(service.withdraw('customer-1', {
      amount: 5000,
      bankName: 'Bank',
      accountName: 'Customer',
      accountNumber: '1234567890',
    })).rejects.toBeInstanceOf(ConflictException);

    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
    expect(tx.walletWithdrawal.create).not.toHaveBeenCalled();
  });
});
