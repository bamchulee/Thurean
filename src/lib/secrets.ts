// ============================================================
// Signing secret สำหรับเซ็น session token (แอดมิน + สมาชิก)
// ไม่มีค่าเริ่มต้นฝังในโค้ด — ลำดับการหา:
// 1. ENV: SESSION_SECRET หรือ ADMIN_SECRET (แนะนำให้ตั้งบน Vercel)
// 2. สร้างจากความลับตัวอื่นที่ตั้งใน ENV แล้ว (ค่าคงที่ข้าม instance)
// 3. สุ่มแล้วเก็บไฟล์ในโฟลเดอร์ data (ใช้ได้ดีตอนรันในเครื่อง)
// ============================================================
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getWritableDataDir } from "./storage-dir";

let cached: string | null = null;

export function getSigningSecret(): string {
  if (cached) return cached;

  const explicit = process.env.SESSION_SECRET || process.env.ADMIN_SECRET;
  if (explicit && explicit.trim().length >= 16) {
    cached = explicit.trim();
    return cached;
  }

  const derivedFrom = [
    process.env.LINE_LOGIN_CHANNEL_SECRET,
    process.env.LINE_CHANNEL_ACCESS_TOKEN,
    process.env.GOOGLE_SHEETS_API_KEY,
  ]
    .filter(Boolean)
    .join("|");
  if (derivedFrom) {
    cached = crypto
      .createHash("sha256")
      .update(`winkin-signing:${derivedFrom}`)
      .digest("hex");
    return cached;
  }

  const file = path.join(getWritableDataDir(), ".signing-secret");
  try {
    if (fs.existsSync(file)) {
      const saved = fs.readFileSync(file, "utf-8").trim();
      if (saved.length >= 32) {
        cached = saved;
        return cached;
      }
    }
  } catch {
    // fall through to generate
  }

  const generated = crypto.randomBytes(32).toString("hex");
  try {
    fs.writeFileSync(file, generated, "utf-8");
  } catch {
    // read-only FS: keep it in memory for this process only
  }
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[security] ยังไม่ได้ตั้ง SESSION_SECRET — ใช้ค่าสุ่มชั่วคราว ผู้ใช้อาจหลุดล็อกอินเมื่อเซิร์ฟเวอร์รีสตาร์ต"
    );
  }
  cached = generated;
  return cached;
}
