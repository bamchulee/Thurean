import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAllUsers, updateUserRecord } from "../../../../lib/sheets-db";
import { toSafeUser } from "../../../../lib/user-auth";
import { isAdminRequest, unauthorizedResponse } from "../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!isAdminRequest(req)) {
      return unauthorizedResponse();
    }

    const users = await getAllUsers();
    const safeUsers = users.map((u) => toSafeUser(u));

    return NextResponse.json({
      ok: true,
      users: safeUsers,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!isAdminRequest(req)) {
      return unauthorizedResponse();
    }

    const body = (await req.json()) as { userId?: string; role?: "user" | "admin" };
    if (!body.userId || !body.role || !["user", "admin"].includes(body.role)) {
      return NextResponse.json(
        { ok: false, error: "กรุณาระบุ userId และ role (user หรือ admin)" },
        { status: 400 }
      );
    }

    const updated = await updateUserRecord(body.userId, { role: body.role });
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "ไม่พบข้อมูลผู้ใช้ที่ต้องการอัปเดต" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      user: toSafeUser(updated),
      message: `อัปเดตสิทธิ์ของ ${updated.displayName || updated.firstName || updated.username} เป็น ${body.role === "admin" ? "แอดมิน (Admin)" : "ลูกค้า (User)"} เรียบร้อยแล้ว`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
