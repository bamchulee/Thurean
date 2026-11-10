"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "../types/durian";

export interface CartItem {
  key: string; // `${product.id}__${ripenessPref}`
  product: Product;
  qty: number;
  ripenessPref: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, qty?: number, ripenessPref?: string) => void;
  removeItem: (key: string) => void;
  updateQty: (key: string, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const STORAGE_KEY = "winkin_durian_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {
      // Ignore storage error
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage error
    }
  }, [items]);

  const addItem = useCallback(
    (
      product: Product,
      qty = 1,
      ripenessPref = "กรอบนอกนุ่มใน (ไก่ฉีก)"
    ) => {
      const key = `${product.id}__${ripenessPref}`;
      setItems((prev) => {
        const existing = prev.find((i) => i.key === key);
        if (existing) {
          return prev.map((i) =>
            i.key === key ? { ...i, qty: i.qty + qty } : i
          );
        }
        return [...prev, { key, product, qty, ripenessPref }];
      });
    },
    []
  );

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const updateQty = useCallback((key: string, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.key !== key));
    } else {
      setItems((prev) =>
        prev.map((i) => (i.key === key ? { ...i, qty } : i))
      );
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((s, i) => s + i.qty, 0);
  const totalPrice = items.reduce((s, i) => s + i.product.price * i.qty, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
}
