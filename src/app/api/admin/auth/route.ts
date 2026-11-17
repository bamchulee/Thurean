import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, USER_COOKIE_NAME, getCurrentUser } from "../../../../lib/admin-auth";
import { toSafeUser } from "../../../../lib/user-auth";

export const dynamic = "force-dynamic";

// หลังบ้านใช้ได้เฉพาะสมาชิกที่มีสิทธิ์ staff / admin ในชีต Users (เข้าระบบด้วย LINE / Google)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  const role = user?.role === "admin" || user?.role === "staff" ? user.role : null;
  return NextResponse.json({
    ok: true,
    authenticated: Boolean(role),
    role,
    user: user ? toSafeUser(user) : null,
  });
}

// ไม่มีการเข้าด้วยรหัส PIN แล้ว
export async function POST() {
  return NextResponse.json(
    { ok: false, error: "เข้าหลังบ้านด้วยบัญชีที่ได้รับสิทธิ์พนักงาน/เจ้าของร้านเท่านั้น" },
    { status: 403 }
  );
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true, authenticated: false });
  res.cookies.delete(ADMIN_COOKIE_NAME);
  res.cookies.delete(USER_COOKIE_NAME);
  return res;
}
