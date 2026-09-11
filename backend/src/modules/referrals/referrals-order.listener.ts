import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderStatus } from '@prisma/client';

import {
  ORDER_TRANSITIONED_EVENT,
  OrderTransitionedPayload,
} from '../orders/order-events';
import { ReferralsService } from './referrals.service';

@Injectable()
export class ReferralsOrderListener {
  private readonly logger = new Logger(
    ReferralsOrderListener.name,
  );

  constructor(
    private readonly referrals: ReferralsService,
  ) {}

  @OnEvent(ORDER_TRANSITIONED_EVENT)
  async handleOrderTransition(
    payload: OrderTransitionedPayload,
  ) {
    if (payload.toStatus !== OrderStatus.DELIVERED) {
      return;
    }

    try {
      await this.referrals.processDeliveredOrder(
        payload.orderId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process referral qualification for order ${payload.orderId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}