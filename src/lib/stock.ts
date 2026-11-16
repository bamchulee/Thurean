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
  // 1. ถ้า IS_ACTIVE เป็น 0 (หรือปิดการขาย) -> ถือว่าหมดสต็อกทันที ไม่สนว่าในสต็อกมีกี่ลูก
  const isActive = p.isActive !== 0 && (p.isActive as any) !== "0" && p.isActive !== false;
  if (!isActive || p.isAvailable === false) {
    return { summary: "หมดสต็อก (ปิดการขาย)", approxUnits: 0, isLowStock: false, isOutOfStock: true };
  }

  // 2. ถ้า IS_ACTIVE เป็น 1 ค่อยเริ่มนับจริง:
  // ต้องมี 1 ลูกขึ้นไป (stockQty >= 1) ถึงจะขึ้นว่ามี ถ้า 0 ลูกแสดงว่าหมดเหมือนกัน
  if (typeof p.stockQty === "number") {
    if (p.stockQty < 1) {
      return { summary: "หมดสต็อกรอบนี้ (0 ลูก)", approxUnits: 0, isLowStock: false, isOutOfStock: true };
    }
    const unitName = p.unit || "ลูก";
    return {
      summary: `เหลือ ${p.stockQty} ${unitName}${typeof p.stockKg === "number" && p.stockKg > 0 ? ` (${p.stockKg} กก.)` : ""}`,
      approxUnits: p.stockQty,
      isLowStock: p.stockQty <= 2,
      isOutOfStock: false,
    };
  }

  if (p.stockUnit === "qty" || p.type === "flesh") {
    const qty = typeof p.stockKg === "number" ? Math.round(p.stockKg) : undefined;
    if (qty !== undefined) {
      if (qty < 1) return { summary: "หมดสต็อกรอบนี้ (0 กล่อง)", approxUnits: 0, isLowStock: false, isOutOfStock: true };
      return {
        summary: `เหลือ ${qty} ${p.unit || "กล่อง"}`,
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
        ? `เหลือ ${kgStr} กก. (~${approx} ${p.unit || "ลูก"})`
        : `เหลือ ${kgStr} กก. (ชั่งน้ำหนักจริง)`,
      approxUnits: approx,
      isLowStock: p.stockKg <= 10,
      isOutOfStock: false,
    };
  }

  return { summary: "เปิดรับจองตามรอบ", isLowStock: false, isOutOfStock: false };
}

/**
 * จำนวนที่ยังสั่งได้ (หน่วยขาย) — undefined = สินค้านี้ไม่ได้นับสต็อก
 * ต้องตรงกับ planStockDeduction ใน google-apps-script/4_Orders.gs
 */
export function getAvailableUnits(p: Product): number | undefined {
  const isActive = p.isActive !== 0 && (p.isActive as any) !== "0" && p.isActive !== false;
  if (!isActive || p.isAvailable === false) return 0;

  if (typeof p.stockQty === "number") {
    return p.stockQty >= 1 ? p.stockQty : 0;
  }

  const isQtyBased = p.stockUnit === "qty" || p.type === "flesh";
  if (typeof p.stockKg === "number") {
    if (p.stockKg <= 0) return 0;
    const avg = p.avgWeightKg && p.avgWeightKg > 0 ? p.avgWeightKg : isQtyBased ? 1 : 3;
    return Math.max(0, Math.floor(p.stockKg / avg));
  }
  return undefined;
}

/**
 * ร้านขายตามน้ำหนักจริงแบบหน้าร้าน: แสดง/เก็บเฉพาะราคาต่อกิโล ไม่มีราคาต่อลูกหรือยอดประเมิน
 * (ชั้นข้อมูลตั้ง product.price = ราคาต่อกิโลอยู่แล้ว — ดู applyDatabaseJoins)
 */
export function pricePerKgOf(p: Pick<Product, "price" | "pricePerKg">): number {
  return Number(p.pricePerKg) || Number(p.price) || 0;
}

/** คืนสต็อกเมื่อออเดอร์ถูกยกเลิก (ต้องตรงกับ restoreStock ใน google-apps-script/4_Orders.gs) */
export function restoreProductStock(product: Product, orderedQty: number): void {
  const qty = Math.max(1, orderedQty);
  const isQtyBased = product.stockUnit === "qty" || product.type === "flesh";
  let wasSoldOut = false;
  if (typeof product.stockQty === "number") {
    wasSoldOut = product.stockQty <= 0;
    product.stockQty += qty;
  }
  if (typeof product.stockKg === "number") {
    if (typeof product.stockQty !== "number") wasSoldOut = product.stockKg <= 0;
    const unitKg = product.avgWeightKg && product.avgWeightKg > 0 ? product.avgWeightKg : isQtyBased ? 1 : 3;
    product.stockKg = Number((product.stockKg + qty * unitKg).toFixed(1));
  }
  if (wasSoldOut) product.isAvailable = true;
}

export function deductProductStock(product: Product, orderedQty: number): void {
  const qty = Math.max(1, orderedQty);
  if (typeof product.stockQty === "number") {
    product.stockQty = Math.max(0, product.stockQty - qty);
    if (product.stockQty <= 0) product.isAvailable = false;
  }
  if (typeof product.stockKg === "number") {
    const unitKg = product.avgWeightKg && product.avgWeightKg > 0 ? product.avgWeightKg : 3;
    product.stockKg = Math.max(0, Number((product.stockKg - qty * unitKg).toFixed(1)));
    if (product.stockKg <= 0 && (product.stockQty === undefined || product.stockQty <= 0)) {
      product.isAvailable = false;
    }
  }
}
