// ============================================================
// ยืนยันตัวตน LINE ฝั่งเซิร์ฟเวอร์
// ห้ามเชื่อ lineUserId ที่เบราว์เซอร์ส่งมาเอง — ต้องถาม LINE จาก access token เสมอ
// ============================================================
import crypto from "crypto";
import type { NextRequest } from "next/server";
import { getRuntimeConfig } from "./sheets-db";
import { verifySessionToken } from "./user-auth";
import { USER_COOKIE_NAME } from "./admin-auth";
import type { SafeUser } from "../types/durian";

export interface VerifiedLineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

/**
 * ตรวจ access token จาก LIFF (liff.getAccessToken()) กับ LINE
 * คืนโปรไฟล์จริง หรือ null ถ้า token ไม่ใช่ของ channel ร้าน / หมดอายุ / ปลอม
 */
export async function verifyLineAccessToken(
  accessToken?: string | null
): Promise<VerifiedLineProfile | null> {
  const token = (accessToken || "").trim();
  if (!token) return null;

  try {
    const verifyRes = await fetch(
      `https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(token)}`,
      { cache: "no-store", signal: AbortSignal.timeout(10_000) }
    );
    if (!verifyRes.ok) return null;
    const info = (await verifyRes.json()) as { client_id?: string; expires_in?: number };

    const channelId = getRuntimeConfig().lineLoginChannelId || "";
    if (!channelId || info.client_id !== channelId || !(Number(info.expires_in) > 0)) {
      return null;
    }

    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!profileRes.ok) return null;
    const profile = (await profileRes.json()) as VerifiedLineProfile;
    return profile.userId ? profile : null;
  } catch {
    return null;
  }
}

/** ผู้ใช้ที่ล็อกอินอยู่ (จาก cookie ที่เซิร์ฟเวอร์เซ็นเอง) */
export function getSessionUser(req: NextRequest): SafeUser | null {
  const token = req.cookies.get(USER_COOKIE_NAME)?.value;
  return token ? verifySessionToken(token) : null;
}

/** ตรวจว่า webhook มาจาก LINE จริง (header x-line-signature) */
export function isValidLineSignature(
  rawBody: string,
  signature: string | null,
  channelSecret: string
): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", channelSecret)
    .update(rawBody)
    .digest("base64");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
