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
import type { OrderStatus, PaymentStatus } from "../../../../types/durian";

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

// Admin update order (paymentStatus, orderStatus, trackingNo, lotId, notifyLine)
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  try {
    const { id } = await context.params;
    const orderId = decodeURIComponent(id);
    const body = (await req.json()) as {
      paymentStatus?: PaymentStatus;
      orderStatus?: OrderStatus;
      trackingNo?: string;
      courier?: string;
      slipUrl?: string;
      lotId?: string;
      notes?: string;
      notifyLine?: boolean;
    };

    const updates: Record<string, unknown> = {};
    if (body.paymentStatus !== undefined) updates.paymentStatus = body.paymentStatus;
    if (body.orderStatus !== undefined) updates.orderStatus = body.orderStatus;
    if (body.trackingNo !== undefined) updates.trackingNo = body.trackingNo.trim();
    if (body.courier !== undefined) {
      updates.courier = body.courier.trim();
    } else if (body.trackingNo) {
      updates.courier = resolveCourierInfo(body.trackingNo.trim()).name;
    }
    if ((body as any).weightPerItem !== undefined) updates.weightPerItem = (body as any).weightPerItem;
    if ((body as any).totalPrice !== undefined) {
      updates.totalPrice = Number((body as any).totalPrice);
      updates.grandTotal = Number((body as any).totalPrice) + Number((body as any).shippingCost || 0);
    }
    if ((body as any).pricePerItem !== undefined) updates.pricePerItem = Number((body as any).pricePerItem);
    if ((body as any).quantity !== undefined) updates.quantity = Number((body as any).quantity);
    if ((body as any).channel !== undefined) updates.channel = (body as any).channel;
    if ((body as any).vehicleType !== undefined) updates.vehicleType = (body as any).vehicleType;
    if ((body as any).productType !== undefined) updates.productType = (body as any).productType;
    if (body.slipUrl !== undefined) updates.slipUrl = body.slipUrl.trim();
    if (body.lotId !== undefined) updates.lotId = body.lotId.trim();
    if (body.notes !== undefined) updates.notes = body.notes;
    if ((body as any).isActive !== undefined) {
      updates.isActive = ((body as any).isActive === 0 || (body as any).isActive === "0" || (body as any).isActive === false) ? 0 : 1;
    }
    updates.updatedBy = (body as any).updatedBy?.trim() || getAdminOperatorName(req);
    updates.updatedAt = new Date().toISOString();

    const updated = await updateOrderRecord(orderId, updates);
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "ไม่พบคำสั่งซื้อนี้" },
        { status: 404 }
      );
    }

    let lineResult: { sent: boolean; reason?: string } | undefined;
    if (body.notifyLine && updated.lineUserId) {
      const cfg = getRuntimeConfig();
      lineResult = await pushLineMessage(
        updated.lineUserId,
        buildCustomerStatusFlex(updated),
        cfg.lineChannelAccessToken
      );
    }

    return NextResponse.json({
      ok: true,
      order: updated,
      lineResult,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
