import type { Order, Claim } from "../types/durian";

export interface ClaimPolicyConfig {
  readyToEatWarrantyHours: number; // 24 ชั่วโมง (มาตรฐานร้านวินคิน)
  ripenAtHomeWarrantyHours: number; // 24 ชั่วโมง (หลังจัดส่งสำเร็จต้องกดเคลมภายใน 24 ชม.)
}

export const MASTER_CLAIM_POLICY: ClaimPolicyConfig = {
  readyToEatWarrantyHours: 24,
  ripenAtHomeWarrantyHours: 24, // หลังสถานะ ส่งเสร็จสิ้นต้อง กดเคลมภายใน 24 ชม.
};

export interface ClaimEligibilityResult {
  eligible: boolean;
  reason?: string;
  order?: Order;
  warrantyType: "ready_to_eat" | "ripen_at_home";
  warrantyHours: number;
  hoursSinceDelivery?: number;
  hoursLeft?: number;
  minutesLeft?: number;
}

/**
 * ตรวจสอบความถูกต้องและสิทธิ์การแจ้งเคลมของออเดอร์
 * 1. มีออเดอร์จริงในระบบ
 * 2. สถานะชำระเงินสำเร็จ (confirmed หรือ ชำระเงินแล้ว)
 * 3. สถานะจัดส่งสำเร็จ (delivered หรือ จัดส่งสำเร็จ)
 * 4. ยังไม่เคยถูกแจ้งเคลม
 * 5. อยู่ในเงื่อนไขเวลารับประกัน 24 ชั่วโมง หลังสถานะจัดส่งสำเร็จ
 */
export function checkClaimEligibility(
  order: Order,
  claims: Claim[],
  policy: ClaimPolicyConfig = MASTER_CLAIM_POLICY
): ClaimEligibilityResult {
  const isPaid =
    order.paymentStatus === "confirmed" ||
    order.orderStatus === "ชำระเงินแล้ว/เตรียมจัดส่ง" ||
    order.orderStatus === "กำลังจัดส่ง" ||
    order.orderStatus === "จัดส่งสำเร็จ";

  // 1. ตรวจสอบสถานะการชำระเงิน
  if (!isPaid) {
    return {
      eligible: false,
      reason: `⚠️ ออเดอร์ ${order.id} ยังไม่ได้รับการชำระเงิน จึงไม่สามารถแจ้งเคลมได้ครับ`,
      order,
      warrantyType: "ready_to_eat",
      warrantyHours: policy.readyToEatWarrantyHours,
    };
  }

  // 2. ตรวจสอบสถานะการจัดส่ง
  const isDelivered =
    order.orderStatus === "delivered" ||
    order.orderStatus === "จัดส่งสำเร็จ";

  if (!isDelivered) {
    const currentStatus = order.orderStatus || "รอจัดส่ง";
    return {
      eligible: false,
      reason: `⏳ ออเดอร์ ${order.id} ปัจจุบันมีสถานะ "${currentStatus}"\nสินค้ายังจัดส่งไม่ถึงมือผู้รับ สามารถแจ้งเคลมได้หลังจากได้รับสินค้าแล้ว ภายใน 24 ชม. ครับ`,
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

  const warrantyHours = 24; // หลังสถานะ ส่งเสร็จสิ้นต้อง กดเคลมภายใน 24 ชม.

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
    return {
      eligible: false,
      reason: `⛔ หมดระยะเวลารับประกันเคลม\n\nเงื่อนไขร้าน: ต้องแจ้งเคลมภายใน 24 ชม. หลังได้รับสินค้า\nพัสดุนี้จัดส่งสำเร็จแล้วเป็นเวลาประมาณ ${hoursElapsed} ชั่วโมง ซึ่งเกินกำหนดเวลา 24 ชม. จึงไม่สามารถเปิดเคลมได้ครับ`,
      order,
      warrantyType: "ready_to_eat",
      warrantyHours,
      hoursSinceDelivery: hoursElapsed,
      hoursLeft: 0,
      minutesLeft: 0,
    };
  }

  const totalMinutesRemaining = Math.max(0, Math.floor((warrantyHours * 60) - (diffHours * 60)));
  const hoursLeft = Math.floor(totalMinutesRemaining / 60);
  const minutesLeft = totalMinutesRemaining % 60;

  return {
    eligible: true,
    order,
    warrantyType: "ready_to_eat",
    warrantyHours,
    hoursSinceDelivery: Math.floor(diffHours),
    hoursLeft,
    minutesLeft,
  };
}
