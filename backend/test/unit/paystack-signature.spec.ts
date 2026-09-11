import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PaystackAdapter } from '../../src/modules/payments/providers/paystack.adapter';

describe('PaystackAdapter webhook signatures', () => {
  const secret = 'test-paystack-secret';
  const body = Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: 'ref-1' } }));

  const adapter = () => new PaystackAdapter({ get: (key: string) => key === 'PAYSTACK_SECRET_KEY' ? secret : undefined } as unknown as ConfigService);

  it('accepts an authentic HMAC-SHA512 signature', () => {
    const signature = createHmac('sha512', secret).update(body).digest('hex');
    expect(adapter().verifyWebhookSignature(body, signature)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const signature = createHmac('sha512', secret).update(body).digest('hex');
    expect(adapter().verifyWebhookSignature(Buffer.from(body.toString() + 'x'), signature)).toBe(false);
  });

  it('rejects malformed signatures without throwing', () => {
    expect(adapter().verifyWebhookSignature(body, 'not-a-signature')).toBe(false);
    expect(adapter().verifyWebhookSignature(body, undefined)).toBe(false);
  });
});
