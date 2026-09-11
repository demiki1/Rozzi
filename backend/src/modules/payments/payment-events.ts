export const PAYMENT_SUCCEEDED_EVENT = 'payment.succeeded';

export interface PaymentSucceededPayload {
  orderId: string;
  paymentId: string;
  amountKobo: number;
}
