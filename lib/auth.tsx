import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest, queryClient } from "./query-client";
import type { Customer } from "@shared/schema";

const TOKEN_KEY = "saaf_auth_token";
const CUSTOMER_KEY = "saaf_customer";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  customer: Customer | null;
  token: string | null;
  login: (phone: string, otp: string) => Promise<void>;
  sendOtp: (phone: string) => Promise<void>;
  logout: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      const storedCustomer = await AsyncStorage.getItem(CUSTOMER_KEY);
      if (storedToken && storedCustomer) {
        setToken(storedToken);
        setCustomer(JSON.parse(storedCustomer));
      }
    } catch (err) {
      console.error("Failed to load auth:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function sendOtp(phone: string) {
    await apiRequest("POST", "/api/auth/send-otp", { phone });
  }

  async function login(phone: string, otp: string) {
    const res = await apiRequest("POST", "/api/auth/verify-otp", { phone, otp });
    const data = await res.json();
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    await AsyncStorage.setItem(CUSTOMER_KEY, JSON.stringify(data.customer));
    setToken(data.token);
    setCustomer(data.customer);
  }

  async function logout() {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(CUSTOMER_KEY);
    setToken(null);
    setCustomer(null);
    queryClient.clear();
  }

  async function updateName(name: string) {
    const res = await apiRequest("PUT", "/api/me", { name });
    const updated = await res.json();
    setCustomer(updated);
    await AsyncStorage.setItem(CUSTOMER_KEY, JSON.stringify(updated));
  }

  const value = useMemo(
    () => ({
      isAuthenticated: !!token,
      isLoading,
      customer,
      token,
      login,
      sendOtp,
      logout,
      updateName,
    }),
    [isLoading, token, customer],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
