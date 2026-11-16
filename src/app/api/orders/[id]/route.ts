import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getAllDatabase,
  getRuntimeConfig,
  updateOrderRecord,
} from "../../../../lib/sheets-db";
import { isAdminRequest, unauthorizedResponse, getAdminOperatorName } from "../../../../lib/admin-auth";
import {
  buildCustomerStatusFlex,
  pushLineMessage,
} from "../../../../lib/line-notify";
import { resolveCourierInfo } from "../../../../lib/courier";
import { findOrderById } from "../../../../lib/ids";
import { setOrderStatus, weighOrder, type WeighInput } from "../../../../lib/order-workflow";
import { normalizeOrderStatus, orderStatusOf } from "../../../../lib/order-status";
import type { Order } from "../../../../types/durian";

export const dynamic = "force-dynamic";

// Lookup by Order ID or Tracking Number (full details for authenticated Admin, masked PII for public tracking)
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const q = decodeURIComponent(id).trim().toUpperCase();
    const { data } = await getAllDatabase();

    const order =
      data.orders.find(
        (o) =>
          o.id.toUpperCase() === q ||
          (o.trackingNo && o.trackingNo.toUpperCase() === q)
      ) || findOrderById(data.orders, q);

    if (!order) {
      return NextResponse.json(
        { ok: false, error: "ไม่พบคำสั่งซื้อหรือเลขพัสดุนี้ในระบบ" },
        { status: 404 }
      );
    }

    const courierInfo = resolveCourierInfo(
      order.trackingNo,
      order.courier,
      order.shippingMethod
    );

    if (isAdminRequest(req)) {
      return NextResponse.json({ ok: true, order, courierInfo, isAdmin: true });
    }

    // Mask phone and omit full street address for public tracking privacy
    const maskedPhone =
      order.phone.length >= 4
        ? order.phone.slice(0, -4) + "XXXX"
        : order.phone;

    return NextResponse.json({
      ok: true,
      order: {
        ...order,
        phone: maskedPhone,
        address: undefined,
      },
      courierInfo,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

// แอดมินแก้ออเดอร์
// - weigh: { itemKgs | totalKg | fruitKgs } → ชั่ง คิดยอดจริง ส่ง QR (order-workflow.weighOrder)
// - orderStatus: เดินหน้าทีละขั้นผ่าน order-workflow (แจ้งลูกค้าทาง LINE เอง, ยกเลิกคืนสต็อก)
// - ช่องอื่น (เลขพัสดุ ล็อต หมายเหตุ สลิป isActive) บันทึกตรง
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  try {
    const { id } = await context.params;
    const orderId = decodeURIComponent(id);
    const body = (await req.json()) as {
      weigh?: WeighInput;
      orderStatus?: string;
      paymentStatus?: string;
      trackingNo?: string;
      courier?: string;
      slipUrl?: string;
      lotId?: string;
      notes?: string;
      cancelReason?: string;
      isActive?: number | string | boolean;
      notifyLine?: boolean;
    };
    const actor = getAdminOperatorName(req);
    const { data } = await getAllDatabase(true);
    let order = findOrderById(data.orders, orderId);
    if (!order) {
      return NextResponse.json({ ok: false, error: "ไม่พบคำสั่งซื้อนี้" }, { status: 404 });
    }

    // 1) ชั่งน้ำหนัก
    if (body.weigh) {
      const res = await weighOrder(order.id, body.weigh, actor);
      if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
      return NextResponse.json({ ok: true, order: res.order });
    }

    // 2) ช่องข้อมูลทั่วไป (ไม่กระทบสถานะ)
    const updates: Partial<Order> = {};
    if (body.trackingNo !== undefined) updates.trackingNo = body.trackingNo.trim();
    if (body.courier !== undefined) updates.courier = body.courier.trim();
    else if (body.trackingNo?.trim()) updates.courier = resolveCourierInfo(body.trackingNo.trim()).name;
    if (body.slipUrl !== undefined) updates.slipUrl = body.slipUrl.trim();
    if (body.lotId !== undefined) updates.lotId = body.lotId.trim();
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.isActive !== undefined) {
      updates.isActive = body.isActive === 0 || body.isActive === "0" || body.isActive === false ? 0 : 1;
    }
    if (Object.keys(updates).length > 0) {
      await updateOrderRecord(order.id, { ...updates, updatedBy: actor });
      order = { ...order, ...updates };
    }

    // 3) เปลี่ยนสถานะ
    if (body.orderStatus) {
      const next = normalizeOrderStatus(body.orderStatus);
      if (next !== orderStatusOf(order)) {
        const res = await setOrderStatus(
          order.id,
          next,
          { trackingNo: updates.trackingNo, courier: updates.courier, cancelReason: body.cancelReason },
          actor
        );
        if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
        return NextResponse.json({ ok: true, order: res.order });
      }
    }

    // ส่งการ์ดสถานะซ้ำให้ลูกค้า (กรณีแก้เลขพัสดุ ฯลฯ)
    let lineResult: { sent: boolean; reason?: string } | undefined;
    if (body.notifyLine && order.lineUserId) {
      lineResult = await pushLineMessage(
        order.lineUserId,
        buildCustomerStatusFlex(order),
        getRuntimeConfig().lineChannelAccessToken
      );
    }
    return NextResponse.json({ ok: true, order, lineResult });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
