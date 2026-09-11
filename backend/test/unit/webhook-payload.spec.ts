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
});
