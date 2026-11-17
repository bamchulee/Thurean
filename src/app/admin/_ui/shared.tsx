"use client";

// ตัวช่วยที่หลายหน้าหลังบ้านใช้: ป้ายสถานะ, น้ำหนักรวม, วันที่
import { ORDER_STATUS_META, normalizePaymentStatus, orderStatusOf, PAYMENT_STATUS_LABEL, type CanonicalOrderStatus } from "../../../lib/order-status";
import type { Order } from "../../../types/durian";
import { Badge } from "./kit";

export type TabId = "dashboard" | "orders" | "products" | "rounds" | "claims" | "users" | "settings";

export const ORDER_BADGE: Record<CanonicalOrderStatus, string> = {
  สั่งจอง: "bg-amber-50 text-amber-800 border border-amber-200",
  รอชำระเงิน: "bg-orange-50 text-orange-800 border border-orange-200",
  "ชำระเงินแล้ว/เตรียมจัดส่ง": "bg-sky-50 text-sky-800 border border-sky-200",
  กำลังจัดส่ง: "bg-indigo-50 text-indigo-800 border border-indigo-200",
  จัดส่งสำเร็จ: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  ยกเลิก: "bg-rose-50 text-rose-700 border border-rose-200",
};

const PAY_BADGE: Record<string, string> = {
  pending: "bg-stone-100 text-stone-600",
  slip_submitted: "bg-amber-100 text-amber-900",
  confirmed: "bg-emerald-100 text-emerald-800",
  refunded: "bg-rose-100 text-rose-700",
};

export function OrderStatusBadge({ order }: { order: Order }) {
  const s = orderStatusOf(order);
  return (
    <Badge className={ORDER_BADGE[s]}>
      {ORDER_STATUS_META[s].emoji} {s === "ชำระเงินแล้ว/เตรียมจัดส่ง" ? "เตรียมส่ง" : s}
    </Badge>
  );
}

export function PaymentBadge({ order }: { order: Order }) {
  const p = normalizePaymentStatus(order.paymentStatus);
  return <Badge className={PAY_BADGE[p]}>{PAYMENT_STATUS_LABEL[p]}</Badge>;
}

/** น้ำหนักที่ชั่งได้รวมทั้งออเดอร์ (กก.) */
export function orderKg(o: Order): number {
  return (o.items || []).reduce((sum, it) => {
    const kgs = (it.fruitKgs || []).map(Number).filter((n) => n > 0);
    if (kgs.length) return sum + kgs.reduce((a, b) => a + b, 0);
    return sum + (Number(it.actualWeightKg) > 0 ? Number(it.actualWeightKg) : 0);
  }, 0);
}

export function orderQty(o: Order): number {
  return (o.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0);
}

export function orderDate(o: Order): Date | null {
  const raw = o.createdAt || o.createDate;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function shortDate(raw?: string | Date | null): string {
  if (!raw) return "-";
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function itemsText(o: Order): string {
  return (o.items || []).map((it) => `${it.productName} ×${it.qty}`).join(", ");
}

export const isCancelled = (o: Order) => orderStatusOf(o) === "ยกเลิก";
