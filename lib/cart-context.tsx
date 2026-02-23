import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@rinzo_cart";

interface CartState {
  shopId: string | null;
  items: Record<string, number>;
}

interface CartContextValue {
  cart: CartState;
  /** Add/remove items. If shopId differs from existing cart, clears old items first. */
  updateQty: (shopId: string, serviceId: string, delta: number) => void;
  clearCart: () => void;
  /** Returns array of { serviceId, quantity } for items with quantity > 0 */
  getCartItems: () => { serviceId: string; quantity: number }[];
  /** Total number of items in the cart */
  cartCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

const EMPTY_CART: CartState = { shopId: null, items: {} };

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartState>(EMPTY_CART);
  const [loaded, setLoaded] = useState(false);

  // ── Load from AsyncStorage on mount ────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as CartState;
          if (parsed && parsed.shopId && typeof parsed.items === "object") {
            setCart(parsed);
          }
        }
      } catch (e) {
        console.warn("Failed to load cart:", e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // ── Persist to AsyncStorage on every change ────────────
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cart)).catch((e) =>
      console.warn("Failed to save cart:", e),
    );
  }, [cart, loaded]);

  const updateQty = useCallback(
    (shopId: string, serviceId: string, delta: number) => {
      setCart((prev) => {
        // If shopId changed, clear old cart and start fresh
        const base: CartState =
          prev.shopId !== shopId
            ? { shopId, items: {} }
            : { ...prev };

        const current = base.items[serviceId] || 0;
        const next = Math.max(0, current + delta);

        const items = { ...base.items };
        if (next === 0) {
          delete items[serviceId];
        } else {
          items[serviceId] = next;
        }

        return { shopId, items };
      });
    },
    [],
  );

  const clearCart = useCallback(() => {
    setCart(EMPTY_CART);
  }, []);

  const getCartItems = useCallback(() => {
    return Object.entries(cart.items)
      .filter(([, qty]) => qty > 0)
      .map(([serviceId, quantity]) => ({ serviceId, quantity }));
  }, [cart.items]);

  const cartCount = useMemo(
    () => Object.values(cart.items).reduce((sum, qty) => sum + qty, 0),
    [cart.items],
  );

  const value = useMemo(
    () => ({ cart, updateQty, clearCart, getCartItems, cartCount }),
    [cart, updateQty, clearCart, getCartItems, cartCount],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
