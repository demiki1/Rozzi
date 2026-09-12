import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { randomBytes } from 'crypto';
import {
  ApplyPromotionDto,
  TopUpDto,
  WithdrawDto,
} from './dto/wallet.dto';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Safely get a customer's wallet or create it if it does not exist.
   *
   * The find-then-create pattern is protected against a race condition:
   * if two requests try to create the same wallet at the same time,
   * the unique customerId constraint may cause one create to return P2002.
   * In that case, retrieve the wallet created by the other request.
   */
  private async getOrCreateWallet(customerId: string) {
    const existing = await this.prisma.wallet.findUnique({
      where: { customerId },
    });

    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.wallet.create({
        data: { customerId },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const wallet = await this.prisma.wallet.findUnique({
          where: { customerId },
        });

        if (wallet) {
          return wallet;
        }
      }

      throw error;
    }
  }

  async getWallet(customerId: string) {
    const wallet = await this.getOrCreateWallet(customerId);

    const transactions = await this.prisma.walletTransaction.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const withdrawals = await this.prisma.walletWithdrawal.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      id: wallet.id,
      balance: wallet.balance,
      currency: wallet.currency,
      transactions,
      withdrawals,
    };
  }

  async transactions(customerId: string, page = 1, pageSize = 30) {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));

    const [items, total] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeSize,
        take: safeSize,
      }),
      this.prisma.walletTransaction.count({
        where: { customerId },
      }),
    ]);

    return {
      items,
      total,
      page: safePage,
      pageSize: safeSize,
      hasMore: safePage * safeSize < total,
    };
  }

  async initializeTopUp(
    customerId: string,
    dto: TopUpDto,
    provider: 'PAYSTACK' | 'FLUTTERWAVE' = 'PAYSTACK',
  ) {
    const wallet = await this.getOrCreateWallet(customerId);

    const reference = `RZW-${randomBytes(8)
      .toString('hex')
      .toUpperCase()}`;

    const secret =
      provider === 'PAYSTACK'
        ? process.env.PAYSTACK_SECRET_KEY
        : process.env.FLUTTERWAVE_SECRET_KEY;

    if (!secret) {
      throw new BadRequestException(
        `${provider} is not configured on the server.`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { email: true },
    });

    if (!user?.email) {
      throw new BadRequestException(
        'A customer email is required for wallet funding.',
      );
    }

    let authorizationUrl: string | null = null;

    if (provider === 'PAYSTACK') {
      const response = await fetch(
        'https://api.paystack.co/transaction/initialize',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: user.email,
            amount: dto.amount,
            reference,
            currency: 'NGN',
            callback_url: `${(
              process.env.CUSTOMER_APP_URL || 'http://localhost:3002'
            ).replace(/\/$/, '')}/wallet?topup_reference=${encodeURIComponent(
              reference,
            )}`,
            metadata: {
              walletId: wallet.id,
              customerId,
              type: 'wallet_top_up',
            },
          }),
        },
      );

      const payload = await response.json();

      if (!response.ok || !payload.status) {
        throw new BadRequestException(
          payload.message || 'Unable to initialize wallet funding.',
        );
      }

      authorizationUrl = payload.data.authorization_url;
    } else {
      const response = await fetch(
        'https://api.flutterwave.com/v3/payments',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tx_ref: reference,
            amount: dto.amount / 100,
            currency: 'NGN',
            redirect_url: process.env.FLUTTERWAVE_CALLBACK_URL,
            customer: {
              email: user.email,
            },
            meta: {
              walletId: wallet.id,
              customerId,
              type: 'wallet_top_up',
            },
            customizations: {
              title: 'ROZZI Wallet',
            },
          }),
        },
      );

      const payload = await response.json();

      if (!response.ok || payload.status !== 'success') {
        throw new BadRequestException(
          payload.message || 'Unable to initialize wallet funding.',
        );
      }

      authorizationUrl = payload.data.link;
    }

    const pending = await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        customerId,
        type: 'TOP_UP',
        status: 'PENDING',
        amount: dto.amount,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance,
        reference,
        description: 'Wallet top-up',
        metadata: {
          provider,
          authorizationUrl,
        },
      },
    });

    return {
      transactionId: pending.id,
      reference,
      amount: dto.amount,
      currency: 'NGN',
      authorizationUrl,
    };
  }

  async verifyTopUp(customerId: string, reference: string) {
    const transaction = await this.prisma.walletTransaction.findUnique({
      where: { reference },
    });

    if (
      !transaction ||
      transaction.customerId !== customerId ||
      transaction.type !== 'TOP_UP'
    ) {
      throw new NotFoundException(
        'Wallet funding transaction not found.',
      );
    }

    if (transaction.status === 'SUCCESS') {
      return {
        success: true,
        balance: transaction.balanceAfter,
        reference,
      };
    }

    const metadata: any = transaction.metadata || {};
    const provider = metadata.provider as 'PAYSTACK' | 'FLUTTERWAVE';

    let amount = 0;
    let currency = '';

    if (provider === 'PAYSTACK') {
      const secret = process.env.PAYSTACK_SECRET_KEY;

      if (!secret) {
        throw new BadRequestException(
          'Paystack is not configured on the server.',
        );
      }

      const response = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(
          reference,
        )}`,
        {
          headers: {
            Authorization: `Bearer ${secret}`,
          },
        },
      );

      const payload = await response.json();

      if (
        !response.ok ||
        !payload.status ||
        payload.data.status !== 'success'
      ) {
        throw new BadRequestException(
          'Wallet top-up could not be verified.',
        );
      }

      amount = Number(payload.data.amount);
      currency = payload.data.currency;
    } else {
      const secret = process.env.FLUTTERWAVE_SECRET_KEY;

      if (!secret) {
        throw new BadRequestException(
          'Flutterwave is not configured on the server.',
        );
      }

      const providerId = metadata.providerTransactionId;

      if (!providerId) {
        throw new BadRequestException(
          'Flutterwave transaction ID is required.',
        );
      }

      const response = await fetch(
        `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(
          providerId,
        )}/verify`,
        {
          headers: {
            Authorization: `Bearer ${secret}`,
          },
        },
      );

      const payload = await response.json();

      if (
        !response.ok ||
        payload.status !== 'success' ||
        payload.data.status !== 'successful'
      ) {
        throw new BadRequestException(
          'Wallet top-up could not be verified.',
        );
      }

      amount = Math.round(Number(payload.data.amount) * 100);
      currency = payload.data.currency;
    }

    if (amount !== transaction.amount || currency !== 'NGN') {
      throw new ConflictException(
        'Wallet top-up amount/currency mismatch.',
      );
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
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
    );
    return {
      success: true,
      balance: result.balanceAfter,
      reference,
    };
  }

  async withdraw(customerId: string, dto: WithdrawDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const wallet = await tx.wallet.findUnique({
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
        const ref = `RZW-WD-${randomBytes(7)
          .toString('hex')
          .toUpperCase()}`;

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            customerId,
            type: 'WITHDRAWAL',
            status: 'PENDING',
            amount: -dto.amount,
            balanceBefore: before,
            balanceAfter: after,
            reference: ref,
            description: 'Wallet withdrawal requested',
          },
        });

        const withdrawal = await tx.walletWithdrawal.create({
          data: {
            walletId: wallet.id,
            customerId,
            amount: dto.amount,
            status: 'REQUESTED',
            bankName: dto.bankName.trim(),
            accountName: dto.accountName.trim(),
            accountNumberLast4: dto.accountNumber.slice(-4),
            reference: ref,
            reason: dto.reason?.trim(),
          },
        });

        return {
          success: true,
          reference: withdrawal.reference,
          status: withdrawal.status,
          balance: after,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async applyPromotion(
    customerId: string,
    dto: ApplyPromotionDto,
  ) {
    const now = new Date();

    const promotion = await this.prisma.promotion.findFirst({
      where: {
        code: dto.code.trim().toUpperCase(),
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
        ...(dto.vendorId
          ? {
              OR: [
                { vendorId: null },
                { vendorId: dto.vendorId },
              ],
            }
          : { vendorId: null }),
      },
    });

    if (!promotion) {
      throw new NotFoundException(
        'Promotion code is invalid or expired.',
      );
    }

    const subtotal = dto.subtotalAmount ?? 0;

    if (subtotal < promotion.minOrderAmount) {
      throw new BadRequestException(
        `Minimum order amount is ₦${(
          promotion.minOrderAmount / 100
        ).toLocaleString('en-NG')}.`,
      );
    }

    if (
      promotion.usageLimit !== null &&
      promotion.usageCount >= promotion.usageLimit
    ) {
      throw new ConflictException(
        'This promotion has reached its usage limit.',
      );
    }

    if (promotion.perCustomerLimit !== null) {
      const used =
        await this.prisma.promotionRedemption.count({
          where: {
            promotionId: promotion.id,
            customerId,
          },
        });

      if (used >= promotion.perCustomerLimit) {
        throw new ConflictException(
          'You have reached the limit for this promotion.',
        );
      }
    }

    const discount =
      promotion.type === 'PERCENTAGE'
        ? Math.min(
            Math.round(
              (subtotal * promotion.value) / 100,
            ),
            promotion.maxDiscount ??
              Number.MAX_SAFE_INTEGER,
          )
        : Math.min(promotion.value, subtotal);

    return {
      valid: true,
      id: promotion.id,
      code: promotion.code,
      name: promotion.name,
      type: promotion.type,
      value: promotion.value,
      discountAmount: discount,
      minOrderAmount: promotion.minOrderAmount,
    };
  }

  async listPromotions(customerId: string) {
    const now = new Date();

    const promotions =
      await this.prisma.promotion.findMany({
        where: {
          isActive: true,
          startsAt: { lte: now },
          endsAt: { gte: now },
        },
        orderBy: { endsAt: 'asc' },
        take: 50,
      });

    const used =
      await this.prisma.promotionRedemption.findMany({
        where: { customerId },
        select: { promotionId: true },
      });

    const usedSet = new Set(
      used.map((x) => x.promotionId),
    );

    return promotions.map((p) => ({
      ...p,
      alreadyRedeemed: usedSet.has(p.id),
    }));
  }
}
