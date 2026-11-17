// ผลตรวจ QR สลิป (ใช้ได้ทั้งฝั่งเซิร์ฟเวอร์และหน้าเว็บ — ไม่มี dependency หนัก)
export type SlipCheck = "ok" | "no_qr" | "not_slip" | `duplicate:${string}`;

export function slipCheckText(check?: string): { label: string; tone: "ok" | "warn" | "bad" } {
  if (!check) return { label: "ยังไม่ได้ตรวจ QR", tone: "warn" };
  if (check === "ok") return { label: "✅ อ่าน QR สลิปได้ เลขรายการไม่ซ้ำ", tone: "ok" };
  if (check === "no_qr") return { label: "⚠️ ไม่พบ QR บนรูป — อาจไม่ใช่สลิปจริง ตรวจด้วยตา", tone: "warn" };
  if (check === "not_slip") return { label: "⚠️ QR ในรูปไม่ใช่ QR สลิป (อาจเป็น QR รับเงิน)", tone: "bad" };
  if (check.startsWith("duplicate:")) return { label: `⛔ สลิปซ้ำ — เลขรายการนี้เคยใช้กับ ${check.slice(10)}`, tone: "bad" };
  return { label: check, tone: "warn" };
}

/** ผลตรวจยอดจากตัวหนังสือบนสลิป */
export function slipAmountText(order: { slipAmountCheck?: string; slipAmount?: number; totalPrice?: number; shippingCost?: number }): string {
  const expected = (order.totalPrice || 0) + (order.shippingCost || 0);
  if (order.slipAmountCheck === "match") return `✅ ยอดในสลิปตรง ฿${expected.toLocaleString()}`;
  if (order.slipAmountCheck === "mismatch" && typeof order.slipAmount === "number") {
    const diff = Math.round((order.slipAmount - expected) * 100) / 100;
    return `⛔ ยอดในสลิป ฿${order.slipAmount.toLocaleString()} ${diff < 0 ? "ขาด" : "เกิน"} ฿${Math.abs(diff).toLocaleString()}`;
  }
  if (order.slipAmountCheck === "unknown") return "⚠️ อ่านยอดในสลิปไม่ได้ — เช็กด้วยตา";
  return "";
}

/** ผลตรวจบัญชีผู้รับจากตัวหนังสือบนสลิป */
export function slipAccountText(check?: string): string {
  if (check === "match") return "✅ โอนเข้าบัญชีร้าน";
  if (check === "mismatch") return "⛔ บัญชีผู้รับไม่ใช่บัญชีร้าน";
  if (check === "unknown") return "⚠️ อ่านบัญชีผู้รับไม่ชัด — เช็กด้วยตา";
  return "";
}
