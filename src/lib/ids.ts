// ============================================================
// รูปแบบรหัสเลขรันของทุกตาราง (ต้องตรงกับ ID_FORMATS ใน google-apps-script/1_Config.gs)
// เลขจริงออกโดย Apps Script ภายใต้ล็อก — ฝั่งเว็บใช้คำนวณเลขชั่วคราว/โหมด local เท่านั้น
// ============================================================

export const ID_FORMATS = {
  users: { prefix: "USR-", pad: 5 },
  orders: { prefix: "OD", pad: 6 },
  claims: { prefix: "CLM-", pad: 5 },
  products: { prefix: "WK-", pad: 2 },
  rounds: { prefix: "WK-ROUND-", pad: 2 },
  lots: { prefix: "LOT-", pad: 3 },
  promotions: { prefix: "PROMO-", pad: 2 },
} as const;

export type IdKind = keyof typeof ID_FORMATS;

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** เลขถัดไป = เลขสูงสุดที่มีอยู่ (เฉพาะรหัสที่ตรงรูปแบบ) + 1 (ถ้าเกิน 6 หลัก ขยายเป็น 7 หลักอัตโนมัติ) */
export function nextRunningId(kind: IdKind, existingIds: Iterable<string | undefined>): string {
  const { prefix, pad } = ID_FORMATS[kind];
  const re = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`, "i");
  let max = 0;
  for (const id of existingIds) {
    const m = String(id || "").match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const nextNum = max + 1;
  const numStr = String(nextNum);
  const padded = numStr.length >= pad ? numStr : numStr.padStart(pad, "0");
  return `${prefix}${padded}`;
}

// ============================================================
// เลขออเดอร์: ใช้เลขเดียว (OD000123) ตั้งแต่ลูกค้ากดจองจนจัดส่ง
// ออเดอร์รุ่นเก่าก่อนเปลี่ยนรูปแบบเป็น WK-9523 ยังค้นเจอได้
// ============================================================

// WK- ต้องมี 4 หลักขึ้นไป ไม่ให้ไปจับรหัสสินค้า (WK-07)
const ORDER_ID_IN_TEXT = /\b(?:OD-?\d{1,7}|WK-\d{4,})\b/i;

/** ดึงรหัสออเดอร์ที่ลูกค้า/แอดมินพิมพ์ปนมาในข้อความ เช่น "เคลม OD000123 ครับ" */
export function extractOrderId(text: string): string | undefined {
  return String(text || "").match(ORDER_ID_IN_TEXT)?.[0]?.toUpperCase();
}

/** หาออเดอร์จากรหัสที่พิมพ์มา รองรับ "OD000123", "od123", "123" และรหัสเก่า "WK-9523" */
export function findOrderById<T extends { id: string }>(
  orders: T[],
  raw: string | undefined
): T | undefined {
  const q = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!q) return undefined;
  const exact = orders.find((o) => o.id.toUpperCase() === q);
  if (exact) return exact;

  const m = q.match(/^(?:OD-?|WK-)?(\d{1,7})$/);
  if (!m) return undefined;
  const num = Number(m[1]);
  const sameNumber = (o: T, re: RegExp) => {
    const om = o.id.toUpperCase().match(re);
    return Boolean(om && Number(om[1]) === num);
  };
  const findOd = () => orders.find((o) => sameNumber(o, /^OD-?(\d+)$/));
  const findLegacy = () => orders.find((o) => sameNumber(o, /^WK-(\d{4,})$/));
  if (q.startsWith("WK-")) return findLegacy();
  if (q.startsWith("OD")) return findOd();
  // เลขล้วนให้ OD ก่อน แล้วค่อยลองรหัสเก่า WK-
  return findOd() || findLegacy();
}
