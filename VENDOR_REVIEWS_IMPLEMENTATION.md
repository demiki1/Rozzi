# ROZZI Vendor Dashboard — Reviews & Ratings

## Implemented
- Vendor-only review centre at `/reviews`.
- Overall/store rating and rated-order count.
- Product rating average and product rating counts.
- 5/4/3/2/1-star distribution with percentages.
- Response rate and unanswered-review count.
- Recent written reviews with customer name, date, product, and sub-ratings.
- Search, rating filter, product filter, and unanswered-review view.
- Vendor response flow with a 1,000-character limit.
- One response per review; response timestamp is stored.
- Vendor ownership checks prevent responding to another vendor's review.
- Audit log entry is written for vendor responses.
- No unnecessary customer phone/address information is exposed to the vendor review screen.

## API
- `GET /api/vendor/reviews/overview`
- `GET /api/vendor/reviews`
- `PATCH /api/vendor/reviews/:reviewId/response`

Existing public customer/product review endpoints remain available.

## Data migration
`backend/prisma/migrations/20260902170000_add_vendor_review_responses/migration.sql`

Adds `vendorResponse` and `vendorRespondedAt` to `Review` and indexes vendor review queries.

## Verification status
Static structure checks passed for the edited TS/TSX files. Full NestJS/Next build should still be run in the user's local ROZZI environment after dependencies/database are available.
