// ── Plain TypeScript interfaces for the Customer mobile app ──
// Extracted from shared/schema.ts — only the types actually used by UI code.

export interface Shop {
  id: string;
  name: string;
  phone: string | null;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  totalRatings: number | null;
  imageUrl: string | null;
  openTime: string | null;
  closeTime: string | null;
  isActive: boolean;
  minOrder: number | null;
  deliveryFee: number | null;
  serviceRadiusKm: number | null;
}

export interface Service {
  id: string;
  shopId: string;
  name: string;
  price: number;
  unit: string;
  category: string;
}

export interface Address {
  id: string;
  customerId: string;
  label: string;
  addressLine: string;
  lat: number;
  lng: number;
  isDefault: boolean;
}
