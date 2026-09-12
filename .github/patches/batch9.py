from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8-sig')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')

path = 'backend/src/modules/wallet/wallet.service.ts'
text = read(path)
method_start = text.index('  async withdraw(')
wallet_start = text.index('        const wallet = await tx.wallet.findUnique', method_start)
ref_start = text.index('        const ref =', wallet_start)
replacement = '''        const wallet = await tx.wallet.findUnique({
          where: { customerId },
        });

        if (!wallet || !wallet.isActive) {
          throw new BadRequestException('Wallet is unavailable.');
        }

        // Reserve the withdrawal atomically so concurrent withdrawals cannot
        // both spend the same observed wallet balance.
        const debited = await tx.wallet.updateMany({
          where: {
            id: wallet.id,
            isActive: true,
            balance: { gte: dto.amount },
          },
          data: {
            balance: { decrement: dto.amount },
          },
        });

        if (debited.count !== 1) {
          throw new ConflictException('Insufficient wallet balance.');
        }

        const updatedWallet = await tx.wallet.findUniqueOrThrow({
          where: { id: wallet.id },
          select: { balance: true },
        });

        const before = updatedWallet.balance + dto.amount;
        const after = updatedWallet.balance;
'''
text = text[:wallet_start] + replacement + text[ref_start:]
# Remove the legacy absolute wallet update left immediately after the withdrawal reference.
method_end = text.index('\n  }', ref_start)
legacy = '''        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: after },
        });

'''
legacy_pos = text.find(legacy, ref_start, method_end)
if legacy_pos >= 0:
    text = text[:legacy_pos] + text[legacy_pos + len(legacy):]
write(path, text)

Path('backend/test/unit/wallet-withdrawal-concurrency.spec.ts').write_text(r'''import { ConflictException } from '@nestjs/common';
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
''', encoding='utf-8')
