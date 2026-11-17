import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSessionToken, toSafeUser } from "../../../../lib/user-auth";
import { USER_COOKIE_NAME } from "../../../../lib/admin-auth";
import { verifyLineAccessToken } from "../../../../lib/line-verify";
import { signInWithIdentity } from "../../../../lib/auth-identity";

export const dynamic = "force-dynamic";

// ล็อกอินจากในแอป LINE (LIFF): ตัวตนมาจาก access token ที่ LINE ยืนยันแล้วเท่านั้น
// ค่า lineUserId / displayName ที่เบราว์เซอร์ส่งมาจะไม่ถูกใช้ระบุตัวตน
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { accessToken?: string };

    const profile = await verifyLineAccessToken(body.accessToken);
    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "ยืนยันตัวตนกับ LINE ไม่สำเร็จ กรุณากดเข้าสู่ระบบด้วย LINE อีกครั้ง" },
        { status: 401 }
      );
    }

    const result = await signInWithIdentity({
      provider: "line",
      providerId: profile.userId,
      displayName: profile.displayName,
      avatarUrl: profile.pictureUrl,
    });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 409 });

    const safe = toSafeUser(result.user);
    const res = NextResponse.json({ ok: true, user: safe });
    res.cookies.set(USER_COOKIE_NAME, createSessionToken(safe), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
  } catch (err) {
    return NextResponse.json({ ok: false, error: `เกิดข้อผิดพลาด: ${String(err)}` }, { status: 500 });
  }
}
