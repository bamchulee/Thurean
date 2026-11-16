// ============================================================
// ข้อมูลการจองที่ยังไม่ยืนยัน (ร่าง) — เดินทางไปกับปุ่ม postback / ลิงก์ฟอร์มที่อยู่
// ไม่เก็บสถานะในเซิร์ฟเวอร์: บน Vercel ไฟล์ /tmp หายและไม่แชร์ข้าม instance ทำให้ลูกค้าวนกลับไปเริ่มใหม่
// ============================================================
import crypto from "crypto";
import { getSigningSecret } from "./secrets";

/** รหัสสั้นของระดับความสุก (postback data จำกัด 300 ตัว — ข้อความไทยที่ encode แล้วยาวเกิน) */
export const RIPENESS_OPTIONS = [
  { code: "1", label: "กรอบนอกนุ่มใน (ไก่ฉีก)", short: "กรอบนอกนุ่มใน" },
  { code: "2", label: "สุกพอดีกิน (เนื้อเนียนครีม)", short: "สุกพอดีกิน" },
  { code: "3", label: "ห่าม-กรอบมัน", short: "ห่าม-กรอบมัน" },
  { code: "4", label: "สุกงอม (เนื้อนุ่มหวานจัด)", short: "สุกงอมหวานจัด" },
] as const;

export function ripenessLabel(code?: string | null): string {
  return RIPENESS_OPTIONS.find((r) => r.code === code)?.label || RIPENESS_OPTIONS[0].label;
}

/** ปุ่มเก่าในแชตส่งข้อความความสุกเต็ม ๆ มา — แปลงกลับเป็นรหัส */
export function ripenessCodeFromText(text?: string | null): string {
  const t = (text || "").trim();
  const hit = RIPENESS_OPTIONS.find((r) => t && (t === r.label || t.startsWith(r.short)));
  return hit?.code || RIPENESS_OPTIONS[0].code;
}

export interface BookingDraft {
  productId: string;
  qty: number;
  ripeness: string; // code
  ship: number; // index ใน shopInfo.shippingMethods
  key: string; // bookingKey — ยืนยันซ้ำได้ออเดอร์เดิม
}

export const MAX_QTY = 10;

export function clampQty(raw: unknown): number {
  return Math.min(MAX_QTY, Math.max(1, Math.floor(Number(raw) || 1)));
}

/** สุ่มใหม่ทุกครั้งที่สร้างการ์ดยืนยัน: การ์ดใบเดียวกดกี่ครั้งก็ได้ออเดอร์เดียว แต่จองรอบใหม่ได้ออเดอร์ใหม่ */
export function newBookingKey(): string {
  return `BK${Date.now().toString(36)}${crypto.randomBytes(4).toString("hex")}`.toUpperCase();
}

export function draftToParams(d: BookingDraft): string {
  return new URLSearchParams({
    pid: d.productId,
    qty: String(d.qty),
    r: d.ripeness,
    s: String(d.ship),
    k: d.key,
  }).toString();
}

export function draftFromParams(params: URLSearchParams): BookingDraft | null {
  const productId = params.get("pid") || params.get("productId") || "";
  if (!productId) return null;
  return {
    productId,
    qty: clampQty(params.get("qty")),
    ripeness: params.get("r") || ripenessCodeFromText(params.get("ripeness")),
    ship: Math.max(0, Math.floor(Number(params.get("s")) || 0)),
    key: (params.get("k") || params.get("bkey") || "").slice(0, 40),
  };
}

// ------------------------------------------------------------
// ลิงก์ฟอร์มที่อยู่แบบเซ็นชื่อ: เปิดได้เฉพาะคนที่บอทส่งลิงก์ให้ (กันคนเดา LINE ID แล้วแก้ที่อยู่คนอื่น)
// ------------------------------------------------------------

const LINK_TTL_MS = 3 * 24 * 60 * 60 * 1000;

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSigningSecret()).update(`addr:${payload}`).digest("base64url").slice(0, 32);
}

/** query string สำหรับ /address — u = LINE userId, d = ร่างการจอง (ถ้ามี), e = หมดอายุ */
export function buildAddressLinkQuery(lineUserId: string, draft?: BookingDraft): string {
  const e = String(Date.now() + LINK_TTL_MS);
  const d = draft ? draftToParams(draft) : "";
  const sig = sign(`${lineUserId}|${d}|${e}`);
  return new URLSearchParams({ u: lineUserId, d, e, sig }).toString();
}

export function verifyAddressLink(q: {
  u?: string | null;
  d?: string | null;
  e?: string | null;
  sig?: string | null;
}): { lineUserId: string; draft: BookingDraft | null } | null {
  const u = q.u || "";
  const d = q.d || "";
  const e = q.e || "";
  if (!u || !e || !q.sig || Number(e) < Date.now()) return null;
  const expected = sign(`${u}|${d}|${e}`);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(q.sig));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { lineUserId: u, draft: d ? draftFromParams(new URLSearchParams(d)) : null };
}
