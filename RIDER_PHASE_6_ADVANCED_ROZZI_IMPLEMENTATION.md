# ROZZI Rider Dashboard — Phase 6 Advanced ROZZI

Implemented cumulatively on the Rider dashboard after Phases 1–5.

## Scope completed
1. Smart order recommendations — current rider offers are scored using pickup distance, delivery fee, order size and rider profile; reasons are shown to the rider.
2. Earnings predictions — 28-day rider ledger history produces daily/weekly/monthly estimates with an explicit confidence indicator and methodology note.
3. Demand prediction — recent 24-hour order volume is grouped by the rider's assigned service areas and presented as demand signals.
4. Rider/vehicle financing — eligibility and application intake for motorcycle, phone, equipment and earnings-advance products; no loan disbursement is represented as live.
5. Advanced analytics — earnings, completed deliveries, efficiency metrics, rating and a daily trend view; distance is transparently marked as an estimate because trip-distance history is not currently persisted.
6. Loyalty/rewards — persistent RiderLoyalty points/tier and RiderLoyaltyEvent history, surfaced in a dedicated Rewards page.
7. Personalized rider dashboard — `/advanced` combines recommendations, forecast, demand, rewards and financing status into a single decision-oriented workspace.

## Backend
- `backend/src/modules/riders/rider-advanced.service.ts`
- Rider controller Phase 6 routes under `/api/rider/advanced/*`
- Prisma models: `RiderFinanceApplication`, `RiderLoyalty`, `RiderLoyaltyEvent`
- Migration: `20260902270000_rider_phase6_advanced`

## Frontend
- `/advanced`
- `/advanced/recommendations`
- `/advanced/predictions`
- `/advanced/demand`
- `/advanced/analytics`
- `/advanced/financing`
- `/advanced/rewards`

## Important implementation boundaries
- Recommendations are explainable rules, not an ML model.
- Demand is recent order-volume signaling, not predictive AI.
- Earnings forecast is a historical estimate, not guaranteed income.
- Financing is eligibility/intake only. Actual lending requires an approved financial partner, underwriting, disclosures and applicable Nigerian legal/compliance review.
- Advanced analytics uses estimated distance because the current schema does not retain trip-distance history.
- Loyalty points are persistent but the current package does not yet attach automatic points to every completed delivery; the reward ledger foundation is ready for event-driven accrual.

## Verification
Static/source structure checks were performed. A full dependency-backed TypeScript/Prisma build could not be claimed in this environment because the existing project dependencies/type definitions are incomplete here. Run `npm install`, Prisma generate/deploy, then backend/frontend builds and live API/browser tests in the local ROZZI environment.
