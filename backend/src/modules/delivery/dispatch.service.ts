import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { vendorForUser } from '../../common/utils/vendor-context';
import { SettingsService } from '../../config/settings.service';
import { OrdersService } from '../orders/orders.service';
import { DISTANCE_SERVICE, DistanceService } from '../maps/distance.service';
import { PUBLIC_VENDOR_SELECT } from '../vendors/vendor-public-select';
import { AuditLogService } from '../audit/audit-log.service';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DELIVERY_OTP_GENERATED_EVENT, DeliveryOtpGeneratedPayload, DELIVERY_OFFERED_EVENT } from './delivery-events';
import { ORDER_TRANSITIONED_EVENT, OrderTransitionedPayload } from '../orders/order-events';
import { DeliveryAttemptStatus, OrderDeliveryType, OrderStatus, RiderStatus, UserRole } from '@prisma/client';

const SETTING_KEYS = {
  timeoutSeconds: 'dispatch.assignmentTimeoutSeconds',
  maxDistanceKm: 'dispatch.maxRiderDistanceKm',
  maxAttempts: 'dispatch.maxAssignmentAttempts',
};
const DEFAULTS = { timeoutSeconds: 60, maxDistanceKm: 8, maxAttempts: 5 };

@Injectable()
export class DispatchService {
  private readonly logger = new Logger('DispatchService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly ordersService: OrdersService,
    private readonly eventEmitter: EventEmitter2,
    private readonly audit: AuditLogService,
    @Inject(DISTANCE_SERVICE) private readonly distance: DistanceService,
  ) {}

