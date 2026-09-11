// Deliberately minimal — just what the admin UI actually renders. The
// backend (Prisma) schema is the source of truth; these are hand-kept in
// sync rather than generated, since there's no shared-types package wired
// up between backend and frontend apps yet (a good Phase 11/12 cleanup:
// generate these from the Prisma schema or an OpenAPI spec instead).

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PENDING_VENDOR'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'RIDER_SEARCHING'
  | 'RIDER_ASSIGNED'
  | 'RIDER_ARRIVED_PICKUP'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'RIDER_ARRIVED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED'
  | 'REFUNDED';

export type VendorStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'CLOSED';
export type RiderStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED';
export type ServiceAreaStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'INACTIVE';
export type LocationType = 'COUNTRY' | 'STATE' | 'CITY' | 'UNIVERSITY' | 'CAMPUS' | 'NEIGHBORHOOD';

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  vendor: { storeName: string };
  customer: { fullName: string; phone: string | null };
}

export interface VendorSummary {
  id: string;
  storeName: string;
  status: VendorStatus;
  email: string | null;
  phone: string | null;
  vendorType: { name: string };
  locations: { serviceArea: { name: string } }[];
  createdAt: string;
  updatedAt?: string;
  isOpen?: boolean;
  commissionRate?: number | string;
  supportedDeliveryModels?: string[];
}

export interface RiderSummary {
  id: string;
  status: RiderStatus;
  vehicleType: string;
  vehiclePlateNumber: string | null;
  owner: { fullName: string; phone: string | null; email: string | null };
  zones: { serviceArea: { name: string } }[];
  createdAt: string;
  updatedAt?: string;
  isOnline?: boolean;
  location?: { latitude: number | string; longitude: number | string; updatedAt: string } | null;
  documents?: { id: string; docType: string; verified: boolean }[];
}

export interface ServiceAreaSummary {
  id: string;
  name: string;
  status: ServiceAreaStatus;
  minimumOrderAmount: number;
  baseDeliveryFee: number;
  location: { name: string; type: LocationType };
  deliveryZones: { id: string; name: string }[];
}

export interface LocationNode {
  id: string;
  name: string;
  type: LocationType;
  isActive: boolean;
  children: LocationNode[];
}

export interface Category {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}
