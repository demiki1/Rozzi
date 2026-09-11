import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OrdersService } from '../orders/orders.service';
import { ORDER_TRANSITIONED_EVENT, OrderTransitionedPayload } from '../orders/order-events';
import { NOTIFICATION_CREATED_EVENT, NotificationCreatedPayload } from '../notifications/notification-events';

// §16: "Use WebSockets/Socket.IO... Do not require the customer to
// constantly refresh the page." This gateway is intentionally narrow: it
// only pushes order status changes into a room scoped to that order. It
// does not (yet) push live rider GPS position — RiderLocation exists
// (Phase 6) but nothing streams it to the customer map yet. That's a
// reasonable next increment on top of this same gateway, not a rewrite.
//
// SECURITY (Phase 11 pass): CORS here now mirrors main.ts's CORS_ORIGIN
// allowlist instead of a hardcoded '*'. Note this reads process.env
// directly at module-load time (decorator options are evaluated once,
// before Nest's DI/ConfigService exists yet) — functionally equivalent to
// main.ts's approach for this purpose, just wired a different way because
// of when @WebSocketGateway's options are evaluated.
const CORS_ORIGIN_ENV = process.env.CORS_ORIGIN?.trim();
const DEFAULT_LOCAL_CORS_ORIGINS = [
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
];
const GATEWAY_CORS_ORIGIN = CORS_ORIGIN_ENV
  ? CORS_ORIGIN_ENV.split(',').map((o) => o.trim()).filter(Boolean)
  : process.env.NODE_ENV === 'production'
    ? []
    : DEFAULT_LOCAL_CORS_ORIGINS;

@WebSocketGateway({ cors: { origin: GATEWAY_CORS_ORIGIN } })
export class TrackingGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('TrackingGateway');

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly ordersService: OrdersService,
  ) {}

  // Authenticates on connect using the same access token the REST API
  // uses (passed via `socket.handshake.auth.token`, not a cookie — this is
  // a plain WebSocket connection, not a browser-cookie-bearing request).
  // A connection with a missing/invalid/expired token is rejected outright
  // rather than allowed to connect anonymously and filtered later.
  handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new UnauthorizedException('Missing auth token.');

      const payload = this.jwt.verify<{ sub: string; role: string }>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      socket.join(this.userRoom(payload.sub));
      socket.join(this.roleRoom(payload.role));
    } catch {
      socket.emit('error', { message: 'Unauthorized.' });
      socket.disconnect(true);
    }
  }

  // Client calls this after connecting to start receiving updates for one
  // order. Access control reuses OrdersService.getOrderDetail's existing
  // rule (customer/owning vendor/admin only) rather than duplicating it —
  // if the caller isn't allowed to view the order over REST, they aren't
  // allowed to subscribe to it over the socket either.
  @SubscribeMessage('subscribe_order')
  async handleSubscribe(@ConnectedSocket() socket: Socket, @MessageBody() data: { orderId: string }) {
    try {
      await this.ordersService.getOrderDetail(socket.data.userId, socket.data.role, data.orderId);
      socket.join(this.roomFor(data.orderId));
      socket.emit('subscribed', { orderId: data.orderId });
    } catch {
      socket.emit('error', { message: 'Not authorized to track this order.' });
    }
  }

  @SubscribeMessage('unsubscribe_order')
  handleUnsubscribe(@ConnectedSocket() socket: Socket, @MessageBody() data: { orderId: string }) {
    socket.leave(this.roomFor(data.orderId));
  }

  @OnEvent(NOTIFICATION_CREATED_EVENT)
  broadcastNotification(payload: NotificationCreatedPayload) {
    this.server.to(this.userRoom(payload.userId)).emit('notification:new', payload.notification);
  }

  @OnEvent(ORDER_TRANSITIONED_EVENT)
  async broadcastStatusChange(payload: OrderTransitionedPayload) {
    const event = {
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      status: payload.toStatus,
      timestamp: new Date().toISOString(),
    };
    // Order detail/tracking subscribers receive the event in their scoped
    // room. Lists also receive it through their authenticated user/role room
    // so they can refresh without joining dozens of order rooms.
    this.server.to(this.roomFor(payload.orderId)).emit('order:status', event);
    this.server.to(this.userRoom(payload.customerId)).emit('order:status', event);

    const vendor = await this.ordersService.getVendorOwnerUserId(payload.vendorId);
    if (vendor) this.server.to(this.userRoom(vendor)).emit('order:status', event);

    const delivery = await this.ordersService.findDeliveryForRealtime(payload.orderId);
    if (delivery?.riderOwnerUserId) this.server.to(this.userRoom(delivery.riderOwnerUserId)).emit('order:status', event);
    this.server.to(this.roleRoom('ADMIN')).emit('order:status', event);
  }


  // Rider GPS updates are broadcast only to customers/vendors/admins already
  // authorized to track the associated order. The rider itself is never
  // exposed as a global location feed.
  @OnEvent('rider.location.updated')
  async broadcastRiderLocation(payload: { riderId: string; latitude: number; longitude: number; updatedAt: string }) {
    const deliveries = await this.ordersService.findActiveOrdersForRider(payload.riderId);
    for (const order of deliveries) {
      this.server.to(this.roomFor(order.id)).emit('rider:location', {
        orderId: order.id, latitude: payload.latitude, longitude: payload.longitude, updatedAt: payload.updatedAt,
      });
    }
  }

  private roomFor(orderId: string): string {
    return `order:${orderId}`;
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }

  private roleRoom(role: string): string {
    return `role:${role}`;
  }
}
