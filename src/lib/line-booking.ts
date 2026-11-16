// ============================================================
// การ์ดยืนยันการจอง — ใช้ร่วมกันระหว่าง webhook (ลูกค้ามีที่อยู่แล้ว)
// และ /api/address (ลูกค้าเพิ่งกรอกฟอร์มที่อยู่)
// ============================================================
import { buildBookingReviewFlex } from "./line-notify";
import {
  type BookingDraft,
  buildAddressLinkQuery,
  draftToParams,
  newBookingKey,
  ripenessLabel,
} from "./booking-draft";
import { shopInfo } from "../data/mock";
import type { Product } from "../types/durian";

export function addressFormUrlFor(baseUrl: string, lineUserId: string, draft?: BookingDraft): string {
  return `${baseUrl || "https://durianwinkin.vercel.app"}/address?${buildAddressLinkQuery(lineUserId, draft)}`;
}

export function bookingReviewMessages(
  draft: BookingDraft,
  product: Product,
  contact: { name: string; phone: string; address: string },
  baseUrl: string,
  lineUserId: string
): unknown[] {
  const ships = shopInfo.shippingMethods;
  const shipIndex = draft.ship < ships.length ? draft.ship : 0;
  const ship = ships[shipIndex];
  const withKey: BookingDraft = { ...draft, ship: shipIndex, key: draft.key || newBookingKey() };
  return buildBookingReviewFlex({
    product,
    qty: withKey.qty,
    ripenessLabel: ripenessLabel(withKey.ripeness),
    shippingName: ship.name,
    shippingCost: ship.price,
    customer: contact,
    confirmData: `action=order_confirm&${draftToParams(withKey)}`,
    // เปลี่ยนวิธีส่งแล้วใช้ bookingKey เดิม: กดยืนยันการ์ดใบเก่าหรือใบใหม่ก็ได้ออเดอร์เดียว
    changeShipData:
      ships.length > 1
        ? `action=order_step&step=review&${draftToParams({ ...withKey, ship: (shipIndex + 1) % ships.length })}`
        : undefined,
    addressFormUrl: addressFormUrlFor(baseUrl, lineUserId, withKey),
  });
}
