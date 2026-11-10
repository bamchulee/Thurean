// ============================================================
// Admin Session Verification Helper
// ============================================================
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdminSessionToken } from "./sheets-db";

export const ADMIN_COOKIE_NAME = "winkin_admin_token";

export function isAdminRequest(req: NextRequest): boolean {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { ok: false, error: "Unauthorized — กรุณาเข้าสู่ระบบ Admin ก่อน" },
    { status: 401 }
  );
}
