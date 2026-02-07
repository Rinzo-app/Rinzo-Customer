import { eq, and, sql } from "drizzle-orm";
import { db } from "./db";
import {
  customers, addresses, shops, services, orders, favorites,
  type Customer, type Address, type Shop, type Service, type Order, type Favorite,
} from "@shared/schema";

export async function getOrCreateCustomer(phone: string, name?: string): Promise<Customer> {
  const existing = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
  if (existing.length > 0) return existing[0];
  const result = await db.insert(customers).values({ phone, name }).returning();
  return result[0];
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result[0];
}

export async function updateCustomerName(id: string, name: string): Promise<Customer> {
  const result = await db.update(customers).set({ name }).where(eq(customers.id, id)).returning();
  return result[0];
}

export async function getAddresses(customerId: string): Promise<Address[]> {
  return db.select().from(addresses).where(eq(addresses.customerId, customerId));
}

export async function createAddress(data: {
  customerId: string; label: string; addressLine: string; lat: number; lng: number; isDefault?: boolean;
}): Promise<Address> {
  if (data.isDefault) {
    await db.update(addresses).set({ isDefault: false }).where(eq(addresses.customerId, data.customerId));
  }
  const result = await db.insert(addresses).values({
    customerId: data.customerId,
    label: data.label,
    addressLine: data.addressLine,
    lat: data.lat,
    lng: data.lng,
    isDefault: data.isDefault ?? false,
  }).returning();
  return result[0];
}

export async function deleteAddress(id: string, customerId: string): Promise<void> {
  await db.delete(addresses).where(and(eq(addresses.id, id), eq(addresses.customerId, customerId)));
}

export async function setDefaultAddress(id: string, customerId: string): Promise<void> {
  await db.update(addresses).set({ isDefault: false }).where(eq(addresses.customerId, customerId));
  await db.update(addresses).set({ isDefault: true }).where(and(eq(addresses.id, id), eq(addresses.customerId, customerId)));
}

export async function getAllShops(): Promise<Shop[]> {
  return db.select().from(shops).where(eq(shops.isActive, true));
}

export async function getShop(id: string): Promise<Shop | undefined> {
  const result = await db.select().from(shops).where(eq(shops.id, id)).limit(1);
  return result[0];
}

export async function getShopServices(shopId: string): Promise<Service[]> {
  return db.select().from(services).where(eq(services.shopId, shopId));
}

export async function createOrder(data: {
  customerId: string; shopId: string; addressId?: string; pickupDate: string; pickupSlot: string;
  total: number; items: any; note?: string;
}): Promise<Order> {
  const result = await db.insert(orders).values({
    customerId: data.customerId,
    shopId: data.shopId,
    addressId: data.addressId || null,
    pickupDate: data.pickupDate,
    pickupSlot: data.pickupSlot,
    total: data.total,
    items: data.items,
    note: data.note || null,
    status: "placed",
    paymentMethod: "cod",
  }).returning();
  return result[0];
}

export async function getCustomerOrders(customerId: string): Promise<(Order & { shopName: string })[]> {
  const result = await db
    .select({
      id: orders.id,
      customerId: orders.customerId,
      shopId: orders.shopId,
      addressId: orders.addressId,
      status: orders.status,
      pickupDate: orders.pickupDate,
      pickupSlot: orders.pickupSlot,
      total: orders.total,
      paymentMethod: orders.paymentMethod,
      items: orders.items,
      note: orders.note,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      shopName: shops.name,
    })
    .from(orders)
    .leftJoin(shops, eq(orders.shopId, shops.id))
    .where(eq(orders.customerId, customerId))
    .orderBy(sql`${orders.createdAt} DESC`);
  return result.map(r => ({ ...r, shopName: r.shopName || "Unknown Shop" }));
}

export async function getOrder(id: string, customerId: string): Promise<(Order & { shopName: string }) | undefined> {
  const result = await db
    .select({
      id: orders.id,
      customerId: orders.customerId,
      shopId: orders.shopId,
      addressId: orders.addressId,
      status: orders.status,
      pickupDate: orders.pickupDate,
      pickupSlot: orders.pickupSlot,
      total: orders.total,
      paymentMethod: orders.paymentMethod,
      items: orders.items,
      note: orders.note,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      shopName: shops.name,
    })
    .from(orders)
    .leftJoin(shops, eq(orders.shopId, shops.id))
    .where(and(eq(orders.id, id), eq(orders.customerId, customerId)))
    .limit(1);
  if (result.length === 0) return undefined;
  return { ...result[0], shopName: result[0].shopName || "Unknown Shop" };
}

