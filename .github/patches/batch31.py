from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8-sig')
    if 'dispatch.service.ts' in str(p) and all(
        marker in text
        for marker in (
            'eligibleStatuses: RiderStatus[]',
            'deliveryAttempts:',
            'await this.expireStaleOffers(attempt.deliveryId);',
            'const fresh = await this.prisma.deliveryAttempt.findUnique',
        )
    ):
        return
    if 'rider-finance.service.ts' in str(p) and all(
        marker in text
        for marker in (
            'const payout = await this.prisma.$transaction(async (tx)',
            'SELECT id FROM "riders" WHERE id = ${rider.id} FOR UPDATE',
        )
    ):
        return
    if new in text:
        return
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'backend/src/modules/riders/riders.service.ts',
    "    const areas = await this.prisma.serviceArea.findMany({\n      where: { id: { in: dto.serviceAreaIds } },\n    });",
    "    const areas = await this.prisma.serviceArea.findMany({\n      where: {\n        id: { in: dto.serviceAreaIds },\n        status: 'ACTIVE',\n      },\n    });",
)
replace_once(
    'backend/src/modules/riders/riders.service.ts',
    "    if (!area) {\n      throw new NotFoundException('Service area not found.');\n    }",
    "    if (!area) {\n      throw new NotFoundException('Service area not found.');\n    }\n\n    if (area.status !== 'ACTIVE') {\n      throw new BadRequestException('Only active service areas can be added.');\n    }",
)
replace_once(
    'backend/src/modules/delivery/dispatch.service.ts',
    "    const rider = await this.getOwnedRider(\n      riderOwnerUserId,\n    );\n\n    const attempt = await this.getOwnedAttempt(\n      rider.id,\n      attemptId,\n    );",
    "    const rider = await this.getOwnedRider(\n      riderOwnerUserId,\n    );\n\n    const eligibleStatuses: RiderStatus[] = [\n      RiderStatus.APPROVED,\n      RiderStatus.ACTIVE,\n    ];\n\n    if (!eligibleStatuses.includes(rider.status as RiderStatus) || !rider.isOnline) {\n      throw new ForbiddenException(\n        'You must be an approved, online rider to accept a delivery.',\n      );\n    }\n\n    const attempt = await this.getOwnedAttempt(\n      rider.id,\n      attemptId,\n    );",
)
replace_once(
    'backend/src/modules/delivery/dispatch.service.ts',
    "        location: {\n          isNot: null,\n        },\n      },",
    "        location: {\n          isNot: null,\n        },\n        deliveryAttempts: {\n          none: {\n            status: DeliveryAttemptStatus.OFFERED,\n            expiresAt: { gt: new Date() },\n          },\n        },\n      },",
)
replace_once(
    'backend/src/modules/delivery/dispatch.service.ts',
    "    const attempt = await this.getOwnedAttempt(\n      rider.id,\n      attemptId,\n    );\n\n    if (\n      attempt.status !==\n      DeliveryAttemptStatus.OFFERED\n    ) {",
    "    const attempt = await this.getOwnedAttempt(\n      rider.id,\n      attemptId,\n    );\n\n    await this.expireStaleOffers(attempt.deliveryId);\n\n    const fresh = await this.prisma.deliveryAttempt.findUnique({\n      where: { id: attemptId },\n    });\n\n    if (\n      !fresh ||\n      fresh.status !==\n      DeliveryAttemptStatus.OFFERED\n    ) {",
)

