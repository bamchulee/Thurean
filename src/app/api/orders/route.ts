import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAllDatabase } from "../../../lib/sheets-db";
import { getAdminOperatorName, getCurrentUser, requireStaff, unauthorizedResponse } from "../../../lib/admin-auth";
import { submitNewOrder } from "../../../lib/order-service";
import type { SubmitOrderInput } from "../../../lib/order-service";
import { isOwnOrder } from "../../../lib/order-access";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { data, source, warning } = await getAllDatabase();

    // 1. พนักงาน / เจ้าของร้าน: ดูได้ทุกคำสั่งซื้อ
    if ((await requireStaff(req))) {
      return NextResponse.json({
        ok: true,
        source,
        warning,
        orders: data.orders,
      });
    }

    // 2. ลูกค้า: ดูเฉพาะคำสั่งซื้อของตัวเอง (ต้องล็อกอิน — ไม่มีค้นหาด้วยเบอร์โทรแล้ว)
    const user = await getCurrentUser(req);
    if (!user) return unauthorizedResponse();
    return NextResponse.json({
      ok: true,
      source,
      orders: data.orders.filter((o) => isOwnOrder(o, user)),
      user: { id: user.id, name: user.displayName || user.firstName },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = (await req.json()) as Omit<SubmitOrderInput, "items"> & {
      lineAccessToken?: string;
      items?: { productId?: string; qty?: number; ripenessPref?: string; price?: number }[];
    };
    const isAdmin = (await requireStaff(req));

    let targetUserId: string | undefined = undefined;
    let targetLineUserId: string | undefined = undefined;

    if (isAdmin) {
      targetUserId = raw.userId;
      targetLineUserId = raw.lineUserId;
    } else {
      // ลูกค้าต้องล็อกอิน และผูก LINE แล้ว (รับยอด/QR/สถานะทาง LINE) — ไม่เชื่อ userId จากเบราว์เซอร์
      const user = await getCurrentUser(req);
      if (!user) {
        return NextResponse.json(
          { ok: false, code: "LOGIN_REQUIRED", error: "กรุณาเข้าสู่ระบบก่อนสั่งซื้อ" },
          { status: 401 }
        );
      }
      if (!user.lineUserId) {
        return NextResponse.json(
          { ok: false, code: "LINE_REQUIRED", error: "กรุณาเชื่อมบัญชี LINE ก่อนสั่งซื้อ เพื่อรับยอดเงินและสถานะออเดอร์ทาง LINE" },
          { status: 403 }
        );
      }
      targetUserId = user.id;
      targetLineUserId = user.lineUserId;
    }

    // ลูกค้าส่งได้แค่ข้อมูลผู้รับ + รายการสินค้า — ราคา ค่าส่ง สถานะ คิดฝั่งเซิร์ฟเวอร์เท่านั้น
    const input: SubmitOrderInput = {
      customerName: raw.customerName,
      phone: raw.phone,
      address: raw.address,
      ripenessPref: raw.ripenessPref,
      shippingMethod: raw.shippingMethod,
      roundId: raw.roundId,
      notes: typeof raw.notes === "string" ? raw.notes.slice(0, 500) : undefined,
      items: Array.isArray(raw.items)
        ? raw.items.slice(0, 20).map((it) => ({
            productId: String(it.productId || ""),
            qty: Number(it.qty) || 1,
            ripenessPref: it.ripenessPref,
            ...(isAdmin && typeof it.price === "number" ? { price: it.price } : {}),
          }))
        : [],
      userId: targetUserId,
      lineUserId: targetLineUserId,
      createdBy: isAdmin ? getAdminOperatorName(req) : targetUserId || "customer",
      ...(isAdmin
        ? {
            channel: raw.channel,
            shippingCost: raw.shippingCost,
            courier: raw.courier,
            vehicleType: raw.vehicleType,
            paymentStatus: raw.paymentStatus,
            orderStatus: raw.orderStatus,
          }
        : {}),
    };
    const res = await submitNewOrder(input, { trusted: isAdmin });
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
