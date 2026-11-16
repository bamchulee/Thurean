// ============================================================
// สถานะออเดอร์ชุดเดียวของทั้งระบบ (เว็บ หลังบ้าน LINE เคลม)
// flow: สั่งจอง → รอชำระเงิน → ชำระเงินแล้ว/เตรียมจัดส่ง → กำลังจัดส่ง → จัดส่งสำเร็จ
// สถานะเก่า (received / preparing / รอชั่งน้ำหนัก/สรุปยอด ...) อ่านได้ แต่ห้ามเขียนลงออเดอร์ใหม่
// ============================================================

export const ORDER_STATUSES = [
  "สั่งจอง",
  "รอชำระเงิน",
  "ชำระเงินแล้ว/เตรียมจัดส่ง",
  "กำลังจัดส่ง",
  "จัดส่งสำเร็จ",
  "ยกเลิก",
] as const;

export type CanonicalOrderStatus = (typeof ORDER_STATUSES)[number];

export type CanonicalPaymentStatus = "pending" | "slip_submitted" | "confirmed" | "refunded";

export interface StatusMeta {
  step: number; // 0 = ยกเลิก
  label: string;
  emoji: string;
  color: string;
  /** ข้อความบอกลูกค้าว่าตอนนี้อยู่ขั้นไหน และต้องทำอะไรต่อ */
  customerHint: string;
}

export const ORDER_STATUS_META: Record<CanonicalOrderStatus, StatusMeta> = {
  สั่งจอง: {
    step: 1,
    label: "สั่งจอง",
    emoji: "🟡",
    color: "#D97706",
    customerHint: "รับจองแล้ว รอแอดมินคัดผลและชั่งน้ำหนักจริง — ยังไม่ต้องโอนเงิน",
  },
  รอชำระเงิน: {
    step: 2,
    label: "รอชำระเงิน",
    emoji: "🟠",
    color: "#EA580C",
    customerHint: "ชั่งน้ำหนักแล้ว โอนตามยอดจริงแล้วส่งรูปสลิปเข้าแชทนี้ได้เลย",
  },
  "ชำระเงินแล้ว/เตรียมจัดส่ง": {
    step: 3,
    label: "ชำระเงินแล้ว/เตรียมจัดส่ง",
    emoji: "🟢",
    color: "#16A34A",
    customerHint: "ได้รับยอดชำระแล้ว กำลังแพ็กเตรียมจัดส่ง",
  },
  กำลังจัดส่ง: {
    step: 4,
    label: "กำลังจัดส่ง",
    emoji: "🚚",
    color: "#2563EB",
    customerHint: "สินค้าออกจากร้านแล้ว เช็กเลขพัสดุได้จากปุ่มด้านล่าง",
  },
  จัดส่งสำเร็จ: {
    step: 5,
    label: "จัดส่งสำเร็จ",
    emoji: "✅",
    color: "#15803D",
    customerHint: "ส่งถึงแล้ว หากพบปัญหาแจ้งเคลมได้ภายใน 24 ชม.",
  },
  ยกเลิก: {
    step: 0,
    label: "ยกเลิก",
    emoji: "❌",
    color: "#DC2626",
    customerHint: "ออเดอร์นี้ถูกยกเลิกแล้ว",
  },
};

export const PAYMENT_STATUS_LABEL: Record<CanonicalPaymentStatus, string> = {
  pending: "ยังไม่ชำระ",
  slip_submitted: "ส่งสลิปแล้ว รอตรวจ",
  confirmed: "ชำระแล้ว",
  refunded: "คืนเงินแล้ว",
};

/** แปลงสถานะเก่า/สะกดต่าง ให้เป็นชุดมาตรฐาน — paymentStatus ช่วยตัดสินออเดอร์ "received" รุ่นเก่า */
export function normalizeOrderStatus(raw?: string, paymentStatus?: string): CanonicalOrderStatus {
  const s = (raw || "").trim().toLowerCase();
  const paid = paymentStatus === "confirmed";
  switch (s) {
    case "":
    case "สั่งจอง":
    case "จอง":
    case "booking":
    case "รอชั่งน้ำหนัก/สรุปยอด":
      return "สั่งจอง";
    case "received":
      return paid ? "ชำระเงินแล้ว/เตรียมจัดส่ง" : "สั่งจอง";
    case "รอชำระเงิน":
    case "awaiting_payment":
      return "รอชำระเงิน";
    case "ชำระเงินแล้ว/เตรียมจัดส่ง":
    case "preparing":
    case "packed":
    case "paid":
      return "ชำระเงินแล้ว/เตรียมจัดส่ง";
    case "กำลังจัดส่ง":
    case "shipped":
      return "กำลังจัดส่ง";
    case "จัดส่งสำเร็จ":
    case "delivered":
    case "claimed":
      return "จัดส่งสำเร็จ";
    case "ยกเลิก":
    case "cancelled":
    case "canceled":
      return "ยกเลิก";
    default:
      return "สั่งจอง";
  }
}

export function normalizePaymentStatus(raw?: string): CanonicalPaymentStatus {
  if (raw === "slip_submitted" || raw === "confirmed" || raw === "refunded") return raw;
  return "pending";
}

export function orderStatusOf(order: { orderStatus?: string; paymentStatus?: string }): CanonicalOrderStatus {
  return normalizeOrderStatus(order.orderStatus, order.paymentStatus);
}

/** เปลี่ยนสถานะได้เฉพาะเดินหน้าทีละขั้น หรือยกเลิกก่อนส่งของ */
const NEXT: Record<CanonicalOrderStatus, CanonicalOrderStatus[]> = {
  สั่งจอง: ["รอชำระเงิน", "ยกเลิก"],
  รอชำระเงิน: ["ชำระเงินแล้ว/เตรียมจัดส่ง", "ยกเลิก"],
  "ชำระเงินแล้ว/เตรียมจัดส่ง": ["กำลังจัดส่ง", "ยกเลิก"],
  กำลังจัดส่ง: ["จัดส่งสำเร็จ"],
  จัดส่งสำเร็จ: [],
  ยกเลิก: [],
};

export function canTransitionOrderStatus(
  current: CanonicalOrderStatus,
  next: CanonicalOrderStatus
): boolean {
  return current === next || NEXT[current].includes(next);
}

export function allowedNextStatuses(current: CanonicalOrderStatus): CanonicalOrderStatus[] {
  return NEXT[current];
}

/** ชั่งน้ำหนัก / แก้ยอดได้เฉพาะก่อนลูกค้าจ่าย */
export function canWeigh(order: { orderStatus?: string; paymentStatus?: string }): boolean {
  const s = orderStatusOf(order);
  return (s === "สั่งจอง" || s === "รอชำระเงิน") && normalizePaymentStatus(order.paymentStatus) !== "confirmed";
}
