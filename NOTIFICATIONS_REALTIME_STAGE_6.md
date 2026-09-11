# ROZZI — Stage 6: Notifications & Real-Time Bridge

## Goal
Make Customer, Vendor, Rider and Admin receive low-latency order and in-app notification updates from the same NestJS backend without replacing the existing notification/order architecture.

## Changes
- Added `notification.created` event for safe in-app notification payloads.
- Notifications service emits the event only after creating an in-app notification record.
- TrackingGateway authenticates Socket.IO connections with the normal JWT access token and joins user/role rooms.
- Added `notification:new` websocket event to the authenticated user's room.
- Added `order:status` websocket delivery to:
  - order-specific subscribers;
  - customer user room;
  - vendor owner user room;
  - assigned rider user room;
  - admin role room.
- Added real-time rider location updates to existing order rooms; no sensitive OTP/payment fields are broadcast.
- Customer tracking subscribes to the order room for immediate status/location updates.
- Customer and Vendor notification pages receive new notifications immediately.
- Added Rider and Admin notification pages using the same backend notification API.
- Vendor, Rider and Admin order views refresh immediately on order-status events, with slower polling retained as a fallback.
- Socket.IO clients use the latest access token on reconnect so normal access-token refresh does not leave a stale socket credential.
- Added `socket.io-client` to all four frontend package manifests.

## Security
- Socket connections require a valid JWT.
- Order room subscription reuses the existing order-detail authorization rules.
- User/role room broadcasts contain only non-sensitive order/notification metadata.
- Delivery OTPs are never broadcast over websocket.
- REST APIs remain the source of truth; realtime events are UI acceleration only.

## Verification
- TypeScript/TSX transpilation check passed for all Stage 6 changed source files.
- Full dependency build was not run in the packaging environment because `node_modules` is not installed and `socket.io-client` could not be downloaded from the npm registry in the isolated environment.

## Local install requirement
After extracting the project, run from the ROZZI root:

`npm install`

Then run the normal Prisma generate/deploy and application build/start commands.
