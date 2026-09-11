# ROZZI Integration — Stage 1

## Base selected
The Rider `team_work` monorepo is used as the canonical application base because it contains the complete four-app monorepo, shared NestJS backend, vendor features, rider advanced features, admin application, migrations, and runtime architecture.

The Customer dashboard upload is an incremental backend/source snapshot rather than a complete customer Next.js app, so its customer-side backend additions are merged into the canonical monorepo instead of replacing the existing customer frontend.

## Preserved
- Existing Customer, Vendor, Rider and Admin application structure and UI.
- Existing NestJS modules, authentication, role guards, order state machine, delivery flow, finance, notifications, realtime and vendor/rider functionality.
- Existing Rider advanced features.
- Existing Vendor features.
- Existing Admin routes and navigation.

## Integrated from Customer snapshot
- Customer profile/settings/address backend module.
- Customer favorites backend module.
- Customer wallet/promotions backend module.
- Structured cart option selections.
- Cart configuration keys for separate product configurations.
- Order-item option snapshots in the database schema.
- Customer review title/photo URL fields.
- Customer refund-request backend endpoints.
- Customer notification preference fields.
- Customer favorite vendor/product relations.

## Compatibility work
- Kept the full Rider/Vendor order controller/service/state-machine architecture rather than replacing it with the simplified Customer snapshot.
- Kept the full Rider/Vendor review service and added Customer-compatible review creation/history/summary routes.
- Kept the full Support service for customer/vendor/admin tickets and added Customer refund request/list operations.
- Added Account, Favorites and Wallet modules to the shared NestJS AppModule.
- Preserved existing cart role guards/controller while upgrading the cart service/DTO to support structured product options.
- Appended the Customer migrations after the existing Rider migrations using new migration timestamps to avoid duplicate migration directory names.

## Migration order
1. Existing baseline/vendor migrations
2. Existing Rider Phase 1–6 migrations
3. `20260903010000_add_structured_cart_options`
4. `20260903020000_customer_wallet_promotions`
5. `20260903030000_customer_favorites_reviews`
6. `20260903040000_customer_profile_settings`

## Important verification status
Full runtime verification is still pending because the integration environment does not have the project dependencies installed successfully. The attempted package installation timed out, so Prisma generation/migration execution and full NestJS/Next builds must be run after installing dependencies in the normal ROZZI development environment.

## Deliberately not merged yet
Admin Module 21's Audit Log page is currently a UI/source implementation with demo audit rows. The existing ROZZI admin backend already exposes real audit records. The next integration step should connect the Module 21 design to the real audit API and avoid presenting fabricated governance data as live data.
