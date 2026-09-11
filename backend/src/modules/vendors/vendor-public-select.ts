import { Prisma } from '@prisma/client';

// SECURITY: found during the Phase 11 pass — every public/customer-facing
// endpoint that embedded a Vendor via `include: { vendor: true }` (or
// queried Vendor directly with `include`) was returning ALL of Vendor's
// scalar fields, including `commissionRate` (the platform's cut, which
// should never be publicly readable — a competitor or vendor could just
// read it straight off the product/order JSON) and `ownerUserId` (an
// internal FK with no reason to be public). This constant is the one place
// that defines what's actually safe to show a customer or the public, and
// every customer-facing query should use it instead of `vendor: true`.
//
// Contexts that legitimately need the FULL vendor row (the vendor's own
// `/vendor/me`, and admin endpoints) should keep using `include: { ... }`
// or an explicit wider `select` — this constant is specifically for
// anything a customer or anonymous visitor can see.
export const PUBLIC_VENDOR_SELECT = {
  id: true,
  storeName: true,
  logoUrl: true,
  coverImageUrl: true,
  description: true,
  phone: true,
  email: true,
  status: true,
  isOpen: true,
  operatingHoursStart: true,
  operatingHoursEnd: true,
  supportedDeliveryModels: true,
  createdAt: true,
  vendorType: true,
} satisfies Prisma.VendorSelect;
