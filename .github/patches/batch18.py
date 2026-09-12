from pathlib import Path

# Payment initialization: avoid persisting duplicate provider attempts by
# re-checking the order while holding its row lock after provider initialization.
p = Path('backend/src/modules/payments/payments.service.ts')
s = p.read_text(encoding='utf-8-sig')
old = '''    await this.prisma.payment.create({
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
'''
new = '''    const persisted = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE
      `;

      const currentOrder = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!currentOrder || currentOrder.customerId !== customerId) {
        throw new NotFoundException('Order not found.');
      }

      if (currentOrder.status !== OrderStatus.PENDING_PAYMENT) {
        throw new BadRequestException('This order is not awaiting payment.');
      }

      const currentPending = await tx.payment.findFirst({
        where: { orderId, status: PaymentStatus.PENDING },
        orderBy: { createdAt: 'desc' },
      });

      if (currentPending?.authorizationUrl) {
        return currentPending;
      }

      return tx.payment.create({
        data: {
          orderId: currentOrder.id,
          provider: provider.name as PaymentProviderName,
          reference: result.reference,
          amount: currentOrder.totalAmount,
          status: PaymentStatus.PENDING,
          authorizationUrl: result.authorizationUrl,
        },
      });
    });

    return {
      authorizationUrl: persisted.authorizationUrl ?? result.authorizationUrl,
      reference: persisted.reference,
    };
'''
if old not in s:
    raise SystemExit('payment initialize create block not found')
s = s.replace(old, new, 1)

# External refunds: an existing REQUESTED/PROCESSING allocation must be returned
# without submitting the provider call again.
old = '''    const refund = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "Payment" WHERE id = ${payment.id} FOR UPDATE
      `;
'''
new = '''    const allocation = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "Payment" WHERE id = ${payment.id} FOR UPDATE
      `;
'''
if old not in s:
    raise SystemExit('refund allocation anchor not found')
s = s.replace(old, new, 1)
old = '''      if (existing) {
        return existing;
      }

      return tx.refund.create({
'''
new = '''      if (existing) {
        return { refund: existing, created: false };
      }

      return {
        refund: await tx.refund.create({
'''
if old not in s:
    raise SystemExit('refund existing block not found')
s = s.replace(old, new, 1)
old = '''          status: 'PROCESSING',
        },
      });
    });

    // Wallet payments are refunded internally'''
new = '''          status: 'PROCESSING',
        },
      }),
        created: true,
      };
    });

    const refund = allocation.refund;

    // An existing provider refund is already in flight. Do not submit it again.
    if (!allocation.created && payment.provider !== PaymentProviderName.WALLET) {
      return refund;
    }

    // Wallet payments are refunded internally'''
if old not in s:
    raise SystemExit('refund create close block not found')
s = s.replace(old, new, 1)

# Central order transition: lock and re-read the order inside the same transaction
# that updates status/history, so competing transitions cannot both validate the
# same old state.
p = Path('backend/src/modules/orders/orders.service.ts')
s = p.read_text(encoding='utf-8-sig')
old = '''    const [updated] =
      await this.prisma.$transaction([
        this.prisma.order.update({
          where: {
            id: orderId,
          },
          data: {
            status: toStatus,
          },
        }),

        this.prisma.orderStatusHistory.create(
          {
            data: {
              orderId,
              fromStatus:
                order.status,
              toStatus,
              changedByUserId,
            },
          },
        ),
      ]);
'''
new = '''    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE
      `;

      const current = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!current) {
        throw new NotFoundException('Order not found.');
      }

      this.stateMachine.assertValidTransition(
        current.status,
        toStatus,
      );

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
'''
if old not in s:
    raise SystemExit('applyTransition transaction block not found')
s = s.replace(old, new, 1)

# Vendor rejection and customer cancellation already re-check inside transactions;
# add row locks before those reads so the inventory/status decision is serialized.
old = '''          const current =
            await tx.order.findUnique({
              where: { id: orderId },
              include: {
                items: true,
              },
            });
'''
new = '''          await tx.$queryRaw`
            SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE
          `;

          const current =
            await tx.order.findUnique({
              where: { id: orderId },
              include: {
                items: true,
              },
            });
'''
if old not in s:
    raise SystemExit('vendor reject transaction read not found')
s = s.replace(old, new, 1)
old = '''          const current =
            await tx.order.findUnique({
              where: { id: orderId },
            });

          if (
            !current ||
            current.customerId !==
              customerId
'''
new = '''          await tx.$queryRaw`
            SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE
          `;

          const current =
            await tx.order.findUnique({
              where: { id: orderId },
            });

          if (
            !current ||
            current.customerId !==
              customerId
'''
if old not in s:
    raise SystemExit('customer cancel transaction read not found')
s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')
