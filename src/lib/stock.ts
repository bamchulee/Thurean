// ============================================================
// Weight-Based ("กิโลกรัม") & Unit Stock Display / Deduction
// ============================================================
import type { Product } from "../types/durian";

export function formatProductStock(p: Product): {
  summary: string;
  approxUnits?: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
} {
  if (!p.isAvailable) {
    return { summary: "สินค้าหมดชั่วคราว", isLowStock: false, isOutOfStock: true };
  }

  if (p.stockUnit === "qty" || p.type === "flesh") {
    const qty = typeof p.stockQty === "number" ? p.stockQty : typeof p.stockKg === "number" ? Math.round(p.stockKg) : undefined;
    if (qty !== undefined) {
      if (qty <= 0) return { summary: "หมดสต็อกรอบนี้", approxUnits: 0, isLowStock: false, isOutOfStock: true };
      return {
        summary: `เหลือ ${qty} ${p.unit}${typeof p.stockKg === "number" && p.stockKg !== qty ? ` (${p.stockKg.toFixed(1)} กก.)` : ""}`,
        approxUnits: qty,
        isLowStock: qty <= 5,
        isOutOfStock: false,
      };
    }
  }

  if (typeof p.stockKg === "number") {
    if (p.stockKg <= 0) {
      return { summary: "หมดสต็อกรอบนี้ (0 กก.)", approxUnits: 0, isLowStock: false, isOutOfStock: true };
    }
    const kgStr = Number.isInteger(p.stockKg) ? String(p.stockKg) : p.stockKg.toFixed(1);
    const avg = p.avgWeightKg && p.avgWeightKg > 0 ? p.avgWeightKg : undefined;
    const approx = avg ? Math.max(1, Math.floor(p.stockKg / avg)) : undefined;
    return {
      summary: approx
        ? `เหลือ ${kgStr} กก. (~${approx} ${p.unit})`
        : `เหลือ ${kgStr} กก. (ชั่งน้ำหนักจริง)`,
      approxUnits: approx,
      isLowStock: p.stockKg <= 10,
      isOutOfStock: false,
    };
  }

  return { summary: "เปิดรับจองตามรอบ", isLowStock: false, isOutOfStock: false };
}

export function deductProductStock(product: Product, orderedQty: number): void {
  const qty = Math.max(1, orderedQty);
  if (product.stockUnit === "qty" || product.type === "flesh") {
    if (typeof product.stockQty === "number") {
      product.stockQty = Math.max(0, product.stockQty - qty);
      if (product.stockQty <= 0) product.isAvailable = false;
    }
    if (typeof product.stockKg === "number") {
      const unitKg = product.avgWeightKg && product.avgWeightKg > 0 ? product.avgWeightKg : 1;
      product.stockKg = Math.max(0, Number((product.stockKg - qty * unitKg).toFixed(1)));
      if (product.stockKg <= 0) product.isAvailable = false;
    }
    return;
  }

  if (typeof product.stockKg === "number") {
    const avgKg = product.avgWeightKg && product.avgWeightKg > 0 ? product.avgWeightKg : 3;
    product.stockKg = Math.max(0, Number((product.stockKg - qty * avgKg).toFixed(1)));
    if (product.stockKg <= 0) product.isAvailable = false;
  }
}
