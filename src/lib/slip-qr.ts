// ============================================================
// อ่าน QR บนสลิปโอนเงิน (สลิปจากแอปธนาคารไทยมี mini QR สำหรับตรวจสลิป)
// - QR บอก "ธนาคารผู้โอน" + "เลขอ้างอิงรายการ" เท่านั้น — ไม่มียอดเงิน/วันที่/ชื่อผู้รับ
//   (ตรวจยอด/ผู้รับจริงต้องใช้บริการตรวจสลิปของธนาคาร/ผู้ให้บริการ — ระยะ 2)
// - ใช้กันรูปที่ไม่ใช่สลิป และกันสลิปเดิมถูกส่งซ้ำ (เลขอ้างอิงซ้ำกับออเดอร์อื่น)
// ============================================================
import sharp, { type Sharp } from "sharp";
import jsQR from "jsqr";

import type { SlipCheck } from "./slip-check";
export type { SlipCheck } from "./slip-check";

export interface SlipQrResult {
  found: boolean;
  /** ข้อความดิบใน QR */
  raw?: string;
  /** รหัสธนาคารผู้โอน เช่น 004 */
  bankCode?: string;
  bankName?: string;
  /** เลขอ้างอิงรายการโอน (ไม่ซ้ำกันทุกรายการ) */
  transRef?: string;
  /** QR ที่อ่านได้เป็น QR รับเงิน (PromptPay) ไม่ใช่ QR บนสลิป */
  isPaymentQr?: boolean;
}

const BANKS: Record<string, string> = {
  "002": "กรุงเทพ",
  "004": "กสิกรไทย",
  "006": "กรุงไทย",
  "011": "ทหารไทยธนชาต",
  "014": "ไทยพาณิชย์",
  "022": "ซีไอเอ็มบี",
  "024": "ยูโอบี",
  "025": "กรุงศรี",
  "030": "ออมสิน",
  "033": "อาคารสงเคราะห์",
  "034": "ธ.ก.ส.",
  "067": "ทิสโก้",
  "069": "เกียรตินาคินภัทร",
  "070": "ไอซีบีซี",
  "073": "แลนด์ แอนด์ เฮ้าส์",
};

/** แยก TLV แบบ EMV (แท็ก 2 หลัก + ความยาว 2 หลัก + ค่า) */
function parseTlv(s: string): Record<string, string> | null {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < s.length) {
    if (i + 4 > s.length) return null;
    const tag = s.slice(i, i + 2);
    const len = Number(s.slice(i + 2, i + 4));
    if (!Number.isFinite(len) || i + 4 + len > s.length) return null;
    out[tag] = s.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}

/** แปลงข้อความใน QR เป็นข้อมูลสลิป */
export function parseSlipPayload(raw: string): SlipQrResult {
  const text = raw.trim();
  // QR รับเงิน PromptPay / Thai QR ขึ้นต้นด้วย 000201 และมีแท็ก 29/30 (ผู้รับ) — ลูกค้าส่งรูป QR ของร้านมาแทนสลิป
  if (/^000201/.test(text) && /(29|30)\d{2}/.test(text.slice(6))) {
    return { found: true, raw: text, isPaymentQr: true };
  }
  const top = parseTlv(text);
  if (top && top["00"] && top["51"] === "TH") {
    const sub = parseTlv(top["00"]);
    if (sub && sub["01"] && sub["02"]) {
      return { found: true, raw: text, bankCode: sub["01"], bankName: BANKS[sub["01"]] || `ธนาคาร ${sub["01"]}`, transRef: sub["02"] };
    }
  }
  return { found: true, raw: text };
}

async function scan(img: Sharp, width?: number): Promise<string | null> {
  const pipeline = width ? img.clone().resize({ width, withoutEnlargement: false }) : img.clone();
  // jsQR ต้องการ RGBA 4 ช่องเสมอ
  const { data, info } = await pipeline.toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) return null;
  const code = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height, { inversionAttempts: "attemptBoth" });
  return code?.data || null;
}

/** หา QR ในรูปสลิป — ลองหลายขนาด และลองเฉพาะครึ่งล่าง (QR สลิปส่วนใหญ่อยู่มุมล่าง) */
export async function readSlipQr(image: Buffer): Promise<SlipQrResult> {
  try {
    const base = sharp(image, { failOn: "none" }).rotate();
    const meta = await base.metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;
    if (!w || !h) return { found: false };
    const attempts: (() => Promise<string | null>)[] = [
      () => scan(base, Math.min(w, 1400)),
      () => scan(base),
      () => scan(base, Math.min(2 * w, 2000)),
      () => scan(base.clone().extract({ left: 0, top: Math.floor(h / 2), width: w, height: h - Math.floor(h / 2) }), Math.min(2 * w, 1600)),
    ];
    for (const attempt of attempts) {
      const raw = await attempt().catch(() => null);
      if (raw) return parseSlipPayload(raw);
    }
    return { found: false };
  } catch {
    return { found: false };
  }
}

/** ผลตรวจเบื้องต้น: ไม่มี QR / ไม่ใช่ QR สลิป / เลขอ้างอิงซ้ำออเดอร์อื่น / ผ่าน */
export function checkSlip(qr: SlipQrResult, otherOrders: { id: string; slipRef?: string }[], orderId: string): SlipCheck {
  if (!qr.found) return "no_qr";
  if (qr.isPaymentQr || !qr.transRef) return "not_slip";
  const dup = otherOrders.find((o) => o.id !== orderId && o.slipRef && o.slipRef === qr.transRef);
  return dup ? `duplicate:${dup.id}` : "ok";
}
