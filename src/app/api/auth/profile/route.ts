import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserById, updateUserRecord } from "../../../../lib/sheets-db";
import { verifySessionToken, toSafeUser } from "../../../../lib/user-auth";

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
    if (body.lastName) updates.lastName = String(body.lastName).trim();
    if (body.phone) updates.phone = String(body.phone).trim().replace(/[^0-9]/g, "");
    if (body.address) updates.address = String(body.address).trim();
    if (body.postalCode) updates.postalCode = String(body.postalCode).trim().replace(/[^0-9]/g, "");
    if (body.avatarUrl !== undefined) updates.avatarUrl = String(body.avatarUrl).trim();

    const updated = await updateUserRecord(user.id, updates);
    if (!updated) {
      return NextResponse.json({ ok: false, error: "อัปเดตไม่สำเร็จ" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      user: toSafeUser(updated),
      message: "อัปเดตข้อมูลสำเร็จ",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
