import { OrderStatus } from '@prisma/client';

// One event, emitted on every validated status transition (see
// OrdersService.applyTransition). Notifications, the realtime gateway, and
// delivery auto-dispatch all listen to this instead of OrdersModule
// importing each of them (or vice versa) — that's what keeps this a
// one-directional dependency graph instead of a circular one.
export const ORDER_TRANSITIONED_EVENT = 'order.transitioned';

export interface OrderTransitionedPayload {
  orderId: string;
  orderNumber: string;
  customerId: string;
  vendorId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  deliveryType: 'DELIVERY' | 'PICKUP';
}
