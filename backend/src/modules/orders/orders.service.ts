import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { vendorForUser } from '../../common/utils/vendor-context';
import { ProductsService } from '../products/products.service';
import { AddressesService } from './addresses.service';
import { OrderStateMachine } from './order-state-machine';
import { CheckoutDto } from './dto/order.dto';
import { PUBLIC_VENDOR_SELECT } from '../vendors/vendor-public-select';
import {
  DeliveryModel,
  OrderDeliveryType,
  OrderStatus,
  VendorStatus,
  ServiceAreaStatus,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DISTANCE_SERVICE,
  DistanceService,
} from '../maps/distance.service';
import { PromotionsService } from '../promotions/promotions.service';
import { AuditLogService } from '../audit/audit-log.service';
import { SettingsAdminService } from '../settings/settings.service';
import { PricingService } from '../pricing/pricing.service';
import { CommissionService } from '../commission/commission.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ORDER_TRANSITIONED_EVENT,
  OrderTransitionedPayload,
} from './order-events';

@Injectable()
export class OrdersService {
  async getVendorOwnerUserId(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { ownerUserId: true },
    });

    return vendor?.ownerUserId ?? null;
  }

  async findDeliveryForRealtime(orderId: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { orderId },
      select: {
        rider: {
          select: {
            ownerUserId: true,
          },
        },
      },
    });

    return {
      riderOwnerUserId: delivery?.rider?.ownerUserId ?? null,
    };
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly addressesService: AddressesService,
    private readonly stateMachine: OrderStateMachine,
    private readonly eventEmitter: EventEmitter2,
    private readonly promotionsService: PromotionsService,
    @Inject(DISTANCE_SERVICE)
    private readonly distance: DistanceService,
    private readonly audit: AuditLogService,
    private readonly settings: SettingsAdminService,
    private readonly pricingService: PricingService,
    private readonly commissionService: CommissionService,
  ) {}

  async checkout(customerId: string, dto: CheckoutDto) {
    const cart = await this.prisma.cart.findUnique({
      where: { customerId },
      include: {
        items: {
          include: {
            product: {
              include: {
                inventory: true,
              },
            },
            variant: {
              include: {
                inventory: true,
              },
            },
            optionSelections: {
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        },
        vendor: true,
      },
    });

    if (!cart || !cart.vendorId || cart.items.length === 0) {
      throw new BadRequestException('Your cart is empty.');
    }

    const vendor = cart.vendor!;

    if (vendor.status !== VendorStatus.APPROVED || !vendor.isOpen) {
      throw new BadRequestException(
        'This store is not currently accepting orders.',
      );
    }

    const vendorLocation = await this.prisma.vendorLocation.findUnique({
      where: {
        vendorId_serviceAreaId: {
          vendorId: vendor.id,
          serviceAreaId: dto.serviceAreaId,
        },
      },
    });

    if (!vendorLocation) {
      throw new BadRequestException(
        'This store does not serve the selected location.',
      );
    }

    let scheduledFor: Date | null = null;

    if (dto.scheduledFor) {
      const enabled = Boolean(
        (await this.settings.get('scheduledOrdersEnabled')).value,
      );

      if (!enabled) {
        throw new BadRequestException(
          'Scheduled orders are not currently enabled.',
        );
      }

      scheduledFor = new Date(dto.scheduledFor);

      if (
        Number.isNaN(scheduledFor.getTime()) ||
        scheduledFor.getTime() <= Date.now()
      ) {
        throw new BadRequestException(
          'scheduledFor must be a valid future date/time.',
        );
      }

      if (
        scheduledFor.getTime() >
        Date.now() + 1000 * 60 * 60 * 24 * 30
      ) {
        throw new BadRequestException(
          'Scheduled orders can only be placed up to 30 days ahead.',
        );
      }
    }

    const serviceArea = await this.prisma.serviceArea.findUnique({
      where: { id: dto.serviceAreaId },
    });

    if (
      !serviceArea ||
      serviceArea.status !== ServiceAreaStatus.ACTIVE
    ) {
      throw new BadRequestException(
        'This location is not currently active for orders.',
      );
    }

    if (
      dto.deliveryType === OrderDeliveryType.DELIVERY &&
      !dto.addressId
    ) {
      throw new BadRequestException(
        'A delivery address is required for delivery orders.',
      );
    }

    if (
      dto.deliveryType === OrderDeliveryType.PICKUP &&
      dto.deliveryModel &&
      dto.deliveryModel !== DeliveryModel.CUSTOMER_PICKUP
    ) {
      throw new BadRequestException(
        'Pickup orders must use CUSTOMER_PICKUP.',
      );
    }

    const selectedDeliveryModel =
      dto.deliveryType === OrderDeliveryType.PICKUP
        ? DeliveryModel.CUSTOMER_PICKUP
        : (dto.deliveryModel ?? DeliveryModel.PLATFORM_DELIVERY);

    if (dto.addressId) {
      await this.addressesService.getOwnedOrThrow(
        customerId,
        dto.addressId,
      );
    }

    if (
      !vendor.supportedDeliveryModels.includes(
        selectedDeliveryModel,
      )
    ) {
      throw new BadRequestException(
        'This vendor does not support the selected delivery method.',
      );
    }

    let deliveryZone = null;

    if (dto.deliveryZoneId) {
      deliveryZone = await this.prisma.deliveryZone.findUnique({
        where: { id: dto.deliveryZoneId },
      });

      if (
        !deliveryZone ||
        !deliveryZone.isActive ||
        deliveryZone.serviceAreaId !== dto.serviceAreaId
      ) {
        throw new BadRequestException(
          'Invalid delivery zone for this location.',
        );
      }
    }

    const pricingConfig = await this.pricingService.getActiveConfig(
      dto.serviceAreaId,
    );

    let grossMerchandiseAmount = 0;
    let discountedMerchandiseSubtotal = 0;

    const lineItems = await Promise.all(
      cart.items.map(async (item) => {
        const basePrice =
          item.variant?.priceOverride ?? item.product.priceAmount;

        const optionPricePerUnit = item.optionSelections.reduce(
          (sum, option) => sum + option.additionalPriceSnapshot,
          0,
        );

        const grossUnitPrice = basePrice + optionPricePerUnit;

        const discountedBasePrice = Math.max(
          0,
          basePrice - Math.min(item.product.discountAmount ?? 0, basePrice),
        );

        const actualUnitPrice = discountedBasePrice + optionPricePerUnit;
        const grossLineTotal = grossUnitPrice * item.quantity;
        const lineTotal = actualUnitPrice * item.quantity;

        const commissionRate = await this.commissionService.resolveRate(
          cart.vendorId!,
          item.product.categoryId,
        );

        const commissionAmount = Math.round(
          (lineTotal * Number(commissionRate)) / 100,
        );

        grossMerchandiseAmount += grossLineTotal;
        discountedMerchandiseSubtotal += lineTotal;

        return {
          productId: item.productId,
          variantId: item.variantId,
          nameSnapshot: item.product.name,
          unitPriceSnapshot: actualUnitPrice,
          quantity: item.quantity,
          subtotalAmount: lineTotal,
          commissionRateSnapshot: commissionRate,
          commissionAmountSnapshot: commissionAmount,
          options:
            item.optionSelections.length > 0
              ? {
                  create: item.optionSelections.map((option) => ({
                    groupNameSnapshot: option.groupNameSnapshot,
                    optionNameSnapshot: option.optionNameSnapshot,
                    additionalPriceSnapshot:
                      option.additionalPriceSnapshot,
                  })),
                }
              : undefined,
        };
      }),
    );

    const commissionRates = lineItems.map((item) =>
      Number(item.commissionRateSnapshot),
    );

    const orderCommissionRateSnapshot =
      commissionRates.length > 0 &&
      commissionRates.every((rate) => rate === commissionRates[0])
        ? lineItems[0].commissionRateSnapshot
        : await this.commissionService
            .getGlobalConfig()
            .then((config) => config.defaultRatePercent);

    const promotion = dto.promotionCode
      ? await this.promotionsService.validate(
          dto.promotionCode,
          customerId,
          discountedMerchandiseSubtotal,
          cart.vendorId!,
        )
      : null;

    const discountAmount = promotion?.discount ?? 0;
    const subtotalAmount = Math.max(
      0,
      discountedMerchandiseSubtotal - discountAmount,
    );

    const minimumOrderAmount = Math.max(
      serviceArea.minimumOrderAmount,
      Number((await this.settings.get('minimumOrderAmount')).value ?? 0),
    );

    if (subtotalAmount < minimumOrderAmount) {
      throw new BadRequestException(
        `This location requires a minimum order of ${minimumOrderAmount / 100} NGN.`,
      );
    }

    const serviceFeeAmount = this.pricingService.calculateServiceFee(
      subtotalAmount,
      pricingConfig,
    );

    let deliveryFeeAmount = 0;

    if (dto.deliveryType === OrderDeliveryType.DELIVERY) {
      const address = dto.addressId
        ? await this.addressesService.getOwnedOrThrow(
            customerId,
            dto.addressId,
          )
        : null;

      if (
        !address ||
        address.latitude == null ||
        address.longitude == null ||
        vendorLocation.latitude == null ||
        vendorLocation.longitude == null
      ) {
        throw new BadRequestException(
          'A valid delivery address with location coordinates is required.',
        );
      }

      const distanceKm = this.distance.distanceKm(
        Number(vendorLocation.latitude),
        Number(vendorLocation.longitude),
        Number(address.latitude),
        Number(address.longitude),
      );

      const maxKm =
        deliveryZone?.maxDistanceKm != null
          ? Number(deliveryZone.maxDistanceKm)
          : null;

      deliveryFeeAmount = this.pricingService.calculateDeliveryFee(
        distanceKm,
        pricingConfig,
        deliveryZone?.deliveryFeeOverride ?? null,
        maxKm,
      );
    }

    const surgeFeeAmount = this.pricingService.calculateSurgeFee(
      pricingConfig,
    );

    const totalAmount =
      subtotalAmount +
      serviceFeeAmount +
      deliveryFeeAmount +
      surgeFeeAmount;

    const capacityNow = scheduledFor ?? new Date();
    const weekdayName = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: 'Africa/Lagos',
    }).format(capacityNow);
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
      weekdayName,
    );

    const hhmm = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Africa/Lagos',
    }).format(capacityNow);

    for (const item of cart.items) {
      const start = item.product.availabilityStartTime;
      const end = item.product.availabilityEndTime;
      const days = item.product.availabilityDays || [];

      if (days.length && !days.includes(weekday)) {
        throw new BadRequestException(
          `${item.product.name} is not available on the selected day.`,
        );
      }

      const withinAvailability =
        !start || !end
          ? true
          : start <= end
            ? hhmm >= start && hhmm <= end
            : hhmm >= start || hhmm <= end;

      if (!withinAvailability) {
        throw new BadRequestException(
          `${item.product.name} is only available from ${start} to ${end}.`,
        );
      }
    }

    const orderNumber = await this.generateOrderNumber();

    const order = await this.prisma.$transaction(async (tx) => {
      if (promotion) {
        await this.promotionsService.consumePromotion(
          tx,
          promotion.id,
          customerId,
          discountedMerchandiseSubtotal,
          promotion.discount,
        );
      }

      if (vendor.maxOrdersPerHour != null) {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtext(${vendor.id}))
        `;

        const windowStart = new Date(
          (scheduledFor ?? new Date()).getTime() - 60 * 60 * 1000,
        );

        const activeStatuses = [
          OrderStatus.PENDING_PAYMENT,
          OrderStatus.PAID,
          OrderStatus.PENDING_VENDOR,
          OrderStatus.ACCEPTED,
          OrderStatus.PREPARING,
          OrderStatus.READY_FOR_PICKUP,
          OrderStatus.RIDER_SEARCHING,
          OrderStatus.RIDER_ASSIGNED,
          OrderStatus.RIDER_ARRIVED_PICKUP,
          OrderStatus.PICKED_UP,
          OrderStatus.IN_TRANSIT,
          OrderStatus.RIDER_ARRIVED,
        ];

        const existing = await tx.order.count({
          where: {
            vendorId: vendor.id,
            status: { in: activeStatuses },
            OR: [
              {
                scheduledFor: null,
                createdAt: { gte: windowStart },
              },
              {
                scheduledFor: {
                  gte: windowStart,
                  lte: new Date(capacityNow.getTime() + 60 * 60 * 1000),
                },
              },
            ],
          },
        });

        if (existing >= vendor.maxOrdersPerHour) {
          throw new BadRequestException(
            `This store has reached its order capacity of ${vendor.maxOrdersPerHour} orders per hour.`,
          );
        }
      }

      const created = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          vendorId: vendor.id,
          serviceAreaId: dto.serviceAreaId,
          deliveryZoneId: dto.deliveryZoneId,
          deliveryType: dto.deliveryType,
          deliveryModel: selectedDeliveryModel,
          scheduledFor,
          addressId: dto.addressId,
          status: OrderStatus.PENDING_PAYMENT,
          grossMerchandiseAmount,
          subtotalAmount,
          deliveryFeeAmount,
          serviceFeeAmount,
          discountAmount,
          surgeFeeAmount,
          totalAmount,
          pricingConfigId: pricingConfig.id,
          commissionRateSnapshot: orderCommissionRateSnapshot,
          riderPayoutRateSnapshot: pricingConfig.riderPayoutRatePercent,
          customerNote: dto.note,
          promotionId: promotion?.id,
          promotionCode: promotion?.code,
          items: { create: lineItems },
        },
        include: { items: true },
      });

      for (const item of cart.items) {
        await this.productsService.deductStockForOrder(
          tx,
          item.productId,
          item.quantity,
          item.variantId ?? undefined,
          customerId,
          created.id,
        );
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: created.id,
          toStatus: OrderStatus.PENDING_PAYMENT,
          changedByUserId: customerId,
        },
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({
        where: { id: cart.id },
        data: { vendorId: null },
      });

      return created;
    });

    return order;
  }

  async transitionOrder(
    orderId: string,
    toStatus: OrderStatus,
    changedByUserId: string | null = null,
  ) {
    return this.applyTransition(orderId, toStatus, changedByUserId);
  }

  async setDeliveryCode(orderId: string, code: string) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryCode: code,
        deliveryCodeFailedAttempts: 0,
        deliveryCodeLockedUntil: null,
      },
    });
  }

  async findActiveOrdersForRider(riderId: string) {
    return this.prisma.order.findMany({
      where: {
        delivery: { riderId },
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
      select: { id: true },
    });
  }

  async getDeliveryCode(orderId: string): Promise<string | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { deliveryCode: true },
    });
    return order?.deliveryCode ?? null;
  }

  async confirmPayment(orderId: string) {
    const paid = await this.applyTransition(
      orderId,
      OrderStatus.PAID,
      null,
    );

    if (paid.scheduledFor && paid.scheduledFor.getTime() > Date.now()) {
      return paid;
    }

    return this.applyTransition(
      orderId,
      OrderStatus.PENDING_VENDOR,
      null,
    );
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async releaseScheduledOrders() {
    const due = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PAID,
        scheduledFor: { lte: new Date() },
      },
      select: { id: true },
      take: 100,
    });

    for (const order of due) {
      try {
        await this.applyTransition(
          order.id,
          OrderStatus.PENDING_VENDOR,
          null,
        );
      } catch {
        // another worker/request may have advanced it
      }
    }
  }

  async reorder(customerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || order.customerId !== customerId) {
      throw new NotFoundException('Order not found.');
    }

    if (order.items.length === 0) {
      throw new BadRequestException('This order has no items to reorder.');
    }

    await this.prisma.cartItem.deleteMany({
      where: { cart: { customerId } },
    });

    await this.prisma.cart
      .update({
        where: { customerId },
        data: { vendorId: order.vendorId },
      })
      .catch(async () => {
        await this.prisma.cart.create({
          data: {
            customerId,
            vendorId: order.vendorId,
          },
        });
      });

    const cart = await this.prisma.cart.findUnique({
      where: { customerId },
    });

    if (!cart) {
      throw new BadRequestException('Unable to create cart.');
    }

    for (const item of order.items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
        include: { inventory: true },
      });

      if (
        !product ||
        !product.isAvailable ||
        (product.inventory && product.inventory.quantity < item.quantity)
      ) {
        continue;
      }

      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        },
      });
    }

    return this.prisma.cart.findUnique({
      where: { customerId },
      include: { items: true },
    });
  }

  async markPaymentFailed(orderId: string) {
    return this.applyTransition(orderId, OrderStatus.FAILED, null);
  }

  async devMarkPaidStub(orderId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'This endpoint is disabled outside development.',
      );
    }
    return this.confirmPayment(orderId);
  }

  async vendorAccept(ownerUserId: string, orderId: string) {
    const order = await this.getOwnedByVendor(ownerUserId, orderId);
    return this.applyTransition(order.id, OrderStatus.ACCEPTED, ownerUserId);
  }

  async vendorStartPreparing(ownerUserId: string, orderId: string) {
    const order = await this.getOwnedByVendor(ownerUserId, orderId);
    return this.applyTransition(order.id, OrderStatus.PREPARING, ownerUserId);
  }

  async vendorMarkReady(ownerUserId: string, orderId: string) {
    const order = await this.getOwnedByVendor(ownerUserId, orderId);
    return this.applyTransition(
      order.id,
      OrderStatus.READY_FOR_PICKUP,
      ownerUserId,
    );
  }

  async vendorMarkDelivered(ownerUserId: string, orderId: string) {
    const order = await this.getOwnedByVendor(ownerUserId, orderId);

    if (
      order.deliveryType === OrderDeliveryType.DELIVERY &&
      order.deliveryModel !== DeliveryModel.SELF_DELIVERY
    ) {
      throw new BadRequestException(
        'Only pickup and vendor self-delivery orders can be marked delivered directly.',
      );
    }

    return this.applyTransition(order.id, OrderStatus.DELIVERED, ownerUserId);
  }

  async listVendorQueue(ownerUserId: string, statuses?: OrderStatus[]) {
    const vendor = await vendorForUser(this.prisma, ownerUserId);

    return this.prisma.order.findMany({
      where: {
        vendorId: vendor.id,
        status: statuses ? { in: statuses } : undefined,
      },
      include: {
        items: true,
        customer: {
          select: { id: true, fullName: true, phone: true },
        },
        address: true,
        delivery: {
          include: {
            rider: {
              select: {
                id: true,
                owner: {
                  select: { fullName: true, phone: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async vendorReject(
    ownerUserId: string,
    orderId: string,
    reason?: string,
  ) {
    const order = await this.getOwnedByVendor(ownerUserId, orderId);

    if (order.status !== OrderStatus.PENDING_VENDOR) {
      throw new BadRequestException(
        'Only new orders can be rejected by the vendor.',
      );
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE
      `;
      const current = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!current || current.vendorId !== order.vendorId) {
        throw new NotFoundException('Order not found.');
      }

      this.stateMachine.assertValidTransition(
        current.status,
        OrderStatus.CANCELLED,
      );

      for (const item of current.items) {
        const inventory = item.variantId
          ? await tx.inventory.findUnique({
              where: { variantId: item.variantId },
            })
          : await tx.inventory.findUnique({
              where: { productId: item.productId },
            });

        if (!inventory) {
          throw new BadRequestException(
            'Inventory record is missing for an order item.',
          );
        }

        await tx.inventory.update({
          where: { id: inventory.id },
          data: { quantity: { increment: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            inventoryId: inventory.id,
            quantityDelta: item.quantity,
            quantityBefore: inventory.quantity,
            quantityAfter: inventory.quantity + item.quantity,
            reason: reason || 'Order rejected by vendor',
            referenceType: 'ORDER_REJECTION',
            referenceId: orderId,
            actorId: ownerUserId,
          },
        });
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: reason || 'Rejected by vendor',
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: current.status,
          toStatus: OrderStatus.CANCELLED,
          changedByUserId: ownerUserId,
          note: reason || 'Rejected by vendor',
        },
      });

      return updated;
    });

    this.eventEmitter.emit(ORDER_TRANSITIONED_EVENT, {
      orderId: cancelled.id,
      orderNumber: cancelled.orderNumber,
      customerId: cancelled.customerId,
      vendorId: cancelled.vendorId,
      fromStatus: OrderStatus.PENDING_VENDOR,
      toStatus: OrderStatus.CANCELLED,
      deliveryType: cancelled.deliveryType,
    } satisfies OrderTransitionedPayload);

    return cancelled;
  }

  async cancel(customerId: string, orderId: string, reason?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.customerId !== customerId) {
      throw new NotFoundException('Order not found.');
    }

    if (!this.stateMachine.isFreelyCancellableByCustomer(order.status)) {
      throw new BadRequestException(
        'This order can no longer be cancelled directly — contact support.',
      );
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE
      `;
      const current = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!current || current.customerId !== customerId) {
        throw new NotFoundException('Order not found.');
      }

      if (!this.stateMachine.isFreelyCancellableByCustomer(current.status)) {
        throw new BadRequestException(
          'This order can no longer be cancelled directly — contact support.',
        );
      }

      this.stateMachine.assertValidTransition(
        current.status,
        OrderStatus.CANCELLED,
      );

      const items = await tx.orderItem.findMany({
        where: { orderId },
      });

      for (const item of items) {
        const inventory = item.variantId
          ? await tx.inventory.findUnique({
              where: { variantId: item.variantId },
            })
          : await tx.inventory.findUnique({
              where: { productId: item.productId },
            });

        if (!inventory) {
          throw new BadRequestException(
            'Inventory record is missing for an order item.',
          );
        }

        await tx.inventory.update({
          where: { id: inventory.id },
          data: { quantity: { increment: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            inventoryId: inventory.id,
            quantityDelta: item.quantity,
            quantityBefore: inventory.quantity,
            quantityAfter: inventory.quantity + item.quantity,
            reason: reason || 'Order cancelled by customer',
            referenceType: 'ORDER_CANCELLATION',
            referenceId: orderId,
            actorId: customerId,
          },
        });
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: reason,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: current.status,
          toStatus: OrderStatus.CANCELLED,
          changedByUserId: customerId,
          note: reason,
        },
      });

      return updated;
    });

    this.eventEmitter.emit(ORDER_TRANSITIONED_EVENT, {
      orderId: cancelled.id,
      orderNumber: cancelled.orderNumber,
      customerId: cancelled.customerId,
      vendorId: cancelled.vendorId,
      fromStatus: order.status,
      toStatus: OrderStatus.CANCELLED,
      deliveryType: cancelled.deliveryType,
    } satisfies OrderTransitionedPayload);

    return cancelled;
  }

  async listMyOrders(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      include: {
        items: true,
        vendor: { select: PUBLIC_VENDOR_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderDetail(
    requesterId: string,
    requesterRole: string,
    orderId: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        customer: {
          select: { id: true, fullName: true, phone: true },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        delivery: {
          include: {
            rider: {
              select: {
                id: true,
                owner: {
                  select: { fullName: true, phone: true },
                },
              },
            },
          },
        },
        vendor: {
          select: {
            ...PUBLIC_VENDOR_SELECT,
            ownerUserId: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
        },
        address: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    const isOwner = order.customerId === requesterId;
    const isVendorOwner =
      requesterRole === 'VENDOR' &&
      order.vendor.ownerUserId === requesterId;
    const isAdmin = requesterRole === 'ADMIN';

    if (!isOwner && !isVendorOwner && !isAdmin) {
      throw new ForbiddenException(
        'You do not have access to this order.',
      );
    }

    const { ownerUserId, ...publicVendor } = order.vendor;

    if (requesterRole === 'VENDOR') {
      const { deliveryCode, ...safeOrder } = order;
      return { ...safeOrder, vendor: publicVendor };
    }

    return { ...order, vendor: publicVendor };
  }

  async adminListOrders(status?: OrderStatus) {
    return this.prisma.order.findMany({
      where: status ? { status } : undefined,
      include: {
        vendor: true,
        customer: {
          select: { id: true, fullName: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async adminCancel(orderId: string, actorId: string, reason?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    if (
      (
        [
          OrderStatus.DELIVERED,
          OrderStatus.CANCELLED,
          OrderStatus.REFUNDED,
          OrderStatus.FAILED,
        ] as OrderStatus[]
      ).includes(order.status)
    ) {
      throw new BadRequestException(
        'This order cannot be cancelled in its current state.',
      );
    }

    this.stateMachine.assertValidTransition(
      order.status,
      OrderStatus.CANCELLED,
    );

    const updated = await this.applyTransition(
      orderId,
      OrderStatus.CANCELLED,
      actorId,
    );

    await this.prisma.order.update({
      where: { id: orderId },
      data: { cancelReason: reason || 'Cancelled by admin' },
    });

    await this.audit.record({
      actorId,
      action: 'order.admin_cancel',
      entityType: 'Order',
      entityId: orderId,
      before: order,
      after: { status: OrderStatus.CANCELLED, reason },
    });

    return updated;
  }

  private async applyTransition(
    orderId: string,
    toStatus: OrderStatus,
    changedByUserId: string | null,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    this.stateMachine.assertValidTransition(order.status, toStatus);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE
      `;
      const current = await tx.order.findUnique({
        where: { id: orderId },
      });
      if (!current) throw new NotFoundException('Order not found.');
      this.stateMachine.assertValidTransition(current.status, toStatus);
      const changed = await tx.order.update({
        where: { id: orderId },
        data: { status: toStatus },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: current.status,
          toStatus,
          changedByUserId,
        },
      });
      return changed;
    });

    const payload: OrderTransitionedPayload = {
      orderId: updated.id,
      orderNumber: updated.orderNumber,
      customerId: updated.customerId,
      vendorId: updated.vendorId,
      fromStatus: order.status,
      toStatus,
      deliveryType: updated.deliveryType,
    };

    this.eventEmitter.emit(ORDER_TRANSITIONED_EVENT, payload);
    return updated;
  }

  private async getOwnedByVendor(ownerUserId: string, orderId: string) {
    const vendor = await vendorForUser(this.prisma, ownerUserId);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.vendorId !== vendor.id) {
      throw new NotFoundException('Order not found.');
    }

    return order;
  }

  private async generateOrderNumber(): Promise<string> {
    const tail = Date.now().toString().slice(-8);
    const suffix = Math.floor(Math.random() * 900 + 100);
    return `VEL-${tail}${suffix}`;
  }
}
