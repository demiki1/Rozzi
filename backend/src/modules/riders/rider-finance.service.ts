import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
  LedgerAccountType,
  LedgerEntryType,
  RiderCashTransactionType,
  RiderPayoutStatus,
} from '@prisma/client';
import { LedgerService } from '../finance/ledger.service';
import { AuditLogService } from '../audit/audit-log.service';

@Injectable()
export class RiderFinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditLogService,
  ) {}

  private async rider(ownerUserId: string) {
    const rider = await this.prisma.rider.findUnique({
      where: { ownerUserId },
    });

    if (!rider) {
      throw new NotFoundException('No rider profile found for this account.');
    }

    return rider;
  }

  private async deliveryEarningEntries(riderId: string) {
    return this.prisma.ledgerEntry.findMany({
      where: {
        accountType: LedgerAccountType.RIDER,
        accountId: riderId,
        type: LedgerEntryType.RIDER_EARNING,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async entries(riderId: string) {
    return this.prisma.ledgerEntry.findMany({
      where: {
        accountType: LedgerAccountType.RIDER,
        accountId: riderId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async overview(ownerUserId: string) {
    const rider = await this.rider(ownerUserId);

    const [entries, deliveryEarnings, payouts, cash] = await Promise.all([
      this.entries(rider.id),
      this.deliveryEarningEntries(rider.id),
      this.prisma.riderPayout.findMany({
        where: { riderId: rider.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.riderCashTransaction.findMany({
        where: { riderId: rider.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const balance = entries.reduce((sum, entry) => sum + entry.amount, 0);

    const pendingWithdrawals = payouts
      .filter((payout) => {
        const pendingStatuses: RiderPayoutStatus[] = [
          RiderPayoutStatus.REQUESTED,
          RiderPayoutStatus.PROCESSING,
        ];

        return pendingStatuses.includes(payout.status);
      })
      .reduce((sum, payout) => sum + payout.amount, 0);

    const available = Math.max(0, balance - pendingWithdrawals);

    const now = new Date();

    const day = new Date(now);
    day.setHours(0, 0, 0, 0);

    const week = new Date(day);
    week.setDate(week.getDate() - 6);

    const todayEarnings = deliveryEarnings
      .filter((entry) => entry.createdAt >= day && entry.amount > 0)
      .reduce((sum, entry) => sum + entry.amount, 0);

    const weekEarnings = deliveryEarnings
      .filter((entry) => entry.createdAt >= week && entry.amount > 0)
      .reduce((sum, entry) => sum + entry.amount, 0);

    const totalEarned = deliveryEarnings
      .filter((entry) => entry.amount > 0)
      .reduce((sum, entry) => sum + entry.amount, 0);

    const cashBalance = cash.reduce(
      (sum, transaction) =>
        sum +
        (transaction.type === RiderCashTransactionType.REMITTANCE
          ? -transaction.amount
          : transaction.amount),
      0,
    );

    return {
      riderId: rider.id,
      availableBalance: available,
      ledgerBalance: balance,
      pendingWithdrawals,
      totalEarned,
      todayEarnings,
      weekEarnings,
      cashBalance,
      bankAccount: {
        bankName: rider.bankName,
        accountName: rider.bankAccountName,
        accountNumberLast4: rider.bankAccountNumber
          ? rider.bankAccountNumber.slice(-4)
          : null,
      },
      recentTransactions: entries.slice(0, 10),
      recentPayouts: payouts.slice(0, 10),
    };
  }

  async earnings(ownerUserId: string, from?: string, to?: string) {
    const rider = await this.rider(ownerUserId);

    const start = from
      ? new Date(from)
      : new Date(Date.now() - 29 * 86400000);

    start.setHours(0, 0, 0, 0);

    const end = to ? new Date(to) : new Date();
    end.setHours(23, 59, 59, 999);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start > end
    ) {
      throw new BadRequestException('Invalid earnings date range.');
    }

    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        accountType: LedgerAccountType.RIDER,
        accountId: rider.id,
        type: LedgerEntryType.RIDER_EARNING,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const deliveryEarnings = entries.filter((entry) => entry.amount > 0);

    const total = entries.reduce((sum, entry) => sum + entry.amount, 0);

    const deliveryEarningsTotal = deliveryEarnings.reduce(
      (sum, entry) => sum + entry.amount,
      0,
    );

    const daily = new Map<string, number>();

    for (const entry of entries) {
      const key = entry.createdAt.toISOString().slice(0, 10);

      daily.set(
        key,
        (daily.get(key) || 0) + entry.amount,
      );
    }

    return {
      from: start.toISOString(),
      to: end.toISOString(),
      total,
      deliveryEarnings: deliveryEarningsTotal,
      transactionCount: entries.length,
      daily: Array.from(daily, ([date, amount]) => ({
        date,
        amount,
      })),
      entries,
    };
  }

  async transactions(ownerUserId: string, limit = 100) {
    const rider = await this.rider(ownerUserId);

    return this.prisma.ledgerEntry.findMany({
      where: {
        accountType: LedgerAccountType.RIDER,
        accountId: rider.id,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  async payouts(ownerUserId: string) {
    const rider = await this.rider(ownerUserId);

    return this.prisma.riderPayout.findMany({
      where: { riderId: rider.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async requestPayout(ownerUserId: string, amount: number) {
    const rider = await this.rider(ownerUserId);

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException(
        'Payout amount must be a positive whole number of kobo.',
      );
    }

    if (
      !rider.bankAccountNumber ||
      !rider.bankAccountName ||
      !rider.bankName
    ) {
      throw new BadRequestException(
        'Add a verified bank account before requesting a payout.',
      );
    }

    const payout = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "riders" WHERE id = ${rider.id} FOR UPDATE`;

      const ledgerRows = await tx.ledgerEntry.findMany({
        where: {
          accountType: LedgerAccountType.RIDER,
          accountId: rider.id,
        },
        select: { amount: true },
      });
      const balance = ledgerRows.reduce((sum, entry) => sum + entry.amount, 0);

      const pending = await tx.riderPayout.aggregate({
        where: {
          riderId: rider.id,
          status: {
            in: [RiderPayoutStatus.REQUESTED, RiderPayoutStatus.PROCESSING],
          },
        },
        _sum: { amount: true },
      });
      const pendingAmount = pending._sum.amount ?? 0;
      const available = Math.max(0, balance - pendingAmount);

      if (amount > available) {
        throw new BadRequestException(
          'Requested payout exceeds your available balance.',
        );
      }

      const reference = `RZ-RP-${Date.now()}-${rider.id
        .slice(0, 8)
        .toUpperCase()}`;

      return tx.riderPayout.create({
        data: {
          riderId: rider.id,
          amount,
          reference,
          bankName: rider.bankName,
          accountName: rider.bankAccountName,
          accountNumberLast4: rider.bankAccountNumber!.slice(-4),
        },
      });
    });

    await this.audit.record({
      actorId: rider.ownerUserId,
      action: 'rider.payout.requested',
      entityType: 'RiderPayout',
      entityId: payout.id,
      after: {
        amount,
        reference: payout.reference,
      },
    });

    return payout;
  }

  async cash(
    ownerUserId: string,
    type: RiderCashTransactionType,
    amount: number,
    orderId?: string,
    description?: string,
    evidenceUrl?: string,
  ) {
    const rider = await this.rider(ownerUserId);

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('Cash amount must be positive.');
    }

    let deliveryId: string | undefined;

    if (orderId) {
      const delivery = await this.prisma.delivery.findFirst({
        where: {
          riderId: rider.id,
          orderId,
        },
      });

      if (!delivery) {
        throw new BadRequestException(
          'That order is not assigned to this rider.',
        );
      }

      deliveryId = delivery.id;
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "riders" WHERE id = ${rider.id} FOR UPDATE`;

      const current = await tx.riderCashTransaction.findMany({
        where: { riderId: rider.id },
      });

      const balance = current.reduce(
        (sum, transaction) =>
          sum +
          (transaction.type === RiderCashTransactionType.REMITTANCE
            ? -transaction.amount
            : transaction.amount),
        0,
      );

      if (
        type === RiderCashTransactionType.REMITTANCE &&
        amount > balance
      ) {
        throw new BadRequestException(
          'Remittance exceeds cash on hand.',
        );
      }

      return tx.riderCashTransaction.create({
        data: {
          riderId: rider.id,
          type,
          amount,
          orderId,
          deliveryId,
          description,
          evidenceUrl,
        },
      });
    });
  }

  async cashHistory(ownerUserId: string) {
    const rider = await this.rider(ownerUserId);

    const rows = await this.prisma.riderCashTransaction.findMany({
      where: { riderId: rider.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
    });

    const balance = rows.reduce(
      (sum, transaction) =>
        sum +
        (transaction.type === RiderCashTransactionType.REMITTANCE
          ? -transaction.amount
          : transaction.amount),
      0,
    );

    return {
      balance,
      rows,
    };
  }

  async markPayoutPaid(
    riderPayoutId: string,
    actorId: string,
  ) {
    const payout = await this.prisma.riderPayout.findUnique({
      where: { id: riderPayoutId },
    });

    if (!payout) {
      throw new NotFoundException('Rider payout not found.');
    }

    if (payout.status === RiderPayoutStatus.PAID) {
      return payout;
    }

    const nonPayableStatuses: RiderPayoutStatus[] = [
      RiderPayoutStatus.CANCELLED,
      RiderPayoutStatus.FAILED,
    ];

    if (nonPayableStatuses.includes(payout.status)) {
      throw new BadRequestException(
        'This payout is no longer payable.',
      );
    }

    const balance = await this.ledger.getRiderBalance(
      payout.riderId,
    );

    if (balance < payout.amount) {
      throw new BadRequestException(
        'Rider balance is lower than this payout.',
      );
    }

    const entry = await this.ledger.record({
      type: LedgerEntryType.PAYOUT,
      accountType: LedgerAccountType.RIDER,
      accountId: payout.riderId,
      amount: -payout.amount,
      description: `Rider payout ${payout.reference}`,
      idempotencyKey: `rider-payout:${payout.id}`,
    });

    const updated = await this.prisma.riderPayout.update({
      where: { id: payout.id },
      data: {
        status: RiderPayoutStatus.PAID,
        ledgerEntryId: entry.id,
        processedAt: new Date(),
      },
    });

    await this.audit.record({
      actorId,
      action: 'rider.payout.paid',
      entityType: 'RiderPayout',
      entityId: payout.id,
      after: {
        amount: payout.amount,
        reference: payout.reference,
      },
    });

    return updated;
  }
}