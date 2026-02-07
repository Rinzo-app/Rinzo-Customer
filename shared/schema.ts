import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  doublePrecision,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const customers = pgTable("customers", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const addresses = pgTable("addresses", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id", { length: 64 }).notNull().references(() => customers.id),
  label: varchar("label", { length: 50 }).notNull(),
  addressLine: text("address_line").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
});

export const shops = pgTable("shops", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  address: text("address").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  rating: doublePrecision("rating").default(4.0),
  totalRatings: integer("total_ratings").default(0),
  imageUrl: text("image_url"),
  openTime: varchar("open_time", { length: 10 }).default("08:00"),
  closeTime: varchar("close_time", { length: 10 }).default("20:00"),
  isActive: boolean("is_active").default(true).notNull(),
  minOrder: integer("min_order").default(100),
  deliveryFee: integer("delivery_fee").default(0),
});

export const services = pgTable("services", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  shopId: varchar("shop_id", { length: 64 }).notNull().references(() => shops.id),
  name: varchar("name", { length: 200 }).notNull(),
  price: integer("price").notNull(),
  unit: varchar("unit", { length: 30 }).notNull().default("per piece"),
  category: varchar("category", { length: 50 }).notNull().default("wash"),
});

export const orders = pgTable("orders", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id", { length: 64 }).notNull().references(() => customers.id),
  shopId: varchar("shop_id", { length: 64 }).notNull().references(() => shops.id),
  addressId: varchar("address_id", { length: 64 }).references(() => addresses.id),
  status: varchar("status", { length: 30 }).notNull().default("placed"),
  pickupDate: varchar("pickup_date", { length: 20 }).notNull(),
  pickupSlot: varchar("pickup_slot", { length: 30 }).notNull(),
  total: integer("total").notNull(),
  paymentMethod: varchar("payment_method", { length: 20 }).notNull().default("cod"),
  items: jsonb("items").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const favorites = pgTable("favorites", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id", { length: 64 }).notNull().references(() => customers.id),
  shopId: varchar("shop_id", { length: 64 }).notNull().references(() => shops.id),
});

export const insertCustomerSchema = createInsertSchema(customers).pick({ phone: true, name: true });
export const insertAddressSchema = createInsertSchema(addresses).pick({
  customerId: true, label: true, addressLine: true, lat: true, lng: true, isDefault: true,
});
export const insertOrderSchema = z.object({
  shopId: z.string(),
  addressId: z.string().optional(),
  pickupDate: z.string(),
  pickupSlot: z.string(),
  items: z.array(z.object({
    serviceId: z.string(),
    name: z.string(),
    quantity: z.number().min(1),
    price: z.number(),
  })),
  note: z.string().optional(),
});

export type Customer = typeof customers.$inferSelect;
export type Address = typeof addresses.$inferSelect;
export type Shop = typeof shops.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type InsertAddress = z.infer<typeof insertAddressSchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
