import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getAllDatabase,
  getRuntimeConfig,
  updateOrderRecord,
} from "../../../../lib/sheets-db";
import { getAdminOperatorName, getCurrentUser, requireStaff, unauthorizedResponse } from "../../../../lib/admin-auth";
import { isOwnOrder } from "../../../../lib/order-access";
import {
  buildCustomerStatusFlex,
  buildPaymentQrForCustomerFlex,
  getLineChatUrl,
  pushLineMessage,
} from "../../../../lib/line-notify";
import { resolveCourierInfo } from "../../../../lib/courier";
import { findOrderById } from "../../../../lib/ids";
import { rejectSlip, setOrderStatus, weighOrder, type WeighInput } from "../../../../lib/order-workflow";
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
    const isAdmin = (await requireStaff(req));
    // เปิดหน้าออเดอร์ทันทีจากแคช (ชีตตอบช้า 3-8 วิ) — หน้าแอดมินขอ ?fresh=1 ตามมาเบื้องหลังเพื่ออ่านสดจากชีต
    const fresh = isAdmin && req.nextUrl.searchParams.get("fresh") === "1";
    const lookup = (orders: Order[]) =>
      orders.find((o) => o.id.toUpperCase() === q || (o.trackingNo && o.trackingNo.toUpperCase() === q)) ||
      findOrderById(orders, q);
    let { data } = await getAllDatabase(fresh);
    let order = lookup(data.orders);
    // ออเดอร์ใหม่ที่แคชเครื่องนี้ยังไม่เห็น → อ่านสดอีกครั้ง
    if (!order && !fresh) {
      ({ data } = await getAllDatabase(true));
      order = lookup(data.orders);
    }

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

    if (isAdmin) {
      const cfg = getRuntimeConfig();
      // หน้าออเดอร์ของแอดมิน: ราคาต่อกิโลปัจจุบันของสินค้าในออเดอร์ + ลิงก์แชทลูกค้าคนนี้
      const products = order.items.map((it) => {
        const p = data.products.find((x) => x.id === it.productId);
        return { id: it.productId, name: p?.name || it.productName, pricePerKg: p?.pricePerKg || it.pricePerKg || 0 };
      });
      const chatUrl = await getLineChatUrl(order.lineUserId, cfg.lineChannelAccessToken);
      return NextResponse.json({ ok: true, order, courierInfo, isAdmin: true, products, chatUrl });
    }

    // ลูกค้า: เปิดได้เฉพาะออเดอร์ของตัวเอง — ของคนอื่นตอบเหมือนไม่มี (ไม่บอกว่าเลขนี้มีอยู่จริง)
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { ok: false, code: "LOGIN_REQUIRED", error: "กรุณาเข้าสู่ระบบด้วยบัญชีที่ใช้สั่งซื้อ" },
        { status: 401 }
      );
    }
    if (!isOwnOrder(order, user)) {
      return NextResponse.json({ ok: false, error: "ไม่พบคำสั่งซื้อนี้ในบัญชีของคุณ" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, order, courierInfo });
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
  if (!(await requireStaff(req))) return unauthorizedResponse();

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
      /** ตีกลับสลิป (ยอดไม่ตรง) → ลูกค้าได้ QR ให้โอนใหม่ */
      rejectSlip?: boolean;
      rejectReason?: string;
      isActive?: number | string | boolean;
      notifyLine?: boolean;
      resendPayment?: boolean;
    };
    const actor = getAdminOperatorName(req);
    const { data } = await getAllDatabase(true);
    let order = findOrderById(data.orders, orderId);
    if (!order) {
      return NextResponse.json({ ok: false, error: "ไม่พบคำสั่งซื้อนี้" }, { status: 404 });
    }

    // ส่งสรุปยอด + QR ให้ลูกค้าอีกครั้ง (ส่งครั้งแรกไม่ถึง / ลูกค้าหาข้อความไม่เจอ)
    if (body.resendPayment) {
      if (orderStatusOf(order) !== "รอชำระเงิน") {
        return NextResponse.json({ ok: false, error: "ส่งยอดได้เฉพาะออเดอร์ที่รอชำระเงิน" }, { status: 400 });
      }
      if (!order.lineUserId) return NextResponse.json({ ok: false, error: "ลูกค้าคนนี้ไม่มี LINE" }, { status: 400 });
      const cfg = getRuntimeConfig();
      const push = await pushLineMessage(order.lineUserId, buildPaymentQrForCustomerFlex(order, cfg.publicBaseUrl), cfg.lineChannelAccessToken);
      if (!push.sent) return NextResponse.json({ ok: false, error: `ส่ง LINE ไม่สำเร็จ: ${push.reason || "LINE ไม่ตอบรับ"}` }, { status: 502 });
      return NextResponse.json({ ok: true, order, lineResult: push });
    }

    if (body.rejectSlip) {
      const res = await rejectSlip(order.id, actor, body.rejectReason || "ยอดในสลิปไม่ตรงกับยอดที่ต้องชำระ");
      if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
      return NextResponse.json({ ok: true, order: res.order });
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
