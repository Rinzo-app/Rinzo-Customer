import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { generateOtp, verifyOtp, createToken, authMiddleware, type AuthRequest } from "./auth";
import * as storage from "./storage";
import { insertOrderSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  await storage.seedData();

  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone || typeof phone !== "string") {
        return res.status(400).json({ error: "Phone number is required" });
      }
      generateOtp(phone);
      res.json({ success: true, message: "OTP sent" });
    } catch (err) {
      console.error("Send OTP error:", err);
      res.status(500).json({ error: "Failed to send OTP" });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { phone, otp } = req.body;
      if (!phone || !otp) {
        return res.status(400).json({ error: "Phone and OTP are required" });
      }
      if (!verifyOtp(phone, otp)) {
        return res.status(401).json({ error: "Invalid or expired OTP" });
      }
      const customer = await storage.getOrCreateCustomer(phone);
      const token = createToken(customer.id, phone);
      res.json({ token, customer });
    } catch (err) {
      console.error("Verify OTP error:", err);
      res.status(500).json({ error: "Verification failed" });
    }
  });

  app.get("/api/me", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const customer = await storage.getCustomer(req.customerId!);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      res.json(customer);
    } catch (err) {
      console.error("Get me error:", err);
      res.status(500).json({ error: "Failed to get profile" });
    }
  });

  app.put("/api/me", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: "Name is required" });
      const customer = await storage.updateCustomerName(req.customerId!, name);
      res.json(customer);
    } catch (err) {
      console.error("Update me error:", err);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.get("/api/addresses", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const addrs = await storage.getAddresses(req.customerId!);
      res.json(addrs);
    } catch (err) {
      console.error("Get addresses error:", err);
      res.status(500).json({ error: "Failed to get addresses" });
    }
  });

  app.post("/api/addresses", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { label, addressLine, lat, lng, isDefault } = req.body;
      if (!label || !addressLine || lat === undefined || lng === undefined) {
        return res.status(400).json({ error: "All address fields required" });
      }
      const addr = await storage.createAddress({
        customerId: req.customerId!, label, addressLine, lat, lng, isDefault,
      });
      res.json(addr);
    } catch (err) {
      console.error("Create address error:", err);
      res.status(500).json({ error: "Failed to create address" });
    }
  });

  app.delete("/api/addresses/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.deleteAddress(req.params.id, req.customerId!);
      res.json({ success: true });
    } catch (err) {
      console.error("Delete address error:", err);
      res.status(500).json({ error: "Failed to delete address" });
    }
  });

  app.put("/api/addresses/:id/default", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.setDefaultAddress(req.params.id, req.customerId!);
      res.json({ success: true });
    } catch (err) {
      console.error("Set default address error:", err);
      res.status(500).json({ error: "Failed to set default" });
    }
  });

  app.get("/api/shops", async (_req, res) => {
    try {
      const allShops = await storage.getAllShops();
      res.json(allShops);
    } catch (err) {
      console.error("Get shops error:", err);
      res.status(500).json({ error: "Failed to get shops" });
    }
  });

  app.get("/api/shops/:id", async (req, res) => {
    try {
      const shop = await storage.getShop(req.params.id);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      res.json(shop);
    } catch (err) {
      console.error("Get shop error:", err);
      res.status(500).json({ error: "Failed to get shop" });
    }
  });

  app.get("/api/shops/:id/services", async (req, res) => {
    try {
      const svc = await storage.getShopServices(req.params.id);
      res.json(svc);
    } catch (err) {
      console.error("Get services error:", err);
      res.status(500).json({ error: "Failed to get services" });
    }
  });

  app.post("/api/orders", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const parsed = insertOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid order data", details: parsed.error.errors });
      }
      const { shopId, addressId, pickupDate, pickupSlot, items, note } = parsed.data;
      const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const order = await storage.createOrder({
        customerId: req.customerId!, shopId, addressId, pickupDate, pickupSlot, total, items, note,
      });
      res.json(order);
    } catch (err) {
      console.error("Create order error:", err);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  app.get("/api/orders", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const orderList = await storage.getCustomerOrders(req.customerId!);
      res.json(orderList);
    } catch (err) {
      console.error("Get orders error:", err);
      res.status(500).json({ error: "Failed to get orders" });
    }
  });

  app.get("/api/orders/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const order = await storage.getOrder(req.params.id, req.customerId!);
      if (!order) return res.status(404).json({ error: "Order not found" });
      res.json(order);
    } catch (err) {
      console.error("Get order error:", err);
      res.status(500).json({ error: "Failed to get order" });
    }
  });

  app.get("/api/favorites", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const favs = await storage.getFavorites(req.customerId!);
      res.json(favs);
    } catch (err) {
      console.error("Get favorites error:", err);
      res.status(500).json({ error: "Failed to get favorites" });
    }
  });

  app.get("/api/favorites/:shopId/check", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const isFav = await storage.isFavorite(req.customerId!, req.params.shopId);
      res.json({ isFavorite: isFav });
    } catch (err) {
      console.error("Check favorite error:", err);
      res.status(500).json({ error: "Failed to check favorite" });
    }
  });

  app.post("/api/favorites/:shopId/toggle", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const isFav = await storage.toggleFavorite(req.customerId!, req.params.shopId);
      res.json({ isFavorite: isFav });
    } catch (err) {
      console.error("Toggle favorite error:", err);
      res.status(500).json({ error: "Failed to toggle favorite" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
