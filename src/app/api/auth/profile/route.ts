import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserById, updateUserRecord } from "../../../../lib/sheets-db";
import { verifySessionToken, toSafeUser, createSessionToken } from "../../../../lib/user-auth";
import { inThailand, mapsLink } from "../../../../lib/thai-address";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  try {
    const cookieToken = req.cookies.get("winkin_user_token")?.value;
    const authHeader = req.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : undefined;

    const token = cookieToken || bearerToken;
    if (!token) {
      return NextResponse.json({ ok: false, error: "ไม่ได้เข้าสู่ระบบ" }, { status: 401 });
    }

    const session = verifySessionToken(token);
    if (!session || !session.id) {
      return NextResponse.json({ ok: false, error: "เซสชันหมดอายุ" }, { status: 401 });
    }

    const user = await getUserById(session.id);
    if (!user) {
      return NextResponse.json({ ok: false, error: "ไม่พบผู้ใช้" }, { status: 404 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.firstName) updates.firstName = String(body.firstName).trim();
    if (body.lastName !== undefined) updates.lastName = String(body.lastName).trim();
    if (body.displayName) updates.displayName = String(body.displayName).trim();
    if (body.phone) updates.phone = String(body.phone).trim().replace(/[^0-9]/g, "");
    if (body.address) updates.address = String(body.address).trim();
    if (body.postalCode) updates.postalCode = String(body.postalCode).trim().replace(/[^0-9]/g, "");
    if (body.avatarUrl !== undefined) updates.avatarUrl = String(body.avatarUrl).trim();
    // หมุดจากฟอร์มที่อยู่ (ใช้ซ้ำตอนสั่งครั้งหน้า)
    if (inThailand(Number(body.latitude), Number(body.longitude))) {
      updates.latitude = Math.round(Number(body.latitude) * 1e6) / 1e6;
      updates.longitude = Math.round(Number(body.longitude) * 1e6) / 1e6;
      updates.mapsUrl = mapsLink(Number(body.latitude), Number(body.longitude));
    }

    const updated = await updateUserRecord(user.id, {
      ...updates,
      lineUserId: user.lineUserId,
    });
    if (!updated) {
      return NextResponse.json({ ok: false, error: "อัปเดตไม่สำเร็จ" }, { status: 500 });
    }

    const safe = toSafeUser(updated);
    const newToken = createSessionToken(safe);

    const res = NextResponse.json({
      ok: true,
      user: safe,
      message: "อัปเดตข้อมูลสำเร็จ",
    });

    res.cookies.set("winkin_user_token", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return res;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
