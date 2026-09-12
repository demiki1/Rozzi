from pathlib import Path

# Idempotently apply the same-order wallet lock if it has not already been persisted.
p = Path('backend/src/modules/payments/payments.service.ts')
s = p.read_text(encoding='utf-8-sig')
wallet_anchor = '''    const result = await this.prisma.$transaction(async (tx) => {\n      const order = await tx.order.findUnique({'''
wallet_locked = '''    const result = await this.prisma.$transaction(async (tx) => {\n      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;\n\n      const order = await tx.order.findUnique({'''
if wallet_anchor in s:
    s = s.replace(wallet_anchor, wallet_locked, 1)

# Serialize payment-provider initialization at the database boundary after the external call.
old = '''    await this.prisma.payment.create({\n      data: {\n        orderId: order.id,\n        provider: provider.name as PaymentProviderName,\n        reference: result.reference,\n        amount: order.totalAmount,\n        status: PaymentStatus.PENDING,\n        authorizationUrl: result.authorizationUrl,\n      },\n    });\n\n    return {\n      authorizationUrl: result.authorizationUrl,\n      reference: result.reference,\n    };\n'''
new = '''    const persisted = await this.prisma.$transaction(async (tx) => {\n      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;\n      const currentOrder = await tx.order.findUnique({ where: { id: orderId } });\n      if (!currentOrder || currentOrder.customerId !== customerId) {\n        throw new NotFoundException('Order not found.');\n      }\n      if (currentOrder.status !== OrderStatus.PENDING_PAYMENT) {\n        throw new BadRequestException('This order is not awaiting payment.');\n      }\n      const currentPending = await tx.payment.findFirst({\n        where: { orderId, status: PaymentStatus.PENDING },\n        orderBy: { createdAt: 'desc' },\n      });\n      if (currentPending?.authorizationUrl) return currentPending;\n      return tx.payment.create({\n        data: {\n          orderId: currentOrder.id,\n          provider: provider.name as PaymentProviderName,\n          reference: result.reference,\n          amount: currentOrder.totalAmount,\n          status: PaymentStatus.PENDING,\n          authorizationUrl: result.authorizationUrl,\n        },\n      });\n    });\n\n    return {\n      authorizationUrl: persisted.authorizationUrl ?? result.authorizationUrl,\n      reference: persisted.reference,\n    };\n'''
if old in s:
    s = s.replace(old, new, 1)

# Do not submit an external refund again when a REQUESTED/PROCESSING refund already exists.
old = '''    const refund = await this.prisma.$transaction(async (tx) => {'''
new = '''    const allocation = await this.prisma.$transaction(async (tx) => {'''
if old in s:
    s = s.replace(old, new, 1)
old = '''      if (existing) {\n        return existing;\n      }\n\n      return tx.refund.create({'''
new = '''      if (existing) {\n        return { refund: existing, created: false };\n      }\n\n      return { refund: await tx.refund.create({'''
if old in s:
    s = s.replace(old, new, 1)
old = '''          status: 'PROCESSING',\n        },\n      });\n    });\n\n    // Wallet payments are refunded internally'''
new = '''          status: 'PROCESSING',\n        },\n      }), created: true };\n    });\n\n    const refund = allocation.refund;\n    if (!allocation.created && payment.provider !== PaymentProviderName.WALLET) {\n      return refund;\n    }\n\n    // Wallet payments are refunded internally'''
if old in s:
    s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# Central order transition serialization.
p = Path('backend/src/modules/orders/orders.service.ts')
s = p.read_text(encoding='utf-8-sig')
old = '''    const [updated]\n      = await this.prisma.$transaction([\n        this.prisma.order.update({\n          where: {\n            id: orderId,\n          },\n          data: {\n            status: toStatus,\n          },\n        }),\n\n        this.prisma.orderStatusHistory.create(\n          {\n            data: {\n              orderId,\n              fromStatus:\n                order.status,\n              toStatus,\n              changedByUserId,\n            },\n          },\n        ),\n      ]);\n'''
# Handle the exact formatting currently used by the repository.
if old not in s:
    old = '''    const [updated] =\n      await this.prisma.$transaction([\n        this.prisma.order.update({\n          where: {\n            id: orderId,\n          },\n          data: {\n            status: toStatus,\n          },\n        }),\n\n        this.prisma.orderStatusHistory.create(\n          {\n            data: {\n              orderId,\n              fromStatus: order.status,\n              toStatus,\n              changedByUserId,\n            },\n          },\n        ),\n      ]);\n'''
new = '''    const updated = await this.prisma.$transaction(async (tx) => {\n      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;\n      const current = await tx.order.findUnique({ where: { id: orderId } });\n      if (!current) throw new NotFoundException('Order not found.');\n      this.stateMachine.assertValidTransition(current.status, toStatus);\n      const changed = await tx.order.update({\n        where: { id: orderId },\n        data: { status: toStatus },\n      });\n      await tx.orderStatusHistory.create({\n        data: { orderId, fromStatus: current.status, toStatus, changedByUserId },\n      });\n      return changed;\n    });\n'''
if old in s:
    s = s.replace(old, new, 1)

# Lock the order in vendor rejection and customer cancellation transactions.
old = '''          const current =\n            await tx.order.findUnique({\n              where: { id: orderId },\n              include: {\n                items: true,\n              },\n            });'''
new = '''          await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;\n\n          const current =\n            await tx.order.findUnique({\n              where: { id: orderId },\n              include: {\n                items: true,\n              },\n            });'''
if old in s:
    s = s.replace(old, new, 1)
old = '''          const current =\n            await tx.order.findUnique({\n              where: { id: orderId },\n            });\n\n          if (\n            !current ||\n            current.customerId !==\n              customerId'''
new = '''          await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;\n\n          const current =\n            await tx.order.findUnique({\n              where: { id: orderId },\n            });\n\n          if (\n            !current ||\n            current.customerId !==\n              customerId'''
if old in s:
    s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
