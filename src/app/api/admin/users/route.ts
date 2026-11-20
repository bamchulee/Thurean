import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAllUsers, updateUserRecord } from "../../../../lib/sheets-db";
import { toSafeUser } from "../../../../lib/user-auth";
import { requireAdmin, requireSuperAdmin, unauthorizedResponse } from "../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) {
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

// แก้สิทธิ์ / ปิดบัญชี — เฉพาะ SUPERADMIN (หน้าจัดการสิทธิ์)
export async function PATCH(req: NextRequest) {
  try {
    if (!(await requireSuperAdmin(req))) {
      return unauthorizedResponse();
    }

    const body = (await req.json()) as {
      userId?: string;
      role?: string;
      isActive?: number | boolean;
      notes?: string;
    };
    if (!body.userId) {
      return NextResponse.json(
        { ok: false, error: "กรุณาระบุ userId" },
        { status: 400 }
      );
    }

    // SUPERADMIN กำหนดได้ที่ชีต Users เท่านั้น — หน้าเว็บตั้งให้ใคร หรือแก้/ปิดบัญชี SUPERADMIN ไม่ได้
    if (body.role === "superadmin") {
      return NextResponse.json({ ok: false, error: "ตั้ง SUPERADMIN ได้ที่ชีต Users เท่านั้น" }, { status: 400 });
    }
    const all = await getAllUsers();
    const target = all.find((u) => u.id === body.userId || u.userId === body.userId);
    if (target?.role === "superadmin" && (body.role !== undefined || body.isActive !== undefined)) {
      return NextResponse.json({ ok: false, error: "บัญชี SUPERADMIN แก้สิทธิ์ได้ที่ชีต Users เท่านั้น" }, { status: 400 });
    }

    const updates: Partial<Parameters<typeof updateUserRecord>[1]> = {};
    if (body.role && ["user", "staff", "admin"].includes(body.role)) {
      updates.role = body.role as "user" | "staff" | "admin";
    }
    if (body.isActive !== undefined) {
      updates.isActive = (body.isActive === 0 || (body.isActive as any) === "0" || body.isActive === false) ? 0 : 1;
    }
    if (body.notes !== undefined) {
      updates.notes = body.notes;
    }

    const updated = await updateUserRecord(body.userId, updates);
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "ไม่พบข้อมูลผู้ใช้ที่ต้องการอัปเดต" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      user: toSafeUser(updated),
      message: `อัปเดตข้อมูลผู้ใช้ ${updated.displayName || updated.firstName || updated.username} เรียบร้อยแล้ว`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
