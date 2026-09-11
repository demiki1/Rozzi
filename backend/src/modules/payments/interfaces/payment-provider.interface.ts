// §19: "Architecture should allow another provider to be added later."
// Nothing outside PaymentsService should ever import a specific provider
// SDK/adapter directly — always talk to this interface.

export interface InitializePaymentParams {
  reference: string;
  amountKobo: number;
  email: string;
  metadata?: Record<string, unknown>;
  callbackUrl?: string;
}

export interface InitializePaymentResult {
  authorizationUrl: string;
  accessCode?: string;
  reference: string;
}

export type VerifiedPaymentStatus = 'success' | 'failed' | 'pending' | 'abandoned';

export interface VerifyPaymentResult {
  status: VerifiedPaymentStatus;
  amountKobo: number;
  currency: string;
  paidAt?: Date;
  raw: unknown;
}

export interface RefundResult {
  status: 'pending' | 'processed' | 'failed';
  raw: unknown;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

export interface PaymentProvider {
  readonly name: 'PAYSTACK' | 'FLUTTERWAVE';

  initialize(params: InitializePaymentParams): Promise<InitializePaymentResult>;

  // Always the authoritative source of truth for payment status — never
  // trust a webhook body or a frontend redirect on its own (§19, §71).
  verify(reference: string): Promise<VerifyPaymentResult>;

  // Providers such as Flutterwave use a provider-side transaction ID for
  // authoritative verification. Providers that do not need it may omit this.
  verifyTransactionId?(id: string, expectedReference?: string): Promise<VerifyPaymentResult>;

  // Confirms a webhook payload actually came from the provider before any
  // of its contents are used for anything (§71).
  verifyWebhookSignature(rawBody: Buffer | string, signatureHeader: string | undefined): boolean;

  refund(reference: string, amountKobo?: number): Promise<RefundResult>;
}
