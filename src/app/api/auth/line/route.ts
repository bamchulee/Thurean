import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { upsertLineUser } from "../../../../lib/sheets-db";
import { createSessionToken, toSafeUser } from "../../../../lib/user-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      lineUserId,
      displayName,
      pictureUrl,
      phone,
      address,
      postalCode,
    } = body;

    if (!displayName && !lineUserId) {
      return NextResponse.json(
        { ok: false, error: "กรุณาระบุข้อมูล LINE ให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const user = await upsertLineUser({
      lineUserId,
      displayName,
      avatarUrl: pictureUrl,
      phone,
      address,
      postalCode,
      source: "line-login",
      notes: "เข้าสู่ระบบผ่าน LINE Login หน้าร้าน",
    });

    const safe = toSafeUser(user);
    const token = createSessionToken(safe);

    const res = NextResponse.json({
      ok: true,
      user: safe,
    });

    res.cookies.set("winkin_user_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return res;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `เกิดข้อผิดพลาด: ${String(err)}` },
      { status: 500 }
    );
  }
}
