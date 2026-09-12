from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8-sig')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')

# Payment verification must remain retryable when the same webhook/event is
# delivered again after a transient provider failure. A duplicate event record
# is not proof that the payment was successfully processed.
path = 'backend/src/modules/payments/payments.service.ts'
text = read(path)
old = '''    // Idempotency: if we've already recorded this exact (provider,\n    // reference, eventType) combination, do nothing further. A duplicate\n    // webhook delivery must never double-process a payment (§70).\n    try {\n      await this.prisma.paymentEvent.create({\n        data: {\n          paymentId: payment.id,\n          provider: payment.provider,\n          providerReference: reference,\n          eventType,\n          rawPayload: rawPayload ?? {},\n        },\n      });\n    } catch (err: any) {\n      if (err.code === 'P2002') {\n        this.logger.log(\n          `Duplicate payment event ignored: ${reference} / ${eventType}`,\n        );\n\n        return {\n          status: 'already_processed',\n        };\n      }\n\n      throw err;\n    }\n\n    if (payment.status !== PaymentStatus.PENDING) {\n      // Already resolved by an earlier event — nothing to do.\n      return {\n        status: payment.status,\n      };\n    }\n'''
new = '''    // Record the event for audit/idempotency, but do not treat a duplicate\n    // event row as proof that verification succeeded. If the first delivery\n    // recorded the event and then provider verification failed or timed out,\n    // the provider may retry the same event and we must be able to verify it.\n    try {\n      await this.prisma.paymentEvent.create({\n        data: {\n          paymentId: payment.id,\n          provider: payment.provider,\n          providerReference: reference,\n          eventType,\n          rawPayload: rawPayload ?? {},\n        },\n      });\n    } catch (err: any) {\n      if (err.code !== 'P2002') {\n        throw err;\n      }\n\n      this.logger.log(\n        `Duplicate payment event received: ${reference} / ${eventType}; retrying verification if still pending.`,\n      );\n    }\n\n    if (payment.status !== PaymentStatus.PENDING) {\n      // Already resolved by an earlier event — nothing to do.\n      return {\n        status: payment.status,\n      };\n    }\n'''
if old not in text:
    raise SystemExit('payment verification block not found')
text = text.replace(old, new, 1)
write(path, text)

# Regression test: duplicate event persistence must not prevent a pending
# payment from being re-verified after a prior transient failure.
test_path = 'backend/test/unit/webhook-payload.spec.ts'
test = read(test_path)
addition = '''\n\n  it('retries provider verification when the payment is still pending after a duplicate event', async () => {\n    const provider = {\n      verifyWebhookSignature: jest.fn().mockReturnValue(true),\n      verify: jest.fn().mockRejectedValueOnce(new Error('temporary provider failure')).mockResolvedValue({\n        status: 'success',\n        amountKobo: 5000,\n        paidAt: new Date(),\n      }),\n    };\n    const providers = { getConfigured: jest.fn().mockReturnValue(provider), get: jest.fn().mockReturnValue(provider) };\n    const payment = {\n      id: 'payment-1',\n      provider: 'PAYSTACK',\n      reference: 'ROZZI-REF-1',\n      amount: 5000,\n      status: 'PENDING',\n      orderId: 'order-1',\n    };\n    const prisma = {\n      payment: { findUnique: jest.fn().mockResolvedValue(payment), update: jest.fn().mockResolvedValue({ ...payment, status: 'SUCCESS' }) },\n      paymentEvent: { create: jest.fn().mockRejectedValue({ code: 'P2002' }) },\n    };\n    const ordersService = { confirmPayment: jest.fn().mockResolvedValue(undefined) };\n    const eventEmitter = { emit: jest.fn() };\n    const service = new PaymentsService(prisma as any, ordersService as any, eventEmitter as any, providers as any);\n\n    await expect(service.handleWebhook(Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: payment.reference } })), 'valid'))\n      .rejects.toThrow('temporary provider failure');\n\n    await expect(service.handleWebhook(Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: payment.reference } })), 'valid'))\n      .resolves.toEqual({ received: true });\n\n    expect(provider.verify).toHaveBeenCalledTimes(2);\n    expect(prisma.payment.update).toHaveBeenCalledTimes(1);\n    expect(ordersService.confirmPayment).toHaveBeenCalledTimes(1);\n    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);\n  });\n'''
if addition.strip() not in test:
    marker = '\n});\n'
    if not test.endswith(marker):
        raise SystemExit('webhook test ending not found')
    test = test[:-len(marker)] + addition + marker
write(test_path, test)
