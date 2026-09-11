# ROZZI Rider Dashboard — Phase 3 Performance

## Scope completed at source level
- Rider ratings from customer `Review.riderRating` data
- Performance metrics: rating, acceptance, completion, cancellation, on-time proxy, average delivery time
- ROZZI Rider Score with visible weighted scorecard
- Rider levels: Starter, Pro, Elite, Champion with XP and benefits
- Achievement badges and automatic milestone awarding
- Bonus records integrated with the existing rider ledger as positive `ADJUSTMENT` entries
- Daily and weekly rider challenges with progress and claimable rewards
- Rider referral code, referred-rider list, and first-delivery referral reward flow
- Responsive Rider Performance page with mobile bottom navigation
- New authenticated Rider Performance API endpoints
- Prisma schema additions and migration

## API surface
- `GET /api/rider/performance/overview`
- `GET /api/rider/performance?days=30`
- `GET /api/rider/performance/achievements`
- `GET /api/rider/performance/bonuses`
- `GET /api/rider/performance/challenges`
- `POST /api/rider/performance/challenges/:id/claim`
- `GET /api/rider/performance/referrals`
- `POST /api/rider/performance/referrals`

## Important implementation note
The current Delivery model does not contain a contractual ETA field. The Phase 3 UI therefore labels on-time performance transparently as an operational proxy: delivery completed within 45 minutes of assignment. This should be replaced with the platform's actual ETA/SLA calculation once that field/rule exists.

## Financial integrity
Challenge and referral rewards create RiderBonus records and corresponding positive rider ledger adjustments, so they feed into the existing Phase 2 earnings view. They are not presented as completed bank transfers.

## Verification status
- Source files inspected after implementation.
- TypeScript/TSX parser diagnostics: passed for edited Phase 3 service/controller/module/page files.
- Full NestJS build, Next.js build, Prisma client regeneration, migration execution against PostgreSQL, and end-to-end runtime tests: **not verified in this environment** because the project dependency/tooling installation is incomplete here.
