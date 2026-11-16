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
  const re = kind === "orders" 
    ? /^(?:OD-?|WK-)(\d+)$/i 
    : new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`, "i");
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
