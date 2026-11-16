import crypto from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createAdminSessionToken,
  getRuntimeConfig,
} from "../../../../lib/sheets-db";
import { ADMIN_COOKIE_NAME, USER_COOKIE_NAME, isAdminRequest } from "../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    ok: true,
    authenticated: isAdminRequest(req),
  });
}

// จำกัดการเดา PIN: ผิดได้ 5 ครั้งต่อ 10 นาทีต่อ IP (นับในหน่วยความจำของ instance)
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;
const failedAttempts = new Map<string, { count: number; resetAt: number }>();

function pinsMatch(input: string, expected: string): boolean {
  const a = crypto.createHash("sha256").update(input).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { pin?: string };
    const cfg = getRuntimeConfig();
    const expectedPin = (cfg.adminPin || "").trim();

    if (!expectedPin) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "ยังไม่ได้ตั้งรหัส PIN ของแอดมิน — ตั้งตัวแปร ADMIN_PIN ในระบบก่อน",
        },
        { status: 503 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const now = Date.now();
    const entry = failedAttempts.get(ip);
    if (entry && entry.resetAt > now && entry.count >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { ok: false, error: "ใส่รหัสผิดหลายครั้งเกินไป กรุณารอ 10 นาทีแล้วลองใหม่" },
        { status: 429 }
      );
    }

    if (!body.pin || !pinsMatch(body.pin.trim(), expectedPin)) {
      const current = entry && entry.resetAt > now ? entry : { count: 0, resetAt: now + WINDOW_MS };
      current.count += 1;
      failedAttempts.set(ip, current);
      return NextResponse.json(
        { ok: false, error: "รหัส PIN ไม่ถูกต้อง" },
        { status: 401 }
      );
    }
    failedAttempts.delete(ip);

    const token = createAdminSessionToken(expectedPin);
    const res = NextResponse.json({ ok: true, authenticated: true });
    res.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true, authenticated: false });
  res.cookies.delete(ADMIN_COOKIE_NAME);
  res.cookies.delete(USER_COOKIE_NAME);
  return res;
}
