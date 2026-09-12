import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentProvider } from './interfaces/payment-provider.interface';
import { PaymentProvidersService } from './payment-providers.service';
import {
  OrderStatus,
  PaymentStatus,
  PaymentProviderName,
} from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PAYMENT_SUCCEEDED_EVENT,
  PaymentSucceededPayload,
} from './payment-events';
import {
  REFUND_PROCESSED_EVENT,
  RefundProcessedPayload,
} from './refund-events';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('PaymentsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly eventEmitter: EventEmitter2,
    private readonly providers: PaymentProvidersService,
  ) {}

  // Customer calls this right after checkout to get a redirect URL.
  async initialize(customerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order || order.customerId !== customerId) {
      throw new NotFoundException('Order not found.');
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        'This order is not awaiting payment.',
      );
    }

    // If a pending payment attempt already exists for this order, re-issue
    // its authorization URL instead of creating a second one — avoids
    // double-initialization from a double-click (§70).
    const existing = await this.prisma.payment.findFirst({
      where: {
        orderId,
        status: PaymentStatus.PENDING,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existing?.authorizationUrl) {
      return {
        authorizationUrl: existing.authorizationUrl,
        reference: existing.reference,
      };
    }

    if (!order.customer.email) {
      throw new BadRequestException(
        'This account has no email on file — required to initialize payment.',
      );
    }

    const reference = `${order.orderNumber}-${uuidv4().slice(0, 8)}`;

    const provider = this.providers.getConfigured();

    const result = await provider.initialize({
      reference,
      amountKobo: order.totalAmount,
      email: order.customer.email,
      metadata: {
        orderId: order.id,
      },
      callbackUrl: `${
        process.env.CUSTOMER_APP_URL ?? 'http://localhost:3002'
      }/payments/callback?reference=${encodeURIComponent(reference)}`,
    });

    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: provider.name as PaymentProviderName,
        reference: result.reference,
        amount: order.totalAmount,
        status: PaymentStatus.PENDING,
        authorizationUrl: result.authorizationUrl,
      },
    });

    return {
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
    };
  }

  // Customer wallet payment. This is a first-class payment method, but it
  // still creates a normal Payment row and emits the same success event so
  // Finance, notifications, and the order state machine see exactly the
  // same payment lifecycle as Paystack/Flutterwave.
  async payWithWallet(customerId: string, orderId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Serialize wallet payments for the same order so two concurrent
      // requests cannot both observe an unpaid order and debit the wallet twice.
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;

      const order = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!order || order.customerId !== customerId) {
        throw new NotFoundException('Order not found.');
      }

      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new BadRequestException(
          'This order is not awaiting payment.',
        );
      }

      const existing = await tx.payment.findFirst({
        where: {
          orderId,
          provider: PaymentProviderName.WALLET,
          status: PaymentStatus.SUCCESS,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (existing) {
        return {
          payment: existing,
          alreadyPaid: true,
        };
      }

      const wallet = await tx.wallet.findUnique({
        where: { customerId },
      });

      if (!wallet || !wallet.isActive) {
        throw new BadRequestException('Wallet is unavailable.');
      }

      // Make the balance reservation atomic. Two concurrent order payments
      // cannot both spend the same observed wallet balance.
      const debited = await tx.wallet.updateMany({
        where: {
          id: wallet.id,
          isActive: true,
          balance: { gte: order.totalAmount },
        },
        data: {
          balance: { decrement: order.totalAmount },
        },
      });

      if (debited.count !== 1) {
        throw new ConflictException('Insufficient wallet balance.');
      }

      const updatedWallet = await tx.wallet.findUniqueOrThrow({
        where: { id: wallet.id },
        select: { balance: true },
      });

      const reference = `RZW-ORD-${order.orderNumber}-${uuidv4()}
        .slice(0, 8)
        .toUpperCase()}`;

      const after = updatedWallet.balance;
      const before = after + order.totalAmount;

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          customerId,
          orderId,
          type: 'ORDER_PAYMENT',
          status: 'SUCCESS',
          amount: -order.totalAmount,
          balanceBefore: before,
          balanceAfter: after,
          reference,
          description: `Wallet payment for order ${order.orderNumber}`,
        },
      });

      const payment = await tx.payment.create({
        data: {
          orderId,
          provider: PaymentProviderName.WALLET,
          reference,
          amount: order.totalAmount,
          status: PaymentStatus.SUCCESS,
          paidAt: new Date(),
        },
      });

      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          provider: PaymentProviderName.WALLET,
          providerReference: reference,
          eventType: 'wallet.payment.success',
          rawPayload: {
            orderId,
            customerId,
            amountKobo: order.totalAmount,
          },
        },
      });

      return {
        payment,
        alreadyPaid: false,
      };
    });

    if (!result.alreadyPaid) {
      await this.ordersService.confirmPayment(orderId);

      this.eventEmitter.emit(
        PAYMENT_SUCCEEDED_EVENT,
        {
          orderId,
          paymentId: result.payment.id,
          amountKobo: result.payment.amount,
        } as PaymentSucceededPayload,
      );
    }

    return {
      success: true,
      payment: result.payment,
      orderId,
    };
  }

  // Customer payment history.
  // Only payments belonging to orders owned by this customer are returned.
  // This endpoint is intended for the customer's Account > Payments page.
  async listMyPayments(customerId: string) {
    return this.prisma.payment.findMany({
      where: {
        order: {
          customerId,
        },
      },
      select: {
        id: true,
        orderId: true,
        provider: true,
        reference: true,
        providerTransactionId: true,
        amount: true,
        currency: true,
        status: true,
        paidAt: true,
        createdAt: true,
        updatedAt: true,

        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            createdAt: true,
          },
        },

        refunds: {
          select: {
            id: true,
            amount: true,
            reason: true,
            status: true,
            providerReference: true,
            processedAt: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Admin-controlled refund flow. The provider remains the authority for
  // whether the money was actually refunded; we never mark an order REFUNDED
  // merely because an admin clicked a button. A Refund row records the attempt
  // and the processed event is what creates the compensating ledger entry.
  async refundOrder(
    orderId: string,
    actorId: string,
    reason?: string,
    amountKobo?: number,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: {
            status: PaymentStatus.SUCCESS,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    if (order.status === OrderStatus.DELIVERED) {
      // Refunds after delivery may still be valid, but require explicit admin
      // handling. We allow the financial action; the audit trail records it.
    }

    const payment = order.payments[0];

    if (!payment) {
      throw new BadRequestException(
        'No successful payment is available to refund.',
      );
    }

    const refundAmount = amountKobo ?? payment.amount;

    if (!Number.isInteger(refundAmount) || refundAmount <= 0) {
      throw new BadRequestException(
        'Refund amount must be a positive integer amount in kobo.',
      );
    }

    // Serialize refund allocation on the payment row. Without a row lock, two
    // concurrent admin requests can both observe the same remaining balance
    // and create refunds whose combined amount exceeds the original payment.
    // The lock also makes the pending-refund check atomic with allocation.
    const refund = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "Payment" WHERE id = ${payment.id} FOR UPDATE
      `;

      // Never allow cumulative successful/pending refunds to exceed the payment.
      const refundedTotals = await tx.refund.aggregate({
        where: {
          paymentId: payment.id,
          status: {
            in: ['REQUESTED', 'PROCESSING', 'PROCESSED'],
          },
        },
        _sum: {
          amount: true,
        },
      });

      const alreadyAllocated = refundedTotals._sum.amount ?? 0;
      const remaining = payment.amount - alreadyAllocated;

      if (refundAmount > remaining) {
        throw new BadRequestException(
          `Refund amount exceeds the remaining refundable balance of ${remaining} kobo.`,
        );
      }

      // A pending provider refund must settle before another refund attempt is
      // created; otherwise a retry could double-submit money to the provider.
      const existing = await tx.refund.findFirst({
        where: {
          paymentId: payment.id,
          status: {
            in: ['REQUESTED', 'PROCESSING'],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (existing) {
        return existing;
      }

      return tx.refund.create({
        data: {
          paymentId: payment.id,
          orderId,
          amount: refundAmount,
          reason,
          requestedByUserId: actorId,
          status: 'PROCESSING',
        },
      });
    });

    // Wallet payments are refunded internally: credit the customer's wallet
    // atomically with the refund record. External providers remain pending
    // until their provider-side refund is confirmed.
    if (payment.provider === PaymentProviderName.WALLET) {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Refund" WHERE id = ${refund.id} FOR UPDATE`;

        const current = await tx.refund.findUnique({
          where: { id: refund.id },
        });

        if (!current || current.status === 'PROCESSED') {
          return current!;
        }

        const wallet = await tx.wallet.findUnique({
          where: {
            customerId: order.customerId,
          },
        });

        if (!wallet || !wallet.isActive) {
          throw new BadRequestException(
            'Customer wallet is unavailable for refund.',
          );
        }

        // Serialize wallet refund balance accounting with concurrent wallet
        // spends/refunds. The existing payment/refund allocation lock protects
        // refund duplication; this wallet-row lock protects the wallet ledger
        // from stale absolute-balance writes.
        await tx.$queryRaw`
          SELECT id FROM "Wallet" WHERE id = ${wallet.id} FOR UPDATE
        `;

        const currentWallet = await tx.wallet.findUnique({
          where: { id: wallet.id },
          select: { balance: true },
        });

        if (!currentWallet) {
          throw new BadRequestException(
            'Customer wallet is unavailable for refund.',
          );
        }

        const before = currentWallet.balance;
        const updatedWallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: refundAmount },
          },
          select: { balance: true },
        });
        const after = updatedWallet.balance;

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            customerId: order.customerId,
            orderId,
            type: 'REFUND',
            status: 'SUCCESS',
            amount: refundAmount,
            balanceBefore: before,
            balanceAfter: after,
            reference: `RZW-REF-${refund.id}`,
            description: `Refund for order ${order.orderNumber}`,
          },
        });

        const totalProcessed = await tx.refund.aggregate({
          where: {
            paymentId: payment.id,
            status: 'PROCESSED',
          },
          _sum: {
            amount: true,
          },
        });

        if (
          (totalProcessed._sum.amount ?? 0) + refundAmount >=
          payment.amount
        ) {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.REFUNDED,
            },
          });
        }

        return tx.refund.update({
          where: { id: refund.id },
          data: {
            status: 'PROCESSED',
            processedAt: new Date(),
            providerReference: payment.reference,
          },
        });
      });

      this.eventEmitter.emit(
        REFUND_PROCESSED_EVENT,
        {
          refundId: updated.id,
          orderId,
          paymentId: payment.id,
          amountKobo: refundAmount,
          reason,
        } as RefundProcessedPayload,
      );

      return updated;
    }

    const provider = this.providers.get(payment.provider);
    const providerReference =
      payment.providerTransactionId ?? payment.reference;

    const result = await provider.refund(
      providerReference,
      refundAmount,
    );

    const processed = result.status === 'processed';

    const updated = await this.prisma.refund.update({
      where: { id: refund.id },
      data: {
        status:
          processed
            ? 'PROCESSED'
            : result.status === 'failed'
              ? 'FAILED'
              : 'PROCESSING',
        processedAt: processed ? new Date() : null,
        providerReference:
          typeof result.raw === 'object' && result.raw
            ? String(
                (result.raw as any).reference ??
                  (result.raw as any).id ??
                  '',
              ) || null
            : null,
      },
    });

    if (processed) {
      // Only mark the payment/order fully refunded when this refund consumes
      // the entire payment. Partial refunds keep the original payment as
      // SUCCESS so the remaining balance remains refundable.
      const totalProcessed = await this.prisma.refund.aggregate({
        where: {
          paymentId: payment.id,
          status: 'PROCESSED',
        },
        _sum: {
          amount: true,
        },
      });

      const fullyRefunded =
        (totalProcessed._sum.amount ?? 0) >= payment.amount;

      if (fullyRefunded) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.REFUNDED,
          },
        });

        // An order that has not been delivered can move into REFUNDED. A
        // delivered order remains DELIVERED because delivery is a terminal
        // operational fact; the refund is represented by Payment.REFUNDED and
        // the compensating ledger entry instead of rewriting history.
        const latestOrder = await this.prisma.order.findUnique({
          where: { id: orderId },
          select: { status: true },
        });

        if (
          latestOrder &&
          !(
            [
              OrderStatus.DELIVERED,
              OrderStatus.CANCELLED,
              OrderStatus.FAILED,
            ] as OrderStatus[]
          ).includes(latestOrder.status)
        ) {
          await this.ordersService.transitionOrder(
            orderId,
            OrderStatus.REFUNDED,
            actorId,
          );
        }
      }

      this.eventEmitter.emit(
        REFUND_PROCESSED_EVENT,
        {
          refundId: updated.id,
          orderId,
          paymentId: payment.id,
          amountKobo: refundAmount,
          reason,
        } as RefundProcessedPayload,
      );
    }

    return updated;
  }

  // Called from the client after a redirect back from the provider. This is
  // a convenience path — it does NOT shortcut verification; it runs the
  // exact same server-side verify-with-provider logic as the webhook.
  // Never confirm a payment based on query params the browser carries back.
  async verifyByReference(
    reference: string,
    providerTransactionId?: string,
    customerId?: string,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { reference },
      select: {
        order: { select: { customerId: true } },
      },
    });

    if (!payment || (customerId && payment.order.customerId !== customerId)) {
      throw new NotFoundException('Payment not found.');
    }
    return this.processVerification(
      reference,
      'manual_verify',
      null,
      providerTransactionId,
    );
  }

  // Provider webhook entrypoint. `rawBody` must be the raw request bytes —
  // signature verification breaks if it's re-serialized JSON.
  async handleWebhook(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ) {
    // Paystack and Flutterwave have separate signed endpoints. This endpoint remains Paystack-compatible.
    if (
      !this.providers
        .getConfigured()
        .verifyWebhookSignature(rawBody, signatureHeader)
    ) {
      throw new BadRequestException(
        'Invalid webhook signature.',
      );
    }

    let payload: any;

    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid webhook JSON.');
    }

    const eventType: string = payload.event ?? 'unknown';
    const reference: string | undefined =
      payload.data?.reference;

    // Paystack refund events do not always put the original transaction
    // reference in data.reference. Resolve it from the nested transaction
    // object when necessary, then settle the matching refund attempt.
    if (
      eventType === 'refund.processed' ||
      eventType === 'refund.failed'
    ) {
      const refundReference =
        payload.data?.transaction?.reference ??
        payload.data?.transaction?.data?.reference ??
        payload.data?.reference;

      const refundId =
        payload.data?.refund_reference ??
        payload.data?.refundReference ??
        payload.data?.id;

      if (!refundReference) {
        return { received: true };
      }

      const payment = await this.prisma.payment.findUnique({
        where: {
          reference: String(refundReference),
        },
      });

      if (!payment) {
        return { received: true };
      }

      const pending = await this.prisma.refund.findFirst({
        where: {
          paymentId: payment.id,
          status: {
            in: ['REQUESTED', 'PROCESSING'],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!pending) {
        return { received: true };
      }

      const status =
        eventType === 'refund.processed'
          ? 'PROCESSED'
          : 'FAILED';

      const updated = await this.prisma.refund.update({
        where: {
          id: pending.id,
        },
        data: {
          status,
          processedAt:
            status === 'PROCESSED' ? new Date() : null,
          providerReference: refundId
            ? String(refundId)
            : pending.providerReference,
        },
      });

      if (status === 'PROCESSED') {
        const totalProcessed =
          await this.prisma.refund.aggregate({
            where: {
              paymentId: payment.id,
              status: 'PROCESSED',
            },
            _sum: {
              amount: true,
            },
          });

        if (
          (totalProcessed._sum.amount ?? 0) >=
          payment.amount
        ) {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.REFUNDED,
            },
          });
        }

        this.eventEmitter.emit(
          REFUND_PROCESSED_EVENT,
          {
            refundId: updated.id,
            orderId: pending.orderId,
            paymentId: payment.id,
            amountKobo: pending.amount,
            reason: pending.reason,
          } as RefundProcessedPayload,
        );
      }

      return {
        received: true,
        status: status.toLowerCase(),
      };
    }

    if (!reference) {
      this.logger.warn(
        `Webhook received with no reference (event: ${eventType})`,
      );

      return {
        received: true,
      };
    }

    await this.processVerification(
      reference,
      eventType,
      payload,
    );

    return {
      received: true,
    };
  }

  async handleFlutterwaveWebhook(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ) {
    const flw = this.providers.getFlutterwave();

    if (
      !flw.verifyWebhookSignature(
        rawBody,
        signatureHeader,
      )
    ) {
      throw new BadRequestException(
        'Invalid Flutterwave webhook signature.',
      );
    }

    let payload: any;

    try {
      payload = JSON.parse(
        rawBody.toString('utf8'),
      );
    } catch {
      throw new BadRequestException(
        'Invalid webhook JSON.',
      );
    }

    const txId = payload?.data?.id;
    const reference = payload?.data?.tx_ref;

    if (!txId || !reference) {
      return {
        received: true,
      };
    }

    const payment =
      await this.prisma.payment.findUnique({
        where: {
          reference,
        },
      });

    if (
      !payment ||
      payment.provider !==
        PaymentProviderName.FLUTTERWAVE
    ) {
      return {
        received: true,
      };
    }

    try {
      await this.prisma.paymentEvent.create({
        data: {
          paymentId: payment.id,
          provider: payment.provider,
          providerReference: String(txId),
          eventType: String(
            payload.event ?? 'charge.completed',
          ),
          rawPayload: payload,
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        return {
          received: true,
        };
      }

      throw e;
    }

    if (payment.status !== PaymentStatus.PENDING) {
      return {
        received: true,
      };
    }

    const verification =
      await flw.verifyTransactionId(
        String(txId),
        reference,
      );

    if (verification.status === 'success') {
      if (
        verification.amountKobo !== payment.amount
      ) {
        throw new ConflictException(
          'Flutterwave payment amount does not match the expected order total.',
        );
      }

      await this.prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: PaymentStatus.SUCCESS,
          paidAt:
            verification.paidAt ?? new Date(),
          providerTransactionId: String(txId),
        },
      });

      await this.ordersService.confirmPayment(
        payment.orderId,
      );

      this.eventEmitter.emit(
        PAYMENT_SUCCEEDED_EVENT,
        {
          orderId: payment.orderId,
          paymentId: payment.id,
          amountKobo: payment.amount,
        } as PaymentSucceededPayload,
      );

      return {
        received: true,
        status: 'success',
      };
    }

    return {
      received: true,
      status: verification.status,
    };
  }

  // Core idempotent verification path shared by the manual-verify endpoint
  // and the webhook handler. Always re-verifies with the provider directly
  // — the webhook payload and the client's redirect are both only used to
  // learn WHICH reference to check, never to learn its status (§19, §71).
  private async processVerification(
    reference: string,
    eventType: string,
    rawPayload: unknown = null,
    providerTransactionId?: string,
  ) {
    const payment =
      await this.prisma.payment.findUnique({
        where: {
          reference,
        },
      });

    if (!payment) {
      this.logger.warn(
        `Verification requested for unknown reference: ${reference}`,
      );

      return {
        status: 'unknown',
      };
    }

    // Record the event for audit/idempotency, but do not treat a duplicate
    // event row as proof that verification succeeded. If the first delivery
    // recorded the event and then provider verification failed or timed out,
    // the provider may retry the same event and we must be able to verify it.
    try {
      await this.prisma.paymentEvent.create({
        data: {
          paymentId: payment.id,
          provider: payment.provider,
          providerReference: reference,
          eventType,
          rawPayload: rawPayload ?? {},
        },
      });
    } catch (err: any) {
      if (err.code !== 'P2002') {
        throw err;
      }

      this.logger.log(
        `Duplicate payment event received: ${reference} / ${eventType}; retrying verification if still pending.`,
      );
    }

    if (payment.status !== PaymentStatus.PENDING) {
      // Already resolved by an earlier event — nothing to do.
      return {
        status: payment.status,
      };
    }

    const provider = this.providers.get(
      payment.provider,
    );

    const verification =
      providerTransactionId &&
      provider.verifyTransactionId
        ? await provider.verifyTransactionId(
            providerTransactionId,
            reference,
          )
        : await provider.verify(reference);

    if (verification.status === 'success') {
      if (
        verification.amountKobo !== payment.amount
      ) {
        // Amount mismatch is a serious integrity problem — never mark paid
        // just because the provider says "success" if the amount doesn't
        // match what we charged for. Flag for manual review instead of
        // silently accepting or silently failing.
        this.logger.error(
          `Amount mismatch for payment ${payment.id}: expected ${payment.amount}, got ${verification.amountKobo}`,
        );

        throw new ConflictException(
          'Payment amount does not match order total — flagged for review.',
        );
      }

      const markedSuccessful = await this.prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: {
          status: PaymentStatus.SUCCESS,
          paidAt: verification.paidAt ?? new Date(),
          ...(providerTransactionId ? { providerTransactionId } : {}),
        },
      });

      if (markedSuccessful.count !== 1) {
        return { status: PaymentStatus.SUCCESS };
      }

      await this.ordersService.confirmPayment(
        payment.orderId,
      );

      this.eventEmitter.emit(
        PAYMENT_SUCCEEDED_EVENT,
        {
          orderId: payment.orderId,
          paymentId: payment.id,
          amountKobo: payment.amount,
        } as PaymentSucceededPayload,
      );

      return {
        status: 'success',
      };
    }

    if (
      verification.status === 'failed' ||
      verification.status === 'abandoned'
    ) {
      const markedFailed = await this.prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED },
      });

      if (markedFailed.count !== 1) {
        return { status: PaymentStatus.FAILED };
      }

      await this.ordersService.markPaymentFailed(
        payment.orderId,
      );

      return {
        status: 'failed',
      };
    }

    return {
      status: 'pending',
    };
  }
}