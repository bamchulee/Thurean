import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createAdminSessionToken,
  getRuntimeConfig,
} from "../../../../lib/sheets-db";
import { ADMIN_COOKIE_NAME, isAdminRequest } from "../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    ok: true,
    authenticated: isAdminRequest(req),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { pin?: string };
    const cfg = getRuntimeConfig();
    const expectedPin = cfg.adminPin || "2824";

    if (!body.pin || body.pin.trim() !== expectedPin) {
      return NextResponse.json(
        { ok: false, error: "รหัส PIN ไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    const token = createAdminSessionToken(expectedPin);
    const res = NextResponse.json({ ok: true, authenticated: true });
    res.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
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
  return res;
}
