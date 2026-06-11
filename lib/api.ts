import { request, ApiError } from "./http-client";

// Re-export so existing consumers don't break
export { ApiError } from "./http-client";

// ── Shop API ─────────────────────────────────────────────

/** GET /api/shops — list approved shops */
export async function fetchShops(): Promise<any[]> {
  const res = await request<{ data: any[] }>("GET", "/api/shops?limit=100");
  return res.data;
}

// ── Backend → UI status mapping ──────────────────────────
const STATUS_MAP: Record<string, string> = {
  PLACED: "placed",
  SHOP_ACCEPTED: "confirmed",
  PICKUP_OFFERED: "confirmed",
  PICKUP_ASSIGNED: "picked_up",
  PICKED_UP_FROM_CUSTOMER: "picked_up",
  AT_SHOP: "washing",
  READY: "ready",
  OUT_FOR_DELIVERY: "ready",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  REJECTED_BY_SHOP: "cancelled",
};

function mapStatus(status: string): string {
  return STATUS_MAP[status] || status.toLowerCase();
}

/** Transform a backend order row into the shape the UI expects. */
function mapOrder(raw: any): any {
  const created = new Date(raw.createdAt);
  return {
    ...raw,
    status: mapStatus(raw.status),
    total: raw.totalAmount,
    shopName: raw.shopName || "Laundry Shop",
    items: Array.isArray(raw.items)
      ? raw.items.map((i: any) => ({
          ...i,
          name: i.serviceName || i.name,
        }))
      : [],
    pickupDate: created.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    }),
    pickupSlot: "",
  };
}

// ── Order API ────────────────────────────────────────────

/** GET /api/customer/orders — list the authenticated customer's orders */
export async function fetchCustomerOrders(): Promise<any[]> {
  const res = await request<{ data: any[] }>("GET", "/api/customer/orders?limit=100");
  return res.data.map(mapOrder);
}

/** GET /api/orders/:id — fetch a single order with items */
export async function fetchOrder(id: string): Promise<any> {
  const data = await request("GET", `/api/orders/${id}`);
  return mapOrder(data);
}

/** POST /api/orders — place a new order */
export async function placeOrder(payload: {
  shopId: string;
  items: { serviceId: string; quantity: number }[];
  pickupAddress: string;
  deliveryAddress: string;
  pickupDate?: string;
  pickupSlot?: string;
  /** One key per checkout attempt — backend dedupes double-submissions */
  idempotencyKey?: string;
  /** Customer GPS — drives delivery fee + rider proximity */
  pickupLat?: number;
  pickupLng?: number;
}): Promise<any> {
  const data = await request("POST", "/api/orders", payload);
  // createOrder returns { order, items }
  return mapOrder(data.order || data);
}

/** POST /api/orders/:id/cancel — cancel an order in PLACED status */
export async function cancelOrder(orderId: string): Promise<any> {
  const data = await request("POST", `/api/orders/${orderId}/cancel`);
  return mapOrder(data);
}

// ── Dispute API ──────────────────────────────────────────

export const DISPUTE_CATEGORIES = [
  "Payment Issue",
  "Late Delivery",
  "Wrong Items",
  "Order Damaged",
  "Missing Items",
  "Customer No-show",
  "Wrong Order Info",
  "Rider Issue",
  "App Issue",
  "Other",
];

/** POST /api/disputes — raise a dispute against an order */
export async function createDispute(payload: {
  orderId: string;
  category: string;
  description: string;
}): Promise<any> {
  return request("POST", "/api/disputes", payload);
}

// ── Dispute listing ─────────────────────────────────────

export interface Dispute {
  id: string;
  orderId: string | null;
  category: string;
  description: string;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "CLOSED";
  resolution?: string;
  createdAt: string;
  updatedAt: string | null;
}

/** GET /api/disputes — list the authenticated user's disputes */
export async function fetchMyDisputes(): Promise<Dispute[]> {
  return request<Dispute[]>("GET", "/api/disputes");
}
