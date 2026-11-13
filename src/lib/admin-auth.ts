// ============================================================
// Admin Session Verification Helper (PIN Session & User Role Session)
// ============================================================
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdminSessionToken } from "./sheets-db";
import { verifySessionToken } from "./user-auth";

export const ADMIN_COOKIE_NAME = "winkin_admin_token";
export const USER_COOKIE_NAME = "winkin_user_token";

export function isAdminRequest(req: NextRequest): boolean {
  // 1. Check direct admin PIN session token
  const adminToken = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (adminToken && verifyAdminSessionToken(adminToken)) {
    return true;
  }

  // 2. Check user session token for role: "admin"
  const userToken = req.cookies.get(USER_COOKIE_NAME)?.value;
  if (userToken) {
    const session = verifySessionToken(userToken);
    if (session && session.role === "admin") {
      return true;
    }
  }

  return false;
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { ok: false, error: "Unauthorized — เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น" },
    { status: 401 }
  );
}
