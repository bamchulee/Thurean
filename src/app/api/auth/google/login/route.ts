import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { startOAuth } from "../../../../../lib/oauth";
import { GOOGLE_LOGIN_ENABLED } from "../../../../../lib/feature-flags";

export const dynamic = "force-dynamic";

// เข้าสู่ระบบด้วย Google ปิดไว้ก่อน — เข้าลิงก์นี้ตรง ๆ ก็พากลับหน้าร้าน
export function GET(req: NextRequest) {
  if (!GOOGLE_LOGIN_ENABLED) return NextResponse.redirect(new URL("/", req.url));
  return startOAuth(req, "google");
}
