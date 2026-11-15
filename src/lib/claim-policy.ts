import type { Order, Claim } from "../types/durian";

export interface ClaimPolicyConfig {
  readyToEatWarrantyHours: number; // สุกพร้อมทาน / เนื้อล้วน: 24 ชั่วโมง
  ripenAtHomeWarrantyHours: number; // บ่มเอง / แก่จัด: 72 ชั่วโมง (3 วัน)
}

export const MASTER_CLAIM_POLICY: ClaimPolicyConfig = {
  readyToEatWarrantyHours: 24,
  ripenAtHomeWarrantyHours: 72,
};

export interface ClaimEligibilityResult {
  eligible: boolean;
  reason?: string;
  order?: Order;
  warrantyType: "ready_to_eat" | "ripen_at_home";
  warrantyHours: number;
  hoursSinceDelivery?: number;
}

/**
 * ตรวจสอบความถูกต้องและสิทธิ์การแจ้งเคลมของออเดอร์
 * 1. มีออเดอร์จริงในระบบ
 * 2. สถานะชำระเงินสำเร็จ (confirmed)
 * 3. สถานะจัดส่งสำเร็จ (delivered)
 * 4. ยังไม่เคยถูกแจ้งเคลม
 * 5. อยู่ในเงื่อนไขเวลารับประกัน (สุกพร้อมทาน: 24 ชม., บ่มเอง: 72 ชม.)
 */
export function checkClaimEligibility(
  order: Order,
  claims: Claim[],
  policy: ClaimPolicyConfig = MASTER_CLAIM_POLICY
): ClaimEligibilityResult {
  // 1. ตรวจสอบสถานะการชำระเงิน
  if (order.paymentStatus !== "confirmed") {
    return {
      eligible: false,
      reason: `⚠️ ออเดอร์ ${order.id} ยังไม่ได้รับการชำระเงิน จึงไม่สามารถแจ้งเคลมได้ครับ`,
      order,
      warrantyType: "ready_to_eat",
      warrantyHours: policy.readyToEatWarrantyHours,
    };
  }

  // 2. ตรวจสอบสถานะการจัดส่ง
  if (order.orderStatus !== "delivered") {
    const statusTextMap: Record<string, string> = {
      received: "ร้านได้รับออเดอร์แล้ว",
      preparing: "กำลังคัดตัดสดหน้าสวน",
      packed: "แพ็กกล่องพัสดุเรียบร้อย",
      shipped: "กำลังอยู่ระหว่างการขนส่ง",
      claimed: "แจ้งเคลมเรียบร้อยแล้ว",
    };
    const currentStatus = statusTextMap[order.orderStatus] || order.orderStatus;
    return {
      eligible: false,
      reason: `⏳ ออเดอร์ ${order.id} ปัจจุบันมีสถานะ "${currentStatus}"\nสินค้ายังจัดส่งไม่ถึงมือผู้รับ จึงยังไม่สามารถเปิดเคลมได้ครับ`,
      order,
      warrantyType: "ready_to_eat",
      warrantyHours: policy.readyToEatWarrantyHours,
    };
  }

  // 3. ตรวจสอบว่าเคยแจ้งเคลมไปแล้วหรือยัง
  const existingClaim = claims.find(
    (c) => c.orderId === order.id && c.status !== "rejected"
  );
  if (existingClaim) {
    const claimStatusMap: Record<string, string> = {
      pending: "กำลังรอแอดมินตรวจสอบ",
      approved_replace: "อนุมัติเคลมส่งสินค้าใหม่",
      approved_refund: "อนุมัติเคลมคืนเงิน",
    };
    return {
      eligible: false,
      reason: `ℹ️ ออเดอร์ ${order.id} มีรายการแจ้งเคลมในระบบแล้ว\n(รหัสเคลม: ${existingClaim.claimId} • สถานะ: ${claimStatusMap[existingClaim.status] || existingClaim.status})`,
      order,
      warrantyType: "ready_to_eat",
      warrantyHours: policy.readyToEatWarrantyHours,
    };
  }

  // 4. ตรวจสอบประเภทความสุกเพื่อหาระยะเวลารับประกัน (Master Data Claim Policy)
  // - สุกพร้อมทาน / เนื้อล้วน: 24 ชม.
  // - บ่มเอง / แก่จัดรอสุก / ทั้งลูก: 3 วัน (72 ชม.)
  const ripenessText = (order.ripenessPref || "").toLowerCase();
  const hasWholeFruit = order.items.some(
    (it) => it.productName.includes("ทั้งลูก") || it.productName.includes("บ่ม")
  );
  const isRipenAtHome =
    ripenessText.includes("บ่ม") ||
    ripenessText.includes("แก่จัด") ||
    ripenessText.includes("รอสุก") ||
    hasWholeFruit;

  const warrantyType = isRipenAtHome ? "ripen_at_home" : "ready_to_eat";
  const warrantyHours = isRipenAtHome
    ? policy.ripenAtHomeWarrantyHours
    : policy.readyToEatWarrantyHours;

  // คำนวณเวลาที่จัดส่งสำเร็จ
  const deliveredTime = order.deliveredAt
    ? new Date(order.deliveredAt).getTime()
    : order.updatedAt
    ? new Date(order.updatedAt).getTime()
    : new Date(order.createdAt).getTime();

  const now = Date.now();
  const diffHours = (now - deliveredTime) / (1000 * 60 * 60);

  if (diffHours > warrantyHours) {
    const hoursElapsed = Math.floor(diffHours);
    const policyDesc = isRipenAtHome
      ? `ทุเรียนแก่จัด/บ่มเอง (รับประกันภายใน 3 วัน หรือ 72 ชม. หลังได้รับสินค้า)`
      : `ทุเรียนสุกพร้อมทาน/เนื้อล้วน (รับประกันภายใน 24 ชม. หลังได้รับสินค้า)`;

    return {
      eligible: false,
      reason: `⛔ หมดระยะเวลารับประกันเคลม\n\nเงื่อนไขร้าน: ${policyDesc}\nพัสดุนี้จัดส่งสำเร็จแล้วเป็นเวลาประมาณ ${hoursElapsed} ชั่วโมง ซึ่งเกินกำหนดเวลา จึงไม่สามารถเปิดเคลมได้ครับ`,
      order,
      warrantyType,
      warrantyHours,
      hoursSinceDelivery: hoursElapsed,
    };
  }

  return {
    eligible: true,
    order,
    warrantyType,
    warrantyHours,
    hoursSinceDelivery: Math.floor(diffHours),
  };
}
