from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8-sig')
    if new in text:
        return
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


# Rider onboarding must not attach riders to inactive service areas. This keeps
# dispatch eligibility aligned with the active marketplace footprint.
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

# A rider must still be an eligible, online rider at the moment an offer is
# accepted. Going offline after receiving an offer must not create a way to
# accept work while unavailable/suspended.
replace_once(
    'backend/src/modules/delivery/dispatch.service.ts',
    "    const rider = await this.getOwnedRider(\n      riderOwnerUserId,\n    );\n\n    const attempt = await this.getOwnedAttempt(\n      rider.id,\n      attemptId,\n    );",
    "    const rider = await this.getOwnedRider(\n      riderOwnerUserId,\n    );\n\n    if (\n      ![RiderStatus.APPROVED, RiderStatus.ACTIVE].includes(rider.status) ||\n      !rider.isOnline\n    ) {\n      throw new ForbiddenException(\n        'You must be an approved, online rider to accept a delivery.',\n      );\n    }\n\n    const attempt = await this.getOwnedAttempt(\n      rider.id,\n      attemptId,\n    );",
)

# Do not issue a second live offer to a rider who already has an unexpired
# offer. Accepted deliveries are counted separately below for workload limits.
replace_once(
    'backend/src/modules/delivery/dispatch.service.ts',
    "        location: {\n          isNot: null,\n        },\n      },",
    "        location: {\n          isNot: null,\n        },\n        deliveryAttempts: {\n          none: {\n            status: DeliveryAttemptStatus.OFFERED,\n            expiresAt: { gt: new Date() },\n          },\n        },\n      },",
)

# Declining an already-expired offer must not be able to race the timeout
# path and create another candidate from a stale state.
replace_once(
    'backend/src/modules/delivery/dispatch.service.ts',
    "    const attempt = await this.getOwnedAttempt(\n      rider.id,\n      attemptId,\n    );\n\n    if (\n      attempt.status !==\n      DeliveryAttemptStatus.OFFERED\n    ) {",
    "    const attempt = await this.getOwnedAttempt(\n      rider.id,\n      attemptId,\n    );\n\n    await this.expireStaleOffers(attempt.deliveryId);\n\n    const fresh = await this.prisma.deliveryAttempt.findUnique({\n      where: { id: attemptId },\n    });\n\n    if (\n      !fresh ||\n      fresh.status !==\n      DeliveryAttemptStatus.OFFERED\n    ) {",
)

print('batch31 rider audit patch applied')
