export const NOTIFICATION_CREATED_EVENT = 'notification.created';

export interface NotificationCreatedPayload {
  userId: string;
  notification: {
    id: string;
    channel: string;
    type: string;
    title: string;
    message: string;
    relatedOrderId?: string | null;
    createdAt: string;
  };
}
