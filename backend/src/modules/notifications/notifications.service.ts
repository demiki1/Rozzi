import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../config/prisma.service';
import { EMAIL_PROVIDER, EmailProvider, SMS_PROVIDER, SmsProvider } from './interfaces/notification-provider.interface';
import { ORDER_TRANSITIONED_EVENT, OrderTransitionedPayload } from '../orders/order-events';
import { NOTIFICATION_CREATED_EVENT } from './notification-events';
import { DELIVERY_OTP_GENERATED_EVENT, DeliveryOtpGeneratedPayload, DELIVERY_OFFERED_EVENT, DeliveryOfferCreatedPayload } from '../delivery/delivery-events';
import { NotificationChannel, NotificationStatus, NotificationType, NotificationPreferenceChannel, OrderStatus } from '@prisma/client';

// §33 example copy, reused here as the source of truth for what the
// customer actually sees for each status. Deliberately NOT exhaustive over
// every OrderStatus — silence on a status (e.g. the internal
// RIDER_ARRIVED_PICKUP) is a choice, not an oversight: some transitions
// are operationally interesting but not worth a customer-facing ping.
const CUSTOMER_STATUS_MESSAGES: Partial<Record<OrderStatus, { title: string; message: string }>> = {
  ACCEPTED: { title: 'Order accepted', message: 'Your order has been accepted by the vendor.' },
  PREPARING: { title: 'Order in progress', message: 'The vendor has started preparing your order.' },
  READY_FOR_PICKUP: { title: 'Order ready', message: 'Your order is ready.' },
  RIDER_ASSIGNED: { title: 'Rider assigned', message: 'Your rider is on the way to pick up your order.' },
  PICKED_UP: { title: 'Order picked up', message: 'Your rider has picked up your order.' },
  IN_TRANSIT: { title: 'On the way', message: 'Your order is on the way to you.' },
  DELIVERED: { title: 'Delivered', message: 'Your order has been delivered. Enjoy!' },
  CANCELLED: { title: 'Order cancelled', message: 'Your order has been cancelled.' },
  FAILED: { title: 'Order failed', message: 'There was a problem with your order. Please contact support.' },
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('NotificationsService');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
    private readonly events: EventEmitter2,
  ) {}

  @OnEvent(ORDER_TRANSITIONED_EVENT)
  async onOrderTransitioned(payload: OrderTransitionedPayload) {
    const copy = CUSTOMER_STATUS_MESSAGES[payload.toStatus];
    if (copy) {
      await this.notify(payload.customerId, {
        title: copy.title,
        message: `${copy.message} (Order ${payload.orderNumber})`,
        relatedOrderId: payload.orderId,
      });
    }

    // Operational delivery updates are also useful to the vendor. Resolve
    // the vendor owner here instead of putting notification dependencies into
    // the order/delivery modules.
    const vendorNotificationStatuses: OrderStatus[] = [
  OrderStatus.RIDER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
];

if (vendorNotificationStatuses.includes(payload.toStatus)) {
      const vendor = await this.prisma.vendor.findUnique({
        where: { id: payload.vendorId },
        select: { ownerUserId: true, storeName: true },
      });
      if (vendor) {
        const vendorCopy: Partial<Record<OrderStatus, { title: string; message: string }>> = {
          RIDER_ASSIGNED: { title: 'Rider assigned', message: `A rider has been assigned to order ${payload.orderNumber}.` },
          PICKED_UP: { title: 'Order picked up', message: `Order ${payload.orderNumber} has been picked up by the rider.` },
          DELIVERED: { title: 'Order delivered', message: `Order ${payload.orderNumber} has been delivered.` },
          CANCELLED: { title: 'Order cancelled', message: `Order ${payload.orderNumber} has been cancelled.` },
        };
        const vendorMessage = vendorCopy[payload.toStatus];
        if (vendorMessage) await this.notify(vendor.ownerUserId, { ...vendorMessage, relatedOrderId: payload.orderId });
      }
    }

    // When a rider accepts an offer, notify that rider without exposing
    // customer OTPs or other sensitive order fields.
    if (payload.toStatus === OrderStatus.RIDER_ASSIGNED) {
      const delivery = await this.prisma.delivery.findUnique({
        where: { orderId: payload.orderId },
        select: { rider: { select: { ownerUserId: true } } },
      });
      const riderOwnerId = delivery?.rider?.ownerUserId;
      if (riderOwnerId) {
        await this.notify(riderOwnerId, {
          title: 'Delivery assigned',
          message: `You have been assigned order ${payload.orderNumber}.`,
          relatedOrderId: payload.orderId,
        });
      }
    }
  }

  // The one channel that must never fail silently on the "who receives
  // it" question: only ever the customer (§15). This listener is the
  // reason DeliveryModule doesn't need to import NotificationsModule at
  // all — it just emits, and whoever's listening decides how to deliver.
  @OnEvent(DELIVERY_OFFERED_EVENT)
  async onDeliveryOfferCreated(payload: DeliveryOfferCreatedPayload) {
    const distance = payload.distanceKm != null ? ` · ${payload.distanceKm.toFixed(1)} km to pickup` : '';
    await this.notify(payload.riderOwnerUserId, {
      title: 'New delivery offer',
      message: `Order ${payload.orderNumber} is available for delivery${distance}. The offer expires soon.`,
      relatedOrderId: payload.orderId,
      type: NotificationType.DELIVERY,
    });
  }

  @OnEvent(DELIVERY_OTP_GENERATED_EVENT)
  async onDeliveryOtpGenerated(payload: DeliveryOtpGeneratedPayload) {
    await this.notify(payload.customerId, {
      title: 'Your delivery code',
      message: `Your delivery code is ${payload.code}. Give this to your rider when they arrive (order ${payload.orderNumber}).`,
      relatedOrderId: payload.orderId,
    });
  }

  // Core send path: always records an in-app notification; best-effort
  // attempts email and/or SMS if the user has contact info on file. A
  // failed email/SMS send is logged and marked FAILED on its own record —
  // it must never throw back into the event listener and never blocks the
  // in-app record from existing.
  async notify(userId: string, params: { title: string; message: string; relatedOrderId?: string; type?: NotificationType }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`Notification target user ${userId} not found — skipping.`);
      return;
    }

    const type = params.type ?? this.inferType(params.title, params.message);

    await this.createAndSend(userId, NotificationChannel.IN_APP, { ...params, type }, async () => {
      // In-app "sending" just means the record exists for the client to
      // poll/fetch — nothing external to call.
    });

    if (user.email) {
      if (await this.channelEnabled(userId, type, NotificationPreferenceChannel.EMAIL)) await this.createAndSend(userId, NotificationChannel.EMAIL, { ...params, type }, () =>
        this.emailProvider.send(user.email!, params.title, params.message),
      );
    }
    if (user.phone) {
      if (await this.channelEnabled(userId, type, NotificationPreferenceChannel.SMS)) await this.createAndSend(userId, NotificationChannel.SMS, { ...params, type }, () =>
        this.smsProvider.send(user.phone!, params.message),
      );
    }
  }

  private async createAndSend(
    userId: string,
    channel: NotificationChannel,
    params: { title: string; message: string; relatedOrderId?: string; type?: NotificationType },
    send: () => Promise<void>,
  ) {
    const record = await this.prisma.notification.create({
      data: {
        userId,
        channel,
        type: params.type ?? NotificationType.SYSTEM,
        title: params.title,
        message: params.message,
        relatedOrderId: params.relatedOrderId,
        status: NotificationStatus.PENDING,
      },
    });

    // Push only the safe in-app notification payload. Sensitive fields such
    // as delivery OTPs, phone numbers and payment details never enter the
    // websocket event. REST remains the source of truth and this event is
    // only the low-latency UI hint.
    if (channel === NotificationChannel.IN_APP) {
      this.events.emit(NOTIFICATION_CREATED_EVENT, {
        userId,
        notification: {
          id: record.id,
          channel: record.channel,
          type: record.type,
          title: record.title,
          message: record.message,
          relatedOrderId: record.relatedOrderId,
          createdAt: record.createdAt.toISOString(),
        },
      });
    }

    try {
      await send();
      await this.prisma.notification.update({
        where: { id: record.id },
        data: { status: NotificationStatus.SENT, sentAt: new Date() },
      });
    } catch (err: any) {
      this.logger.error(`Failed to send ${channel} notification ${record.id}: ${err.message}`);
      await this.prisma.notification.update({
        where: { id: record.id },
        data: { status: NotificationStatus.FAILED },
      });
    }
  }

  // ---- Read side, for the customer's in-app notification list ----

  async listForUser(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, channel: NotificationChannel.IN_APP, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, channel: NotificationChannel.IN_APP, readAt: null } });
  }

  async markRead(userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({ where: { id, userId, channel: NotificationChannel.IN_APP, readAt: null }, data: { readAt: new Date() } });
    return { success: result.count === 1 };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({ where: { userId, channel: NotificationChannel.IN_APP, readAt: null }, data: { readAt: new Date() } });
    return { success: true, updated: result.count };
  }

  async preferences(userId: string) {
    const rows = await this.prisma.notificationPreference.findMany({ where: { userId } });
    return Object.values(NotificationType).map(type => ({
      type,
      channels: Object.values(NotificationPreferenceChannel).reduce((acc, channel) => {
        const row = rows.find(r => r.type === type && r.channel === channel);
        acc[channel] = row?.enabled ?? true;
        return acc;
      }, {} as Record<string, boolean>),
    }));
  }

  async setPreference(userId: string, type: NotificationType, channel: NotificationPreferenceChannel, enabled: boolean) {
    return this.prisma.notificationPreference.upsert({
      where: { userId_type_channel: { userId, type, channel } },
      create: { userId, type, channel, enabled },
      update: { enabled },
    });
  }

  private async channelEnabled(userId: string, type: NotificationType, channel: NotificationPreferenceChannel) {
    const pref = await this.prisma.notificationPreference.findUnique({ where: { userId_type_channel: { userId, type, channel } } });
    return pref?.enabled ?? true;
  }

  private inferType(title: string, message: string) {
    const text = `${title} ${message}`.toLowerCase();
    if (text.includes('payout') || text.includes('payment') || text.includes('refund')) return NotificationType.PAYMENT;
    if (text.includes('rider') || text.includes('delivery') || text.includes('picked up')) return NotificationType.DELIVERY;
    if (text.includes('stock')) return NotificationType.INVENTORY;
    if (text.includes('review') || text.includes('rating')) return NotificationType.REVIEW;
    if (text.includes('promotion') || text.includes('promo')) return NotificationType.PROMOTION;
    if (text.includes('account') || text.includes('team')) return NotificationType.ACCOUNT;
    return NotificationType.ORDER;
  }
}
