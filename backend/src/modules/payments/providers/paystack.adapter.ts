import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  InitializePaymentParams,
  InitializePaymentResult,
  PaymentProvider,
  RefundResult,
  VerifyPaymentResult,
} from '../interfaces/payment-provider.interface';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

@Injectable()
export class PaystackAdapter implements PaymentProvider {
  readonly name = 'PAYSTACK' as const;

  constructor(private readonly config: ConfigService) {}

  private getSecretKey(): string {
    const key = this.config.get<string>('PAYSTACK_SECRET_KEY');
    if (!key) {
      // Per spec §100: never fake a successful response when credentials
      // are missing. Fail loudly and specifically instead.
      throw new ServiceUnavailableException(
        'Payment integration implemented but awaiting Paystack credentials (PAYSTACK_SECRET_KEY is not set).',
      );
    }
    return key;
  }

  async initialize(params: InitializePaymentParams): Promise<InitializePaymentResult> {
    const secretKey = this.getSecretKey();

    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reference: params.reference,
        amount: params.amountKobo, // Paystack expects the smallest currency unit, same as our storage unit
        email: params.email,
        metadata: params.metadata,
        callback_url: params.callbackUrl,
      }),
    });

    const body = await response.json();
    if (!response.ok || !body.status) {
      throw new ServiceUnavailableException(
        `Paystack initialization failed: ${body?.message ?? response.statusText}`,
      );
    }

    return {
      authorizationUrl: body.data.authorization_url,
      accessCode: body.data.access_code,
      reference: body.data.reference,
    };
  }

  async verify(reference: string): Promise<VerifyPaymentResult> {
    const secretKey = this.getSecretKey();

    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    const body = await response.json();
    if (!response.ok || !body.status) {
      throw new ServiceUnavailableException(
        `Paystack verification failed: ${body?.message ?? response.statusText}`,
      );
    }

    const data = body.data;
    const statusMap: Record<string, VerifyPaymentResult['status']> = {
      success: 'success',
      failed: 'failed',
      abandoned: 'abandoned',
    };

    return {
      status: statusMap[data.status] ?? 'pending',
      amountKobo: data.amount,
      currency: data.currency,
      paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
      raw: data,
    };
  }

  // Paystack signs webhook bodies with HMAC-SHA512 of the raw request body,
  // using the secret key, sent in the `x-paystack-signature` header. We
  // compare digests rather than ever trusting the payload's own claims
  // about itself (§71).
  verifyWebhookSignature(rawBody: Buffer | string, signatureHeader: string | undefined): boolean {
    if (!signatureHeader) return false;
    const secretKey = this.getSecretKey();
    const expected = createHmac('sha512', secretKey).update(rawBody).digest('hex');
    const received = signatureHeader.trim().toLowerCase();
    if (!/^[a-f0-9]{128}$/.test(received)) return false;
    const expectedBuffer = Buffer.from(expected, 'hex');
    const receivedBuffer = Buffer.from(received, 'hex');
    return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  async refund(reference: string, amountKobo?: number): Promise<RefundResult> {
    const secretKey = this.getSecretKey();

    const response = await fetch(`${PAYSTACK_BASE_URL}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transaction: reference, amount: amountKobo }),
    });

    const body = await response.json();
    if (!response.ok || !body.status) {
      return { status: 'failed', raw: body };
    }
    return { status: 'pending', raw: body.data };
  }
}
