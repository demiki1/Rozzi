// Separate from ORDER_TRANSITIONED_EVENT because the OTP itself isn't part
// of order status — it's sensitive order data that must reach exactly one
// recipient (the customer), never the rider. Keeping it a distinct event
// makes that recipient rule obvious at the listener, not just at the API
// layer (see DeliveryController's comment about never returning the code
// to the rider).
export const DELIVERY_OTP_GENERATED_EVENT = 'delivery.otp_generated';

export interface DeliveryOtpGeneratedPayload {
  orderId: string;
  orderNumber: string;
  customerId: string;
  code: string;
}


export const DELIVERY_OFFERED_EVENT = 'delivery.offer_created';

export interface DeliveryOfferCreatedPayload {
  attemptId: string;
  deliveryId: string;
  orderId: string;
  orderNumber: string;
  riderOwnerUserId: string;
  expiresAt: string;
  distanceKm: number | null;
}
