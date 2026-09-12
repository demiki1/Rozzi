from pathlib import Path

# Correct PostgreSQL table names (Prisma models are mapped to lowercase tables)
# and apply the payment/order race fixes only where the old code still exists.
p = Path('backend/src/modules/payments/payments.service.ts')
s = p.read_text(encoding='utf-8-sig')
s = s.replace('FROM "Order" WHERE id = ${orderId}', 'FROM "orders" WHERE id = ${orderId}')
s = s.replace('FROM "Refund" WHERE id = ${refund.id}', 'FROM "refunds" WHERE id = ${refund.id}')
s = s.replace('FROM "Wallet" WHERE id = ${wallet.id}', 'FROM "wallets" WHERE id = ${wallet.id}')

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
        SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE
      `;
      const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
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
      if (currentPending?.authorizationUrl) return currentPending;
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
if old in s:
    s = s.replace(old, new, 1)

old = '''    const refund = await this.prisma.$transaction(async (tx) => {'''
new = '''    const allocation = await this.prisma.$transaction(async (tx) => {'''
if old in s:
    s = s.replace(old, new, 1)
old = '''      if (existing) {
        return existing;
      }

      return tx.refund.create({'''
new = '''      if (existing) {
        return { refund: existing, created: false };
      }

      return { refund: await tx.refund.create({'''
if old in s:
    s = s.replace(old, new, 1)
old = '''          status: 'PROCESSING',
        },
      });
    });

    // Wallet payments are refunded internally'''
new = '''          status: 'PROCESSING',
        },
      }), created: true };
    });

    const refund = allocation.refund;
    if (!allocation.created && payment.provider !== PaymentProviderName.WALLET) {
      return refund;
    }

    // Wallet payments are refunded internally'''
if old in s:
    s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

p = Path('backend/src/modules/orders/orders.service.ts')
s = p.read_text(encoding='utf-8-sig')
s = s.replace('FROM "Order" WHERE id = ${orderId}', 'FROM "orders" WHERE id = ${orderId}')
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
        SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE
      `;
      const current = await tx.order.findUnique({ where: { id: orderId } });
      if (!current) throw new NotFoundException('Order not found.');
      this.stateMachine.assertValidTransition(current.status, toStatus);
      const changed = await tx.order.update({ where: { id: orderId }, data: { status: toStatus } });
      await tx.orderStatusHistory.create({
        data: { orderId, fromStatus: current.status, toStatus, changedByUserId },
      });
      return changed;
    });
'''
if old in s:
    s = s.replace(old, new, 1)
old = '''          const current =
            await tx.order.findUnique({
              where: { id: orderId },
              include: {
                items: true,
              },
            });'''
new = '''          await tx.$queryRaw`
            SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE
          `;
          const current =
            await tx.order.findUnique({
              where: { id: orderId },
              include: {
                items: true,
              },
            });'''
if old in s: s = s.replace(old, new, 1)
old = '''          const current =
            await tx.order.findUnique({
              where: { id: orderId },
            });

          if (
            !current ||
            current.customerId !==
              customerId'''
new = '''          await tx.$queryRaw`
            SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE
          `;
          const current =
            await tx.order.findUnique({
              where: { id: orderId },
            });

          if (
            !current ||
            current.customerId !==
              customerId'''
if old in s: s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
