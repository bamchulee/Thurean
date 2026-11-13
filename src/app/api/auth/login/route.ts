import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserByUsername } from "../../../../lib/sheets-db";
import {
  verifyPassword,
  createSessionToken,
  toSafeUser,
} from "../../../../lib/user-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    const cleanUsername = String(username || "").trim();
    const cleanPassword = String(password || "").trim();

    if (!cleanUsername || !cleanPassword) {
      return NextResponse.json(
        { ok: false, error: "กรุณากรอกชื่อผู้ใช้ (หรือเบอร์โทร) และรหัสผ่าน" },
        { status: 400 }
      );
    }

    const user = await getUserByUsername(cleanUsername);
    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { ok: false, error: "ไม่พบชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    const isValid = verifyPassword(cleanPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { ok: false, error: "ไม่พบชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    const safe = toSafeUser(user);
    const token = createSessionToken(safe);

    const response = NextResponse.json({
      ok: true,
      user: safe,
      token,
      message: `ยินดีต้อนรับกลับ คุณ${user.firstName}!`,
    });

    response.cookies.set("winkin_user_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `เกิดข้อผิดพลาดในการเข้าสู่ระบบ: ${String(err)}` },
      { status: 500 }
    );
  }
}
