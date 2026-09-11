import { Injectable, BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

// This is the ONLY place that knows which order status transitions are
// legal. Every module that changes an order's status (vendor actions now,
// rider dispatch and payment webhooks in later phases) must go through
// OrderStateMachine.assertValidTransition() rather than writing a new
// status directly — that's what makes §14's "do not allow arbitrary status
// changes" actually enforced rather than just documented.
//
// Rider states (RIDER_SEARCHING through RIDER_ARRIVED) are defined here now
// so the map is complete per spec, but nothing in the codebase can drive
// those transitions yet — that lands with the Phase 7 dispatch system.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: [OrderStatus.PAID, OrderStatus.CANCELLED, OrderStatus.FAILED],
  PAID: [OrderStatus.PENDING_VENDOR, OrderStatus.CANCELLED, OrderStatus.REFUNDED],
  PENDING_VENDOR: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
  ACCEPTED: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  PREPARING: [OrderStatus.READY_FOR_PICKUP, OrderStatus.CANCELLED],
  READY_FOR_PICKUP: [
    OrderStatus.RIDER_SEARCHING, // delivery order
    OrderStatus.DELIVERED,       // pickup order / vendor self-delivery marks complete directly
    OrderStatus.CANCELLED,
  ],
  RIDER_SEARCHING: [OrderStatus.RIDER_ASSIGNED, OrderStatus.CANCELLED],
  RIDER_ASSIGNED: [OrderStatus.RIDER_ARRIVED_PICKUP, OrderStatus.RIDER_SEARCHING, OrderStatus.CANCELLED],
  RIDER_ARRIVED_PICKUP: [OrderStatus.PICKED_UP],
  PICKED_UP: [OrderStatus.IN_TRANSIT],
  IN_TRANSIT: [OrderStatus.RIDER_ARRIVED],
  RIDER_ARRIVED: [OrderStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
  FAILED: [],
  REFUNDED: [],
};

const TERMINAL_STATES: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.FAILED,
  OrderStatus.REFUNDED,
];

@Injectable()
export class OrderStateMachine {
  assertValidTransition(from: OrderStatus, to: OrderStatus): void {
    const allowed = TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Cannot move order from ${from} to ${to}. Allowed next states: ${allowed.join(', ') || 'none (terminal state)'}.`,
      );
    }
  }

  isTerminal(status: OrderStatus): boolean {
    return TERMINAL_STATES.includes(status);
  }

  // Cancellation is only "free" (no vendor/rider work yet committed) up to
  // PENDING_VENDOR. Past ACCEPTED, cancellation is still technically
  // possible per the transition map but should require admin involvement /
  // a refund decision — enforced by callers checking this flag, since the
  // right compensating action (refund now vs. later) depends on Phase 5/10
  // logic that doesn't exist yet.
  isFreelyCancellableByCustomer(status: OrderStatus): boolean {
    return ([OrderStatus.PENDING_PAYMENT, OrderStatus.PAID, OrderStatus.PENDING_VENDOR] as OrderStatus[]).includes(status);
  }
}
