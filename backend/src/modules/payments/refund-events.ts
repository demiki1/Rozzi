export const REFUND_PROCESSED_EVENT = 'payment.refund.processed';
export interface RefundProcessedPayload {
  refundId: string;
  orderId: string;
  paymentId: string;
  amountKobo: number;
  reason?: string;
}