  async startDispatch(orderId: string, actorUserId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { vendor: true, address: true },
    });
    if (!order) throw new NotFoundException('Order not found.');

    if (actorUserId) {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorUserId },
        select: { role: true },
      });
      if (!actor) throw new ForbiddenException('You do not have access to this order.');
      if (actor.role === UserRole.VENDOR) {
        const vendor = await vendorForUser(this.prisma, actorUserId);
        if (!vendor || vendor.id !== order.vendorId) {
          throw new ForbiddenException('You do not have access to this order.');
        }
      } else if (actor.role !== UserRole.ADMIN) {
        throw new ForbiddenException('You do not have access to this order.');
      }
    }

    if (order.deliveryType !== OrderDeliveryType.DELIVERY) {
      throw new BadRequestException('Only delivery-type orders go through rider dispatch.');
    }
    if (order.status !== OrderStatus.READY_FOR_PICKUP) {
      throw new BadRequestException('Order must be marked ready for pickup before dispatch starts.');
    }

    const existing = await this.prisma.delivery.findUnique({ where: { orderId } });
    if (existing) throw new BadRequestException('Dispatch has already started for this order.');

    const vendorLocation = await this.prisma.vendorLocation.findFirst({
      where: { vendorId: order.vendorId, serviceAreaId: order.serviceAreaId },
    });

    const delivery = await this.prisma.delivery.create({
      data: {
        orderId: order.id,
        pickupLatitude: vendorLocation?.latitude,
        pickupLongitude: vendorLocation?.longitude,
        dropoffLatitude: order.address?.latitude,
        dropoffLongitude: order.address?.longitude,
      },
    });

    await this.ordersService.transitionOrder(orderId, OrderStatus.RIDER_SEARCHING);
    const result = await this.offerNextCandidate(delivery.id);
    return { delivery, ...result };
  }

  private async offerNextCandidate(deliveryId: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: true },
    });
    if (!delivery) throw new NotFoundException('Delivery not found.');

    const maxAttempts = await this.settings.getNumber(SETTING_KEYS.maxAttempts, DEFAULTS.maxAttempts);
    if (delivery.attemptCount >= maxAttempts) {
      this.logger.warn(`Delivery ${deliveryId} exhausted ${maxAttempts} rider offers with no acceptance.`);
      return { offered: false, reason: 'max_attempts_exhausted' as const };
    }

    const alreadyTriedRiderIds = (
      await this.prisma.deliveryAttempt.findMany({
        where: {
          deliveryId,
          status: { in: [DeliveryAttemptStatus.DECLINED, DeliveryAttemptStatus.TIMED_OUT] },
        },
        select: { riderId: true },
      })
    ).map((a) => a.riderId);

    const maxDistanceKm = await this.settings.getNumber(SETTING_KEYS.maxDistanceKm, DEFAULTS.maxDistanceKm);

    const candidates = await this.prisma.rider.findMany({
      where: {
        isOnline: true,
        status: { in: [RiderStatus.APPROVED, RiderStatus.ACTIVE] },
        id: { notIn: alreadyTriedRiderIds },
        zones: { some: { serviceAreaId: delivery.order.serviceAreaId } },
        location: { isNot: null },
        deliveryAttempts: {
          none: {
            status: DeliveryAttemptStatus.OFFERED,
            expiresAt: { gt: new Date() },
          },
        },
      },
      include: {
        location: true,
        reviews: {
          select: { riderRating: true },
          where: { riderRating: { not: null } },
        },
        deliveries: {
          where: { deliveredAt: null },
          select: { id: true },
        },
      },
    });

    let ranked = candidates;
    if (delivery.pickupLatitude != null && delivery.pickupLongitude != null) {
      const pickupLat = Number(delivery.pickupLatitude);
      const pickupLon = Number(delivery.pickupLongitude);
      ranked = candidates
        .map((rider) => {
          const distanceKm = this.distance.distanceKm(
            pickupLat,
            pickupLon,
            Number(rider.location!.latitude),
            Number(rider.location!.longitude),
          );
          const ratings = rider.reviews.map((x) => Number(x.riderRating || 0)).filter(Boolean);
          const rating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
          const activeLoad = rider.deliveries.length;
          const distanceScore = Math.max(0, 1 - distanceKm / Math.max(maxDistanceKm, 1));
          const workloadScore = activeLoad === 0 ? 1 : activeLoad === 1 ? 0.55 : 0;
          const ratingScore = rating ? rating / 5 : 0.5;
          const score = distanceScore * 0.55 + workloadScore * 0.25 + ratingScore * 0.2;
          return { rider, distanceKm, score };
        })
        .filter((r) => r.distanceKm <= maxDistanceKm && r.rider.deliveries.length < 2)
        .sort((a, b) => b.score - a.score)
        .map((r) => r.rider);
    }

    if (ranked.length === 0) return { offered: false, reason: 'no_candidates_in_range' as const };

    const chosen = ranked[0];
    const distanceKm = delivery.pickupLatitude != null && delivery.pickupLongitude != null
      ? this.distance.distanceKm(
          Number(delivery.pickupLatitude),
          Number(delivery.pickupLongitude),
          Number(chosen.location!.latitude),
          Number(chosen.location!.longitude),
        )
      : null;

    const timeoutSeconds = await this.settings.getNumber(SETTING_KEYS.timeoutSeconds, DEFAULTS.timeoutSeconds);
    const expiresAt = new Date(Date.now() + timeoutSeconds * 1000);

    const attempt = await this.prisma.$transaction(async (tx) => {
      const created = await tx.deliveryAttempt.create({
        data: { deliveryId, riderId: chosen.id, distanceKm: distanceKm ?? undefined, expiresAt },
      });
      await tx.delivery.update({ where: { id: deliveryId }, data: { attemptCount: { increment: 1 } } });
      return created;
    });

    this.eventEmitter.emit(DELIVERY_OFFERED_EVENT, {
      attemptId: attempt.id,
      deliveryId,
      orderId: delivery.orderId,
      orderNumber: delivery.order.orderNumber,
      riderOwnerUserId: chosen.ownerUserId,
      expiresAt: expiresAt.toISOString(),
      distanceKm,
    });

    return { offered: true, riderId: chosen.id, distanceKm };
  }

  private async expireStaleOffers(deliveryId: string) {
    const stale = await this.prisma.deliveryAttempt.findMany({
      where: { deliveryId, status: DeliveryAttemptStatus.OFFERED, expiresAt: { lt: new Date() } },
    });
    for (const attempt of stale) {
      await this.prisma.deliveryAttempt.update({
        where: { id: attempt.id },
        data: { status: DeliveryAttemptStatus.TIMED_OUT, respondedAt: new Date() },
      });
      await this.offerNextCandidate(deliveryId);
    }
  }

  async vendorList(ownerUserId: string) {
    const vendor = await vendorForUser(this.prisma, ownerUserId);
    return this.prisma.delivery.findMany({
      where: { order: { vendorId: vendor.id } },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            deliveryType: true,
            deliveryModel: true,
            totalAmount: true,
            deliveryFeeAmount: true,
            createdAt: true,
            updatedAt: true,
            customer: { select: { id: true, fullName: true, phone: true } },
            address: true,
          },
        },
        rider: {
          select: {
            id: true,
            status: true,
            isOnline: true,
            vehicleType: true,
            vehiclePlateNumber: true,
            owner: { select: { fullName: true, phone: true } },
            location: { select: { latitude: true, longitude: true, updatedAt: true } },
          },
        },
        attempts: {
          select: {
            id: true,
            riderId: true,
            status: true,
            distanceKm: true,
            offeredAt: true,
            expiresAt: true,
            respondedAt: true,
            rider: { select: { owner: { select: { fullName: true } } } },
          },
          orderBy: { offeredAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async vendorStats(ownerUserId: string) {
    const vendor = await vendorForUser(this.prisma, ownerUserId);
    const rows = await this.prisma.delivery.findMany({
      where: { order: { vendorId: vendor.id } },
      select: {
        riderId: true,
        assignedAt: true,
        pickedUpAt: true,
        deliveredAt: true,
        order: { select: { status: true, deliveryType: true, deliveryModel: true } },
      },
    });
    const platform = rows.filter((d) => d.order.deliveryType === OrderDeliveryType.DELIVERY && d.order.deliveryModel !== 'SELF_DELIVERY');
    const inactiveStatuses: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.FAILED, OrderStatus.REFUNDED];
    const active = platform.filter((d) => !d.deliveredAt && !inactiveStatuses.includes(d.order.status));
    const assigned = platform.filter((d) => !!d.riderId);
    const completed = platform.filter((d) => !!d.deliveredAt || d.order.status === OrderStatus.DELIVERED);
    const pickupCount = rows.filter((d) => d.order.deliveryType === OrderDeliveryType.PICKUP).length;
    const selfDeliveryCount = rows.filter((d) => d.order.deliveryModel === 'SELF_DELIVERY').length;
    const durations = completed.filter((d) => d.pickedUpAt && d.deliveredAt).map((d) => d.deliveredAt!.getTime() - d.pickedUpAt!.getTime()).filter((ms) => ms >= 0);
    return {
      total: platform.length,
      active: active.length,
      awaitingRider: platform.filter((d) => d.order.status === OrderStatus.RIDER_SEARCHING && !d.riderId).length,
      assigned: assigned.length,
      pickedUp: platform.filter((d) => !!d.pickedUpAt && !d.deliveredAt).length,
      delivered: completed.length,
      pickupCount,
      selfDeliveryCount,
      avgDeliveryMinutes: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60000) : 0,
    };
  }

  async riderHistory(ownerUserId: string) {
    const rider = await this.getOwnedRider(ownerUserId);
    return this.prisma.delivery.findMany({
      where: { riderId: rider.id },
      select: {
        id: true,
        assignedAt: true,
        pickedUpAt: true,
        deliveredAt: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            deliveryFeeAmount: true,
            totalAmount: true,
            createdAt: true,
            vendor: { select: PUBLIC_VENDOR_SELECT },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async riderStats(ownerUserId: string) {
    const rider = await this.getOwnedRider(ownerUserId);
    const rows = await this.prisma.delivery.findMany({
      where: { riderId: rider.id },
      select: {
        assignedAt: true,
        pickedUpAt: true,
        deliveredAt: true,
        order: { select: { status: true, deliveryFeeAmount: true } },
      },
    });
    const activeStatuses: OrderStatus[] = [OrderStatus.RIDER_ASSIGNED, OrderStatus.RIDER_ARRIVED_PICKUP, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT, OrderStatus.RIDER_ARRIVED];
    const active = rows.filter((d) => !d.deliveredAt && activeStatuses.includes(d.order.status));
    const completed = rows.filter((d) => !!d.deliveredAt);
    const durations = completed.filter((d) => d.pickedUpAt && d.deliveredAt).map((d) => d.deliveredAt!.getTime() - d.pickedUpAt!.getTime()).filter((ms) => ms >= 0);
    return {
      totalDeliveries: rows.length,
      completedDeliveries: completed.length,
      activeDeliveries: active.length,
      totalDeliveryFees: completed.reduce((sum, d) => sum + d.order.deliveryFeeAmount, 0),
      averageDeliveryMinutes: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60000) : 0,
    };
  }

  async acceptOffer(riderOwnerUserId: string, attemptId: string) {
    const rider = await this.getOwnedRider(riderOwnerUserId);
    const eligibleStatuses: RiderStatus[] = [RiderStatus.APPROVED, RiderStatus.ACTIVE];
    if (!eligibleStatuses.includes(rider.status) || !rider.isOnline) {
      throw new ForbiddenException('You must be an approved, online rider to accept a delivery.');
    }

    const attempt = await this.getOwnedAttempt(rider.id, attemptId);
    await this.expireStaleOffers(attempt.deliveryId);
    const fresh = await this.prisma.deliveryAttempt.findUnique({ where: { id: attemptId } });
    if (!fresh || fresh.status !== DeliveryAttemptStatus.OFFERED) {
      throw new BadRequestException('This offer is no longer available.');
    }

    const now = new Date();
    const delivery = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.delivery.updateMany({
        where: { id: attempt.deliveryId, riderId: null, deliveredAt: null },
        data: { riderId: rider.id, assignedAt: now },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('This delivery has already been assigned to another rider.');
      }
      const accepted = await tx.deliveryAttempt.updateMany({
        where: { id: attemptId, riderId: rider.id, status: DeliveryAttemptStatus.OFFERED },
        data: { status: DeliveryAttemptStatus.ACCEPTED, respondedAt: now },
      });
      if (accepted.count !== 1) throw new BadRequestException('This offer is no longer available.');
      return tx.delivery.findUniqueOrThrow({ where: { id: attempt.deliveryId } });
    });

    await this.ordersService.transitionOrder(delivery.orderId, OrderStatus.RIDER_ASSIGNED, rider.ownerUserId);
    return delivery;
  }

  async declineOffer(riderOwnerUserId: string, attemptId: string) {
    const rider = await this.getOwnedRider(riderOwnerUserId);
    const attempt = await this.getOwnedAttempt(rider.id, attemptId);
    await this.expireStaleOffers(attempt.deliveryId);
    const fresh = await this.prisma.deliveryAttempt.findUnique({ where: { id: attemptId } });
    if (!fresh || fresh.status !== DeliveryAttemptStatus.OFFERED) {
      throw new BadRequestException('This offer is no longer active.');
    }
    await this.prisma.deliveryAttempt.update({
      where: { id: attemptId },
      data: { status: DeliveryAttemptStatus.DECLINED, respondedAt: new Date() },
    });
    return this.offerNextCandidate(attempt.deliveryId);
  }

  async getMyOffers(riderOwnerUserId: string) {
    const rider = await this.getOwnedRider(riderOwnerUserId);
    const openOffers = await this.prisma.deliveryAttempt.findMany({
      where: { riderId: rider.id, status: DeliveryAttemptStatus.OFFERED },
      select: { deliveryId: true },
    });
    for (const offer of openOffers) await this.expireStaleOffers(offer.deliveryId);
    return this.prisma.deliveryAttempt.findMany({
      where: { riderId: rider.id, status: DeliveryAttemptStatus.OFFERED, expiresAt: { gt: new Date() } },
      include: {
        delivery: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                subtotalAmount: true,
                deliveryFeeAmount: true,
                totalAmount: true,
                deliveryType: true,
                customerNote: true,
                address: true,
                customer: { select: { id: true, fullName: true } },
                items: { select: { id: true, nameSnapshot: true, quantity: true } },
                vendor: { select: PUBLIC_VENDOR_SELECT },
              },
            },
          },
        },
      },
    });
  }

  async getCurrentDelivery(riderOwnerUserId: string) {
    const rider = await this.getOwnedRider(riderOwnerUserId);
    return this.prisma.delivery.findFirst({
      where: {
        riderId: rider.id,
        deliveredAt: null,
        order: { status: { in: [OrderStatus.RIDER_ASSIGNED, OrderStatus.RIDER_ARRIVED_PICKUP, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT, OrderStatus.RIDER_ARRIVED] } },
      },
      select: {
        id: true,
        orderId: true,
        riderId: true,
        assignedAt: true,
        pickedUpAt: true,
        deliveredAt: true,
        pickupLatitude: true,
        pickupLongitude: true,
        dropoffLatitude: true,
        dropoffLongitude: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            deliveryType: true,
            deliveryModel: true,
            customerNote: true,
            address: true,
            customer: { select: { id: true, fullName: true } },
            items: { select: { id: true, nameSnapshot: true, quantity: true } },
            vendor: { select: PUBLIC_VENDOR_SELECT },
          },
        },
      },
    });
  }

  async getCustomerTracking(customerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        status: true,
        deliveryType: true,
        deliveryModel: true,
        delivery: {
          select: {
            id: true,
            riderId: true,
            assignedAt: true,
            pickedUpAt: true,
            deliveredAt: true,
            pickupLatitude: true,
            pickupLongitude: true,
            dropoffLatitude: true,
            dropoffLongitude: true,
            rider: {
              select: {
                id: true,
                vehicleType: true,
                vehiclePlateNumber: true,
                location: true,
                owner: { select: { fullName: true } },
              },
            },
          },
        },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order || order.customerId !== customerId) throw new ForbiddenException('Order not found.');
    return order;
  }

  async riderArrivedAtPickup(riderOwnerUserId: string, deliveryId: string) {
    const delivery = await this.getOwnedDelivery(riderOwnerUserId, deliveryId);
    await this.ordersService.transitionOrder(delivery.orderId, OrderStatus.RIDER_ARRIVED_PICKUP, riderOwnerUserId);
    return { success: true };
  }

  async riderPickedUp(riderOwnerUserId: string, deliveryId: string) {
    const delivery = await this.getOwnedDelivery(riderOwnerUserId, deliveryId);
    const code = this.generateOtp();
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: delivery.orderId } });
    await this.ordersService.setDeliveryCode(delivery.orderId, code);
    await this.prisma.delivery.update({ where: { id: deliveryId }, data: { pickedUpAt: new Date() } });
    await this.ordersService.transitionOrder(delivery.orderId, OrderStatus.PICKED_UP, riderOwnerUserId);
    this.eventEmitter.emit(DELIVERY_OTP_GENERATED_EVENT, { orderId: order.id, orderNumber: order.orderNumber, customerId: order.customerId, code } as DeliveryOtpGeneratedPayload);
    return { success: true };
  }

  async riderDeparted(riderOwnerUserId: string, deliveryId: string) {
    const delivery = await this.getOwnedDelivery(riderOwnerUserId, deliveryId);
    await this.ordersService.transitionOrder(delivery.orderId, OrderStatus.IN_TRANSIT, riderOwnerUserId);
    return { success: true };
  }

  async riderArrivedAtCustomer(riderOwnerUserId: string, deliveryId: string) {
    const delivery = await this.getOwnedDelivery(riderOwnerUserId, deliveryId);
    await this.ordersService.transitionOrder(delivery.orderId, OrderStatus.RIDER_ARRIVED, riderOwnerUserId);
    return { success: true };
  }

  async confirmDelivery(riderOwnerUserId: string, deliveryId: string, code: string) {
    const delivery = await this.getOwnedDelivery(riderOwnerUserId, deliveryId);
    const order = await this.prisma.order.findUnique({
      where: { id: delivery.orderId },
      select: { id: true, deliveryCode: true, deliveryCodeFailedAttempts: true, deliveryCodeLockedUntil: true },
    });
    if (!order) throw new NotFoundException('Order not found.');
    const now = new Date();
    if (order.deliveryCodeLockedUntil && order.deliveryCodeLockedUntil > now) {
      throw new BadRequestException('Too many incorrect delivery codes. Confirmation is locked for 30 minutes.');
    }
    if (order.deliveryCodeLockedUntil && order.deliveryCodeLockedUntil <= now) {
      await this.prisma.order.update({ where: { id: order.id }, data: { deliveryCodeFailedAttempts: 0, deliveryCodeLockedUntil: null } });
      order.deliveryCodeFailedAttempts = 0;
      order.deliveryCodeLockedUntil = null;
    }
    if (!order.deliveryCode || order.deliveryCode !== code) {
      const lockResult = await this.prisma.order.updateMany({
        where: { id: order.id, deliveryCodeFailedAttempts: { gte: 4, lt: 5 }, deliveryCodeLockedUntil: null },
        data: { deliveryCodeFailedAttempts: 5, deliveryCodeLockedUntil: new Date(Date.now() + 30 * 60 * 1000) },
      });
      if (lockResult.count === 1) {
        throw new BadRequestException('Too many incorrect delivery codes. Confirmation is locked for 30 minutes.');
      }
      await this.prisma.order.updateMany({
        where: { id: order.id, deliveryCodeFailedAttempts: { lt: 4 }, deliveryCodeLockedUntil: null },
        data: { deliveryCodeFailedAttempts: { increment: 1 } },
      });
      const updatedOrder = await this.prisma.order.findUnique({ where: { id: order.id }, select: { deliveryCodeFailedAttempts: true, deliveryCodeLockedUntil: true } });
      if (updatedOrder?.deliveryCodeLockedUntil && updatedOrder.deliveryCodeLockedUntil > new Date()) {
        throw new BadRequestException('Too many incorrect delivery codes. Confirmation is locked for 30 minutes.');
      }
      const failedAttempts = updatedOrder?.deliveryCodeFailedAttempts ?? order.deliveryCodeFailedAttempts;
      const attemptsRemaining = Math.max(0, 5 - failedAttempts);
      throw new BadRequestException(`Incorrect delivery code. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`);
    }
    await this.prisma.order.update({ where: { id: order.id }, data: { deliveryCodeFailedAttempts: 0, deliveryCodeLockedUntil: null } });
    await this.prisma.delivery.update({ where: { id: deliveryId }, data: { deliveredAt: new Date() } });
    await this.ordersService.transitionOrder(delivery.orderId, OrderStatus.DELIVERED, riderOwnerUserId);
    return { success: true };
  }

  async adminReassign(deliveryId: string, actorId: string) {
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId }, include: { order: true } });
    if (!delivery) throw new NotFoundException('Delivery not found.');
    if (delivery.order.status !== OrderStatus.RIDER_ASSIGNED) throw new BadRequestException('Only an assigned-but-not-yet-picked-up delivery can be reassigned.');
    const before = { riderId: delivery.riderId, assignedAt: delivery.assignedAt, orderStatus: delivery.order.status };
    await this.prisma.delivery.update({ where: { id: deliveryId }, data: { riderId: null, assignedAt: null } });
    await this.ordersService.transitionOrder(delivery.orderId, OrderStatus.RIDER_SEARCHING);
    await this.audit.record({ actorId, action: 'delivery.reassign', entityType: 'Delivery', entityId: deliveryId, before, after: { riderId: null, orderStatus: OrderStatus.RIDER_SEARCHING } });
    return this.offerNextCandidate(deliveryId);
  }

  async adminListAll() {
    return this.prisma.delivery.findMany({
      include: {
        order: true,
        rider: {
          select: {
            id: true,
            status: true,
            vehicleType: true,
            vehiclePlateNumber: true,
            owner: { select: { fullName: true, phone: true } },
          },
        },
        attempts: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async adminSweepTimeouts() {
    const stuck = await this.prisma.delivery.findMany({
      where: {
        order: { status: OrderStatus.RIDER_SEARCHING },
        attempts: { some: { status: DeliveryAttemptStatus.OFFERED, expiresAt: { lt: new Date() } } },
      },
    });
    for (const delivery of stuck) await this.expireStaleOffers(delivery.id);
    return { swept: stuck.length };
  }

  @OnEvent(ORDER_TRANSITIONED_EVENT)
  async onOrderTransitioned(payload: OrderTransitionedPayload) {
    if (payload.toStatus !== OrderStatus.READY_FOR_PICKUP) return;
    if (payload.deliveryType !== 'DELIVERY') return;
    try {
      await this.startDispatch(payload.orderId);
    } catch (err: any) {
      this.logger.error(`Auto-dispatch failed for order ${payload.orderId}: ${err.message}`);
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async scheduledTimeoutSweep() {
    try {
      const result = await this.adminSweepTimeouts();
      if (result.swept > 0) this.logger.log(`Scheduled sweep expired offers on ${result.swept} delivery(ies).`);
    } catch (err: any) {
      this.logger.error(`Scheduled timeout sweep failed: ${err.message}`);
    }
  }

  private generateOtp(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private async getOwnedRider(ownerUserId: string) {
    const rider = await this.prisma.rider.findUnique({ where: { ownerUserId } });
    if (!rider) throw new NotFoundException('No rider profile found for this account.');
    return rider;
  }

  private async getOwnedAttempt(riderId: string, attemptId: string) {
    const attempt = await this.prisma.deliveryAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.riderId !== riderId) throw new ForbiddenException('This offer does not belong to you.');
    return attempt;
  }

  private async getOwnedDelivery(riderOwnerUserId: string, deliveryId: string) {
    const rider = await this.getOwnedRider(riderOwnerUserId);
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery || delivery.riderId !== rider.id) throw new ForbiddenException('This delivery is not assigned to you.');
    return delivery;
  }
}