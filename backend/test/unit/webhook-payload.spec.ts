import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from '../../src/modules/payments/payments.service';

describe('PaymentsService webhook boundary', () => {
  it('rejects invalid signatures before parsing/trusting the payload', async () => {
    const provider = { verifyWebhookSignature: jest.fn().mockReturnValue(false) };
    const providers = { getConfigured: jest.fn().mockReturnValue(provider) };
    const service = new PaymentsService({} as any, {} as any, {} as any, providers as any);
    await expect(service.handleWebhook(Buffer.from('{"event":"charge.success"}'), 'bad'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(provider.verifyWebhookSignature).toHaveBeenCalled();
  });

  it('rejects malformed JSON after a valid signature', async () => {
    const provider = { verifyWebhookSignature: jest.fn().mockReturnValue(true) };
    const providers = { getConfigured: jest.fn().mockReturnValue(provider) };
    const service = new PaymentsService({} as any, {} as any, {} as any, providers as any);
    await expect(service.handleWebhook(Buffer.from('{not-json'), 'valid'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('retries provider verification when the payment is still pending after a duplicate event', async () => {
    const provider = {
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
      verify: jest.fn().mockRejectedValueOnce(new Error('temporary provider failure')).mockResolvedValue({
        status: 'success',
        amountKobo: 5000,
        paidAt: new Date(),
      }),
    };
    const providers = { getConfigured: jest.fn().mockReturnValue(provider), get: jest.fn().mockReturnValue(provider) };
    const payment = {
      id: 'payment-1',
      provider: 'PAYSTACK',
      reference: 'ROZZI-REF-1',
      amount: 5000,
      status: 'PENDING',
      orderId: 'order-1',
    };
    const prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue(payment), update: jest.fn().mockResolvedValue({ ...payment, status: 'SUCCESS' }) },
      paymentEvent: { create: jest.fn().mockRejectedValue({ code: 'P2002' }) },
    };
    const ordersService = { confirmPayment: jest.fn().mockResolvedValue(undefined) };
    const eventEmitter = { emit: jest.fn() };
    const service = new PaymentsService(prisma as any, ordersService as any, eventEmitter as any, providers as any);

    await expect(service.handleWebhook(Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: payment.reference } })), 'valid'))
      .rejects.toThrow('temporary provider failure');

    await expect(service.handleWebhook(Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: payment.reference } })), 'valid'))
      .resolves.toEqual({ received: true });

    expect(provider.verify).toHaveBeenCalledTimes(2);
    expect(prisma.payment.update).toHaveBeenCalledTimes(1);
    expect(ordersService.confirmPayment).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
  });

});
