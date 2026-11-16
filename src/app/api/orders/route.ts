import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAllDatabase } from "../../../lib/sheets-db";
import { isAdminRequest, unauthorizedResponse } from "../../../lib/admin-auth";
import { submitNewOrder } from "../../../lib/order-service";
import type { SubmitOrderInput } from "../../../lib/order-service";
import { getSessionUser, verifyLineAccessToken } from "../../../lib/line-verify";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const phoneQuery = url.searchParams.get("phone")?.trim();
    const cleanPhone = (p?: string) => (p || "").replace(/[^\d]/g, "");

    const { data, source, warning } = await getAllDatabase();

    // 1. แอดมิน: ดูได้ทุกคำสั่งซื้อ
    if (isAdminRequest(req)) {
      return NextResponse.json({
        ok: true,
        source,
        warning,
        orders: data.orders,
      });
    }

    // 2. ลูกค้าที่ล็อกอินอยู่: ดูเฉพาะประวัติคำสั่งซื้อของตนเอง
    const session = getSessionUser(req);
    if (session) {
      const userOrders = data.orders.filter(
        (o) =>
          (o.userId && (o.userId === session.id || o.userId === session.userId)) ||
          (session.lineUserId && o.lineUserId === session.lineUserId) ||
          (session.phone && o.phone && cleanPhone(session.phone) === cleanPhone(o.phone))
      );
      return NextResponse.json({
        ok: true,
        source,
        orders: userOrders,
        user: { id: session.id, name: session.displayName || session.firstName },
      });
    }

    // 3. ค้นหาด้วยเบอร์โทรศัพท์ (สำหรับผู้ใช้ทั่วไป / ไม่ได้ล็อกอิน)
    if (phoneQuery && cleanPhone(phoneQuery).length >= 9) {
      const targetPhone = cleanPhone(phoneQuery);
      const matched = data.orders.filter(
        (o) => o.phone && cleanPhone(o.phone) === targetPhone
      );
      // Mask เบอร์เพื่อความปลอดภัย
      const safeOrders = matched.map((o) => ({
        ...o,
        phone: o.phone.length >= 4 ? o.phone.slice(0, -4) + "XXXX" : o.phone,
        address: undefined,
      }));
      return NextResponse.json({
        ok: true,
        orders: safeOrders,
      });
    }

    return unauthorizedResponse();
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = (await req.json()) as SubmitOrderInput & { lineAccessToken?: string };
    const isAdmin = isAdminRequest(req);

    let targetUserId: string | undefined = undefined;
    let targetLineUserId: string | undefined = undefined;

    if (isAdmin) {
      targetUserId = raw.userId;
      targetLineUserId = raw.lineUserId;
    } else {
      // ไม่เชื่อ userId / lineUserId จากเบราว์เซอร์ลูกค้า — ระบุตัวตนจาก session หรือ token ที่ LINE ยืนยันแล้ว
      const session = getSessionUser(req);
      const lineProfile = session ? null : await verifyLineAccessToken(raw.lineAccessToken);
      targetUserId = session?.id;
      targetLineUserId = session?.lineUserId || lineProfile?.userId;
    }

    const res = await submitNewOrder({
      ...raw,
      userId: targetUserId,
      lineUserId: targetLineUserId,
      createdBy: isAdmin ? "admin" : (targetUserId || "customer"),
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: res.error },
        { status: res.status }
      );
    }
    return NextResponse.json({ ok: true, order: res.order }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
