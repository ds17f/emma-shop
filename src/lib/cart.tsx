"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type CartItem = {
  variantId: string;
  productSlug: string;
  name: string; // "Product — Variant"
  priceCents: number;
  imageUrl: string | null;
  quantity: number;
  maxStock: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "emma-shop-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // One-time hydration from localStorage after mount (avoids SSR hydration
      // mismatch); intentional setState in effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignore malformed storage
    }
    setLoaded(true);
  }, []);

  // Persist on change (after initial load).
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, loaded]);

  function clampQty(qty: number, max: number) {
    return Math.max(1, Math.min(qty, Math.max(1, max)));
  }

  const value: CartContextValue = {
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    subtotalCents: items.reduce((n, i) => n + i.priceCents * i.quantity, 0),
    addItem: (item, quantity = 1) =>
      setItems((prev) => {
        const existing = prev.find((i) => i.variantId === item.variantId);
        if (existing) {
          return prev.map((i) =>
            i.variantId === item.variantId
              ? { ...i, quantity: clampQty(i.quantity + quantity, item.maxStock) }
              : i,
          );
        }
        return [...prev, { ...item, quantity: clampQty(quantity, item.maxStock) }];
      }),
    setQuantity: (variantId, quantity) =>
      setItems((prev) =>
        prev.map((i) =>
          i.variantId === variantId
            ? { ...i, quantity: clampQty(quantity, i.maxStock) }
            : i,
        ),
      ),
    removeItem: (variantId) =>
      setItems((prev) => prev.filter((i) => i.variantId !== variantId)),
    clear: () => setItems([]),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