replace_once(
    'backend/src/modules/riders/rider-finance.service.ts',
    "    const overview = await this.overview(ownerUserId);\n\n    if (!Number.isInteger(amount) || amount <= 0) {\n      throw new BadRequestException(\n        'Payout amount must be a positive whole number of kobo.',\n      );\n    }\n\n    if (amount > overview.availableBalance) {\n      throw new BadRequestException(\n        'Requested payout exceeds your available balance.',\n      );\n    }\n\n    if (\n      !rider.bankAccountNumber ||\n      !rider.bankAccountName ||\n      !rider.bankName\n    ) {\n      throw new BadRequestException(\n        'Add a verified bank account before requesting a payout.',\n      );\n    }\n\n    const reference = `RZ-RP-${Date.now()}-${rider.id\n      .slice(0, 8)\n      .toUpperCase()}`;\n\n    const payout = await this.prisma.riderPayout.create({\n      data: {\n        riderId: rider.id,\n        amount,\n        reference,\n        bankName: rider.bankName,\n        accountName: rider.bankAccountName,\n        accountNumberLast4: rider.bankAccountNumber.slice(-4),\n      },\n    });",
    "    if (!Number.isInteger(amount) || amount <= 0) {\n      throw new BadRequestException(\n        'Payout amount must be a positive whole number of kobo.',\n      );\n    }\n\n    if (\n      !rider.bankAccountNumber ||\n      !rider.bankAccountName ||\n      !rider.bankName\n    ) {\n      throw new BadRequestException(\n        'Add a verified bank account before requesting a payout.',\n      );\n    }\n\n    const payout = await this.prisma.$transaction(async (tx) => {\n      await tx.$queryRaw`SELECT id FROM \"riders\" WHERE id = ${rider.id} FOR UPDATE`;\n\n      const ledgerRows = await tx.ledgerEntry.findMany({\n        where: { accountType: LedgerAccountType.RIDER, accountId: rider.id },\n        select: { amount: true },\n      });\n      const balance = ledgerRows.reduce((sum, entry) => sum + entry.amount, 0);\n\n      const pending = await tx.riderPayout.aggregate({\n        where: {\n          riderId: rider.id,\n          status: { in: [RiderPayoutStatus.REQUESTED, RiderPayoutStatus.PROCESSING] },\n        },\n        _sum: { amount: true },\n      });\n      const pendingAmount = pending._sum.amount ?? 0;\n      const available = Math.max(0, balance - pendingAmount);\n\n      if (amount > available) {\n        throw new BadRequestException(\n          'Requested payout exceeds your available balance.',\n        );\n      }\n\n      const reference = `RZ-RP-${Date.now()}-${rider.id\n        .slice(0, 8)\n        .toUpperCase()}`;\n\n      return tx.riderPayout.create({\n        data: {\n          riderId: rider.id,\n          amount,\n          reference,\n          bankName: rider.bankName,\n          accountName: rider.bankAccountName,\n          accountNumberLast4: rider.bankAccountNumber.slice(-4),\n        },\n      });\n    });",
)
replace_once(
    'backend/src/modules/riders/rider-finance.service.ts',
    "    const current = await this.prisma.riderCashTransaction.findMany({\n      where: { riderId: rider.id },\n    });\n\n    const balance = current.reduce(\n      (sum, transaction) =>\n        sum +\n        (transaction.type === RiderCashTransactionType.REMITTANCE\n          ? -transaction.amount\n          : transaction.amount),\n      0,\n    );\n\n    if (\n      type === RiderCashTransactionType.REMITTANCE &&\n      amount > balance\n    ) {\n      throw new BadRequestException(\n        'Remittance exceeds cash on hand.',\n      );\n    }\n\n    return this.prisma.riderCashTransaction.create({\n      data: {\n        riderId: rider.id,\n        type,\n        amount,\n        orderId,\n        deliveryId,\n        description,\n        evidenceUrl,\n      },\n    });",
    "    return this.prisma.$transaction(async (tx) => {\n      await tx.$queryRaw`SELECT id FROM \"riders\" WHERE id = ${rider.id} FOR UPDATE`;\n\n      const current = await tx.riderCashTransaction.findMany({\n        where: { riderId: rider.id },\n      });\n\n      const balance = current.reduce(\n        (sum, transaction) =>\n          sum +\n          (transaction.type === RiderCashTransactionType.REMITTANCE\n            ? -transaction.amount\n            : transaction.amount),\n        0,\n      );\n\n      if (\n        type === RiderCashTransactionType.REMITTANCE &&\n        amount > balance\n      ) {\n        throw new BadRequestException(\n          'Remittance exceeds cash on hand.',\n        );\n      }\n\n      return tx.riderCashTransaction.create({\n        data: {\n          riderId: rider.id,\n          type,\n          amount,\n          orderId,\n          deliveryId,\n          description,\n          evidenceUrl,\n        },\n      });\n    });",
)

print('batch31 rider audit patch applied')
