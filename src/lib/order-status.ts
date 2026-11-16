// ============================================================
// Order Status & Payment Status Single Source of Truth
// (ตามข้อกำหนดใน docs/ANTIGRAVITY.md ข้อ 2.2)
// ============================================================

export type CanonicalOrderStatus =
  | "สั่งจอง"
  | "รอชำระเงิน"
  | "ชำระเงินแล้ว/เตรียมจัดส่ง"
  | "กำลังจัดส่ง"
  | "จัดส่งสำเร็จ"
  | "ยกเลิก";

export type CanonicalPaymentStatus =
  | "pending"
  | "slip_submitted"
  | "confirmed"
  | "refunded";

export interface StatusMeta {
  orderStatus: CanonicalOrderStatus;
  paymentStatus: CanonicalPaymentStatus;
  step: number;
  label: string;
  badgeColor: string;
  description: string;
}

export const ORDER_STATUS_STEPS: Record<CanonicalOrderStatus, StatusMeta> = {
  สั่งจอง: {
    orderStatus: "สั่งจอง",
    paymentStatus: "pending",
    step: 1,
    label: "สั่งจอง",
    badgeColor: "#F59E0B",
    description: "บันทึกการสั่งจองสำเร็จ รอแอดมินคัดและชั่งน้ำหนักจริง",
  },
  รอชำระเงิน: {
    orderStatus: "รอชำระเงิน",
    paymentStatus: "pending",
    step: 2,
    label: "รอชำระเงิน",
    badgeColor: "#EA580C",
    description: "แอดมินชั่งน้ำหนักและสรุปยอดจริงแล้ว รอลูกค้าโอนและแนบสลิป",
  },
  "ชำระเงินแล้ว/เตรียมจัดส่ง": {
    orderStatus: "ชำระเงินแล้ว/เตรียมจัดส่ง",
    paymentStatus: "confirmed",
    step: 4,
    label: "ชำระเงินแล้ว/เตรียมจัดส่ง",
    badgeColor: "#16A34A",
    description: "แอดมินตรวจสอบยอดเงินถูกต้องแล้ว กำลังเตรียมบรรจุทุเรียนเพื่อส่ง",
  },
  กำลังจัดส่ง: {
    orderStatus: "กำลังจัดส่ง",
    paymentStatus: "confirmed",
    step: 5,
    label: "กำลังจัดส่ง",
    badgeColor: "#2563EB",
    description: "สินค้าออกจากสวนแล้ว อยู่ระหว่างการนำส่งโดยรถควบคุมอุณหภูมิ/ขนส่ง",
  },
  จัดส่งสำเร็จ: {
    orderStatus: "จัดส่งสำเร็จ",
    paymentStatus: "confirmed",
    step: 6,
    label: "จัดส่งสำเร็จ",
    badgeColor: "#15803D",
    description: "จัดส่งถึงมือลูกค้าเรียบร้อยแล้ว (สามารถแจ้งเคลมได้ภายใน 24 ชม.)",
  },
  ยกเลิก: {
    orderStatus: "ยกเลิก",
    paymentStatus: "refunded",
    step: 0,
    label: "ยกเลิก",
    badgeColor: "#DC2626",
    description: "คำสั่งซื้อถูกยกเลิก และคืนสต็อกเรียบร้อยแล้ว",
  },
};

/**
 * แปลงสถานะรุ่นเก่า (ภาษาอังกฤษ หรือภาษาไทยรุ่นเดิม) ให้เป็น CanonicalOrderStatus มาตรฐาน
 */
export function normalizeOrderStatus(raw?: string): CanonicalOrderStatus {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return "สั่งจอง";

  if (s === "สั่งจอง" || s === "จอง" || s === "booking") return "สั่งจอง";
  if (
    s === "รอชำระเงิน" ||
    s === "รอชั่งน้ำหนัก/สรุปยอด" ||
    s === "weighed" ||
    s === "awaiting_payment"
  ) {
    return "รอชำระเงิน";
  }
  if (
    s === "ชำระเงินแล้ว/เตรียมจัดส่ง" ||
    s === "preparing" ||
    s === "packed" ||
    s === "received" ||
    s === "paid"
  ) {
    return "ชำระเงินแล้ว/เตรียมจัดส่ง";
  }
  if (s === "กำลังจัดส่ง" || s === "shipped" || s === "delivering") {
    return "กำลังจัดส่ง";
  }
  if (s === "จัดส่งสำเร็จ" || s === "delivered" || s === "claimed") {
    return "จัดส่งสำเร็จ";
  }
  if (s === "ยกเลิก" || s === "cancelled" || s === "canceled") {
    return "ยกเลิก";
  }

  return "สั่งจอง";
}

/**
 * ตรวจสอบว่าสามารถเปลี่ยนสถานะจาก current ไปเป็น next ได้หรือไม่
 * ตามกติกาใน docs/ANTIGRAVITY.md ข้อ 2.2:
 * 1->2, 2->3 (slip), 3->4, 3->2 (สลิปไม่ผ่าน), 4->5, 5->6, (1|2|3)->ยกเลิก
 */
export function canTransitionOrderStatus(
  current: CanonicalOrderStatus,
  next: CanonicalOrderStatus
): boolean {
  if (current === next) return true;
  if (next === "ยกเลิก") {
    return current === "สั่งจอง" || current === "รอชำระเงิน";
  }

  switch (current) {
    case "สั่งจอง":
      return next === "รอชำระเงิน";
    case "รอชำระเงิน":
      return next === "ชำระเงินแล้ว/เตรียมจัดส่ง";
    case "ชำระเงินแล้ว/เตรียมจัดส่ง":
      return next === "กำลังจัดส่ง";
    case "กำลังจัดส่ง":
      return next === "จัดส่งสำเร็จ";
    default:
      return false;
  }
}
