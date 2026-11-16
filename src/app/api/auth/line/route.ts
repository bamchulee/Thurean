import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createAdminSessionToken,
  getRuntimeConfig,
  recordUserLogin,
  upsertLineUser,
} from "../../../../lib/sheets-db";
import { createSessionToken, toSafeUser } from "../../../../lib/user-auth";
import { ADMIN_COOKIE_NAME } from "../../../../lib/admin-auth";
import { verifyLineAccessToken } from "../../../../lib/line-verify";

export const dynamic = "force-dynamic";

// ล็อกอินจากในแอป LINE (LIFF): ตัวตนมาจาก access token ที่ LINE ยืนยันแล้วเท่านั้น
// ค่า lineUserId / displayName ที่เบราว์เซอร์ส่งมาจะไม่ถูกใช้ระบุตัวตน
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      accessToken?: string;
      phone?: string;
      address?: string;
      postalCode?: string;
    };

    const profile = await verifyLineAccessToken(body.accessToken);
    if (!profile) {
      return NextResponse.json(
        {
          ok: false,
          error: "ยืนยันตัวตนกับ LINE ไม่สำเร็จ กรุณากดเข้าสู่ระบบด้วย LINE อีกครั้ง",
        },
        { status: 401 }
      );
    }

    const user = await upsertLineUser({
      lineUserId: profile.userId,
      displayName: profile.displayName,
      avatarUrl: profile.pictureUrl,
      phone: body.phone,
      address: body.address,
      postalCode: body.postalCode,
      source: "line-login",
      notes: "เข้าสู่ระบบผ่าน LINE (LIFF)",
    });

    await recordUserLogin(user);

    const safe = toSafeUser(user);
    const token = createSessionToken(safe);

    const res = NextResponse.json({ ok: true, user: safe });

    res.cookies.set("winkin_user_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    if (safe.role === "admin") {
      const adminToken = createAdminSessionToken(safe.id || safe.lineUserId || "admin");
      res.cookies.set(ADMIN_COOKIE_NAME, adminToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }

    return res;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `เกิดข้อผิดพลาด: ${String(err)}` },
      { status: 500 }
    );
  }
}
