import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, USER_COOKIE_NAME, isAdminRequest } from "../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    ok: true,
    authenticated: isAdminRequest(req),
  });
}

// ระบบจัดการหลังบ้านยกเลิกการใช้รหัส PIN — เข้าสู่ระบบผ่าน LINE Login สำหรับบัญชีแอดมินเท่านั้น
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "ระบบยกเลิกการใช้รหัส PIN แล้ว กรุณาเข้าสู่ระบบด้วยบัญชี LINE ของแอดมิน",
    },
    { status: 403 }
  );
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true, authenticated: false });
  res.cookies.delete(ADMIN_COOKIE_NAME);
  res.cookies.delete(USER_COOKIE_NAME);
  return res;
}