export async function getFavorites(customerId: string): Promise<(Favorite & { shop: Shop })[]> {
  const result = await db
    .select()
    .from(favorites)
    .leftJoin(shops, eq(favorites.shopId, shops.id))
    .where(eq(favorites.customerId, customerId));
  return result
    .filter(r => r.shops !== null)
    .map(r => ({ ...r.favorites, shop: r.shops! }));
}

export async function isFavorite(customerId: string, shopId: string): Promise<boolean> {
  const result = await db.select().from(favorites)
    .where(and(eq(favorites.customerId, customerId), eq(favorites.shopId, shopId))).limit(1);
  return result.length > 0;
}

export async function toggleFavorite(customerId: string, shopId: string): Promise<boolean> {
  const existing = await db.select().from(favorites)
    .where(and(eq(favorites.customerId, customerId), eq(favorites.shopId, shopId))).limit(1);
  if (existing.length > 0) {
    await db.delete(favorites).where(eq(favorites.id, existing[0].id));
    return false;
  }
  await db.insert(favorites).values({ customerId, shopId });
  return true;
}

export async function seedData(): Promise<void> {
  const existingShops = await db.select().from(shops).limit(1);
  if (existingShops.length > 0) return;

  const shopData = [
    { name: "Fresh & Clean Laundry", phone: "+919876543210", address: "12, MG Road, Connaught Place, New Delhi", lat: 28.6315, lng: 77.2167, rating: 4.5, totalRatings: 234, openTime: "07:00", closeTime: "21:00", minOrder: 150, deliveryFee: 0 },
    { name: "Sparkle Wash", phone: "+919876543211", address: "45, Nehru Nagar, Lajpat Nagar, New Delhi", lat: 28.5700, lng: 77.2400, rating: 4.2, totalRatings: 156, openTime: "08:00", closeTime: "20:00", minOrder: 100, deliveryFee: 30 },
    { name: "Royal Dryclean", phone: "+919876543212", address: "78, Rajouri Garden Main Market, New Delhi", lat: 28.6469, lng: 77.1210, rating: 4.7, totalRatings: 412, openTime: "09:00", closeTime: "21:00", minOrder: 200, deliveryFee: 0 },
    { name: "QuickWash Express", phone: "+919876543213", address: "23, Saket District Centre, New Delhi", lat: 28.5244, lng: 77.2090, rating: 4.0, totalRatings: 89, openTime: "06:00", closeTime: "22:00", minOrder: 80, deliveryFee: 25 },
    { name: "Pristine Laundry Hub", phone: "+919876543214", address: "56, Dwarka Sector 12 Market, New Delhi", lat: 28.5921, lng: 77.0369, rating: 4.3, totalRatings: 198, openTime: "08:00", closeTime: "20:00", minOrder: 120, deliveryFee: 0 },
    { name: "Urban Laundromat", phone: "+919876543215", address: "34, Hauz Khas Village, New Delhi", lat: 28.5494, lng: 77.2001, rating: 4.6, totalRatings: 321, openTime: "07:30", closeTime: "21:30", minOrder: 150, deliveryFee: 0 },
  ];

  const insertedShops = await db.insert(shops).values(shopData).returning();

  const serviceTemplates = [
    { name: "Wash & Fold", price: 60, unit: "per kg", category: "wash" },
    { name: "Wash & Iron", price: 80, unit: "per kg", category: "wash" },
    { name: "Dry Clean - Shirt", price: 120, unit: "per piece", category: "dryclean" },
    { name: "Dry Clean - Suit", price: 350, unit: "per piece", category: "dryclean" },
    { name: "Dry Clean - Saree", price: 250, unit: "per piece", category: "dryclean" },
    { name: "Steam Iron", price: 15, unit: "per piece", category: "iron" },
    { name: "Iron - Shirt", price: 12, unit: "per piece", category: "iron" },
    { name: "Iron - Trouser", price: 15, unit: "per piece", category: "iron" },
    { name: "Blanket Wash", price: 200, unit: "per piece", category: "special" },
    { name: "Curtain Wash", price: 150, unit: "per piece", category: "special" },
    { name: "Shoe Cleaning", price: 180, unit: "per pair", category: "special" },
  ];

  for (const shop of insertedShops) {
    const priceVariation = () => Math.floor(Math.random() * 20) - 10;
    const shopServices = serviceTemplates.map(s => ({
      shopId: shop.id,
      name: s.name,
      price: Math.max(10, s.price + priceVariation()),
      unit: s.unit,
      category: s.category,
    }));
    await db.insert(services).values(shopServices);
  }

  console.log("Seed data created successfully");
}
