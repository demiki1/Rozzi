import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import {
  DISTANCE_SERVICE,
  DistanceService,
} from '../maps/distance.service';
import { Inject } from '@nestjs/common';
import {
  OrderStatus,
  RiderShiftStatus,
} from '@prisma/client';
import { PricingService } from '../pricing/pricing.service';

@Injectable()
export class RiderOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    @Inject(DISTANCE_SERVICE)
    private readonly distance: DistanceService,
    private readonly pricing: PricingService,
  ) {}

  private async rider(ownerUserId: string) {
    const rider = await this.prisma.rider.findUnique({
      where: { ownerUserId },
      include: {
        location: true,
        zones: {
          include: {
            serviceArea: true,
          },
        },
      },
    });

    if (!rider) {
      throw new NotFoundException(
        'No rider profile found for this account.',
      );
    }

    return rider;
  }

  async overview(ownerUserId: string) {
    const rider = await this.rider(ownerUserId);

    const [active, nextShift, zones, batches] =
      await Promise.all([
        this.prisma.delivery.findMany({
          where: {
            riderId: rider.id,
            deliveredAt: null,
          },
          select: {
            id: true,
            orderId: true,
            groupId: true,
            order: {
              select: {
                orderNumber: true,
                status: true,
              },
            },
          },
          take: 10,
        }),

        this.prisma.riderShift.findFirst({
          where: {
            riderId: rider.id,
            startsAt: {
              gte: new Date(),
            },
            status: {
              in: [
                RiderShiftStatus.BOOKED,
                RiderShiftStatus.CHECKED_IN,
              ],
            },
          },
          orderBy: {
            startsAt: 'asc',
          },
          include: {
            serviceArea: true,
          },
        }),

        Promise.all(
          rider.zones.map(async (z) => {
            const pricing = await this.pricing.getActiveConfig(
              z.serviceAreaId,
            );

            return {
              id: z.serviceAreaId,
              name: z.serviceArea.name,
              status: z.serviceArea.status,
              defaultRadiusKm: Number(
                pricing.deliveryRadiusKm,
              ),
            };
          }),
        ),

        this.batches(ownerUserId),
      ]);

    return {
      online: rider.isOnline,
      location: rider.location,
      activeDeliveries: active,
      nextShift,
      zones,
      batches,
    };
  }

  async heatmap(ownerUserId: string, hours = 6) {
    const rider = await this.rider(ownerUserId);

    const from = new Date(
      Date.now() -
        Math.max(
          1,
          Math.min(48, Number(hours) || 6),
        ) *
          3600000,
    );

    const orders = await this.prisma.delivery.findMany({
      where: {
        createdAt: {
          gte: from,
        },
        order: {
          serviceAreaId: {
            in: rider.zones.map(
              (z) => z.serviceAreaId,
            ),
          },
          status: {
            in: [
              OrderStatus.READY_FOR_PICKUP,
              OrderStatus.RIDER_SEARCHING,
              OrderStatus.RIDER_ASSIGNED,
              OrderStatus.PICKED_UP,
              OrderStatus.IN_TRANSIT,
            ],
          },
        },
      },
      select: {
        id: true,
        pickupLatitude: true,
        pickupLongitude: true,
        dropoffLatitude: true,
        dropoffLongitude: true,
        createdAt: true,
      },
    });

    const buckets = new Map<string, any>();

    for (const d of orders) {
      if (
        d.pickupLatitude == null ||
        d.pickupLongitude == null
      ) {
        continue;
      }

      const lat =
        Math.round(
          Number(d.pickupLatitude) * 100,
        ) / 100;

      const lon =
        Math.round(
          Number(d.pickupLongitude) * 100,
        ) / 100;

      const key = `${lat}:${lon}`;

      const row =
        buckets.get(key) || {
          latitude: lat,
          longitude: lon,
          demand: 0,
          label: 'Active demand',
        };

      row.demand += 1;
      buckets.set(key, row);
    }

    return {
      generatedAt: new Date().toISOString(),
      windowHours: hours,
      hotspots: Array.from(
        buckets.values(),
      )
        .sort(
          (a, b) => b.demand - a.demand,
        )
        .slice(0, 30),
      note:
        'Heatmap is derived from recent ROZZI delivery demand; it is not a predictive forecast.',
    };
  }

  async zones(ownerUserId: string) {
    const rider = await this.rider(ownerUserId);

    return Promise.all(
      rider.zones.map(async (z) => {
        const pricing =
          await this.pricing.getActiveConfig(
            z.serviceAreaId,
          );

        return {
          id: z.serviceAreaId,
          name: z.serviceArea.name,
          status: z.serviceArea.status,
          defaultDeliveryRadiusKm: Number(
            pricing.deliveryRadiusKm,
          ),
          operatingHoursStart:
            z.serviceArea.operatingHoursStart,
          operatingHoursEnd:
            z.serviceArea.operatingHoursEnd,
        };
      }),
    );
  }

  async schedule(
    ownerUserId: string,
    from?: string,
    to?: string,
  ) {
    const rider = await this.rider(ownerUserId);

    const start = from
      ? new Date(from)
      : new Date();

    const end = to
      ? new Date(to)
      : new Date(
          Date.now() + 14 * 86400000,
        );

    return this.prisma.riderShift.findMany({
      where: {
        riderId: rider.id,
        startsAt: {
          lt: end,
        },
        endsAt: {
          gt: start,
        },
      },
      orderBy: {
        startsAt: 'asc',
      },
      include: {
        serviceArea: true,
      },
    });
  }

  async bookShift(
    ownerUserId: string,
    body: {
      startsAt: string;
      endsAt: string;
      serviceAreaId?: string;
    },
  ) {
    const rider = await this.rider(ownerUserId);

    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);

    if (
      !Number.isFinite(
        startsAt.getTime(),
      ) ||
      !Number.isFinite(
        endsAt.getTime(),
      ) ||
      endsAt <= startsAt
    ) {
      throw new BadRequestException(
        'Shift end time must be after start time.',
      );
    }

    if (startsAt < new Date()) {
      throw new BadRequestException(
        'A shift cannot start in the past.',
      );
    }

    if (
      body.serviceAreaId &&
      !rider.zones.some(
        (z) =>
          z.serviceAreaId ===
          body.serviceAreaId,
      )
    ) {
      throw new BadRequestException(
        'You are not assigned to that delivery zone.',
      );
    }

    const overlap =
      await this.prisma.riderShift.findFirst({
        where: {
          riderId: rider.id,
          status: {
            in: [
              RiderShiftStatus.BOOKED,
              RiderShiftStatus.CHECKED_IN,
            ],
          },
          startsAt: {
            lt: endsAt,
          },
          endsAt: {
            gt: startsAt,
          },
        },
      });

    if (overlap) {
      throw new BadRequestException(
        'You already have a shift during this time.',
      );
    }

    const shift =
      await this.prisma.riderShift.create({
        data: {
          riderId: rider.id,
          serviceAreaId:
            body.serviceAreaId,
          startsAt,
          endsAt,
        },
      });

    await this.audit.record({
      actorId: rider.ownerUserId,
      action: 'RIDER_SHIFT_BOOKED',
      entityType: 'RiderShift',
      entityId: shift.id,
      after: {
        startsAt,
        endsAt,
        serviceAreaId:
          body.serviceAreaId,
      },
    });

    return shift;
  }

  async cancelShift(
    ownerUserId: string,
    id: string,
  ) {
    const rider = await this.rider(ownerUserId);

    const shift =
      await this.prisma.riderShift.findFirst({
        where: {
          id,
          riderId: rider.id,
        },
      });

    if (!shift) {
      throw new NotFoundException(
        'Shift not found.',
      );
    }

    const cancellableStatuses: RiderShiftStatus[] =
      [RiderShiftStatus.BOOKED];

    if (
      !cancellableStatuses.includes(
        shift.status,
      )
    ) {
      throw new BadRequestException(
        'Only booked shifts can be cancelled.',
      );
    }

    return this.prisma.riderShift.update({
      where: { id },
      data: {
        status:
          RiderShiftStatus.CANCELLED,
      },
    });
  }

  async checkIn(
    ownerUserId: string,
    id: string,
  ) {
    const rider = await this.rider(ownerUserId);

    const shift =
      await this.prisma.riderShift.findFirst({
        where: {
          id,
          riderId: rider.id,
        },
      });

    if (!shift) {
      throw new NotFoundException(
        'Shift not found.',
      );
    }

    if (
      shift.status !==
      RiderShiftStatus.BOOKED
    ) {
      throw new BadRequestException(
        'This shift cannot be checked in.',
      );
    }

    const now = new Date();

    if (
      now <
      new Date(
        shift.startsAt.getTime() -
          15 * 60000,
      )
    ) {
      throw new BadRequestException(
        'Check-in opens 15 minutes before the shift.',
      );
    }

    if (now > shift.endsAt) {
      throw new BadRequestException(
        'This shift has already ended.',
      );
    }

    return this.prisma.riderShift.update({
      where: { id },
      data: {
        status:
          RiderShiftStatus.CHECKED_IN,
        checkedInAt: now,
      },
    });
  }

  async batches(ownerUserId: string) {
    const rider = await this.rider(ownerUserId);

    const current =
      await this.prisma.delivery.findFirst({
        where: {
          riderId: rider.id,
          deliveredAt: null,
          order: {
            status: {
              in: [
                OrderStatus.RIDER_ASSIGNED,
                OrderStatus.RIDER_ARRIVED_PICKUP,
                OrderStatus.PICKED_UP,
                OrderStatus.IN_TRANSIT,
                OrderStatus.RIDER_ARRIVED,
              ],
            },
          },
        },
        include: {
          order: {
            select: {
              orderNumber: true,
              serviceAreaId: true,
              status: true,
            },
          },
        },
        orderBy: {
          assignedAt: 'asc',
        },
      });

    if (!current) {
      return [];
    }

    const candidates =
      await this.prisma.delivery.findMany({
        where: {
          riderId: null,
          groupId: null,
          deliveredAt: null,
          order: {
            serviceAreaId:
              current.order.serviceAreaId,
            status: {
              in: [
                OrderStatus.READY_FOR_PICKUP,
                OrderStatus.RIDER_SEARCHING,
              ],
            },
          },
          pickupLatitude: {
            not: null,
          },
          pickupLongitude: {
            not: null,
          },
        },
        include: {
          order: {
            select: {
              orderNumber: true,
              status: true,
              deliveryFeeAmount: true,
            },
          },
        },
        take: 30,
      });

    if (
      current.pickupLatitude == null ||
      current.pickupLongitude == null
    ) {
      return [];
    }

    const out = candidates
      .map((c) => ({
        deliveryId: c.id,
        orderNumber:
          c.order.orderNumber,
        distanceKm:
          this.distance.distanceKm(
            Number(
              current.dropoffLatitude ??
                current.pickupLatitude,
            ),
            Number(
              current.dropoffLongitude ??
                current.pickupLongitude,
            ),
            Number(c.pickupLatitude),
            Number(c.pickupLongitude),
          ),
        deliveryFeeAmount:
          c.order.deliveryFeeAmount,
      }))
      .filter(
        (x) => x.distanceKm <= 2,
      )
      .sort(
        (a, b) =>
          a.distanceKm -
          b.distanceKm,
      )
      .slice(0, 5);

    return out;
  }

  async acceptBatch(
    ownerUserId: string,
    deliveryId: string,
  ) {
    const rider = await this.rider(ownerUserId);

    const currentCount =
      await this.prisma.delivery.count({
        where: {
          riderId: rider.id,
          deliveredAt: null,
        },
      });

    if (currentCount >= 2) {
      throw new BadRequestException(
        'ROZZI currently limits a rider to two active deliveries in a batch.',
      );
    }

    const candidate =
      await this.prisma.delivery.findUnique({
        where: {
          id: deliveryId,
        },
        include: {
          order: true,
        },
      });

    if (
      !candidate ||
      candidate.riderId ||
      candidate.deliveredAt
    ) {
      throw new BadRequestException(
        'This delivery is no longer available for batching.',
      );
    }

    const current =
      await this.prisma.delivery.findFirst({
        where: {
          riderId: rider.id,
          deliveredAt: null,
        },
        orderBy: {
          assignedAt: 'asc',
        },
        include: {
          order: {
            select: {
              serviceAreaId: true,
            },
          },
        },
      });

    if (
      !current ||
      current.orderId === candidate.orderId ||
      current.order.serviceAreaId !==
        candidate.order.serviceAreaId
    ) {
      throw new BadRequestException(
        'This delivery cannot be added to your current route.',
      );
    }

    const groupId =
      current.groupId ||
      (
        await this.prisma.deliveryGroup.create({
          data: {
            maxOrders: 2,
          },
        })
      ).id;

    await this.prisma.delivery.update({
      where: {
        id: current.id,
      },
      data: {
        groupId,
      },
    });

    const claimed =
      await this.prisma.delivery.updateMany({
        where: {
          id: candidate.id,
          riderId: null,
          groupId: null,
        },
        data: {
          riderId: rider.id,
          groupId,
          assignedAt: new Date(),
        },
      });

    if (claimed.count !== 1) {
      throw new BadRequestException(
        'This delivery was taken by another rider.',
      );
    }

    await this.audit.record({
      actorId: rider.ownerUserId,
      action: 'RIDER_BATCH_ACCEPTED',
      entityType: 'DeliveryGroup',
      entityId: groupId,
      after: {
        deliveryId,
      },
    });

    return this.prisma.deliveryGroup.findUnique({
      where: {
        id: groupId,
      },
      include: {
        deliveries: {
          include: {
            order: {
              select: {
                orderNumber: true,
                status: true,
              },
            },
          },
        },
      },
    });
  }
}