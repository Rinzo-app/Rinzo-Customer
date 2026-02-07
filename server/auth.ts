import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.SESSION_SECRET || "saaf-dev-secret-key";

const otpStore = new Map<string, { otp: string; expiresAt: number }>();

const TEST_PHONE = "+911234567890";
const TEST_OTP = "123456";

export function generateOtp(phone: string): string {
  if (phone === TEST_PHONE) {
    otpStore.set(phone, { otp: TEST_OTP, expiresAt: Date.now() + 5 * 60 * 1000 });
    return TEST_OTP;
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(phone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });
  return otp;
}

export function verifyOtp(phone: string, otp: string): boolean {
  const stored = otpStore.get(phone);
  if (!stored) return false;
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(phone);
    return false;
  }
  if (stored.otp !== otp) return false;
  otpStore.delete(phone);
  return true;
}

export function createToken(customerId: string, phone: string): string {
  return jwt.sign({ customerId, phone }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): { customerId: string; phone: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { customerId: string; phone: string };
  } catch {
    return null;
  }
}

export interface AuthRequest extends Request {
  customerId?: string;
  phone?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid token" });
  }

  req.customerId = payload.customerId;
  req.phone = payload.phone;
  next();
}
