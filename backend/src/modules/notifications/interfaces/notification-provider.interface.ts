// §33: "Support in-app notifications, Email, SMS, Push." Same abstraction
// pattern as PaymentProvider (Phase 5) — NotificationsService only talks to
// these interfaces, never to a specific vendor SDK, so swapping in a real
// provider later (SendGrid, Termii, Africa's Talking, etc.) once
// EMAIL_API_KEY/SMS_API_KEY are actually set is a new adapter class, not a
// rewrite of NotificationsService.

export interface EmailProvider {
  send(to: string, subject: string, body: string): Promise<void>;
}

export interface SmsProvider {
  send(to: string, message: string): Promise<void>;
}

export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';
export const SMS_PROVIDER = 'SMS_PROVIDER';
