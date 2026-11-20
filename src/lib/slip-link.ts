// ============================================================
// ลิงก์รูปสลิป / รูปหลักฐานเคลม (/api/slips/...) — ไม่เปิดให้ใครก็ได้ดู
//   • แอดมิน/พนักงานที่ล็อกอินอยู่ เปิดได้ (หน้าออเดอร์ในหลังบ้าน)
//   • รูปในการ์ด LINE (เซิร์ฟเวอร์ LINE ต้องดึงรูปเอง ไม่มี cookie) ใช้ลิงก์ที่มีลายเซ็น + วันหมดอายุ
// ============================================================
import crypto from "crypto";
import { getSigningSecret } from "./secrets";

/** อายุลิงก์ในการ์ด LINE — แอดมินเลื่อนดูย้อนหลังได้ราว 1 เดือน */
const LINK_TTL_SECONDS = 30 * 24 * 60 * 60;

function sign(filename: string, exp: number): string {
  return crypto.createHmac("sha256", getSigningSecret()).update(`slip:${filename}:${exp}`).digest("base64url").slice(0, 32);
}

/** "/api/slips/slip-123.jpg" หรือ URL เต็ม → URL เต็มที่มีลายเซ็น (ไม่ใช่ลิงก์สลิป = คืนค่าเดิม) */
export function signedSlipUrl(pathOrUrl: string, baseUrl?: string, ttlSeconds = LINK_TTL_SECONDS): string {
  const m = pathOrUrl.match(/\/api\/slips\/([^/?#]+)/);
  if (!m) return pathOrUrl;
  const filename = decodeURIComponent(m[1]);
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const base = pathOrUrl.startsWith("http") ? pathOrUrl.replace(/\/api\/slips\/.*$/, "") : (baseUrl || "").replace(/\/+$/, "");
  return `${base}/api/slips/${encodeURIComponent(filename)}?exp=${exp}&sig=${sign(filename, exp)}`;
}

export function verifySlipSignature(filename: string, exp: string | null, sig: string | null): boolean {
  const e = Number(exp);
  if (!sig || !Number.isFinite(e) || e < Math.floor(Date.now() / 1000)) return false;
  const expected = sign(filename, e);
  return expected.length === sig.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}
