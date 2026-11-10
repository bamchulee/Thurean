import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createOrderRecord,
  getAllDatabase,
  getRuntimeConfig,
} from "../../../lib/sheets-db";
import { isAdminRequest, unauthorizedResponse } from "../../../lib/admin-auth";
import {
  buildOrderAlertForAdmin,
  pushLineMessage,
} from "../../../lib/line-notify";
import { shopInfo } from "../../../data/mock";
import type { Order, OrderItem } from "../../../types/durian";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  try {
    const { data, source, warning } = await getAllDatabase();
    return NextResponse.json({
      ok: true,
      source,
      warning,
      orders: data.orders,
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
    const body = (await req.json()) as {
      customerName?: string;
      phone?: string;
      address?: string;
      ripenessPref?: string;
      shippingMethod?: string;
      lineUserId?: string;
      roundId?: string;
      notes?: string;
      items?: { productId: string; qty: number }[];
    };

    if (!body.customerName?.trim() || !body.phone?.trim() || !body.address?.trim()) {
      return NextResponse.json(
        { ok: false, error: "กรุณากรอกชื่อ เบอร์โทร และที่อยู่จัดส่งให้ครบถ้วน" },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "กรุณาเลือกสินค้าอย่างน้อย 1 รายการ" },
        { status: 400 }
      );
    }

    const { data } = await getAllDatabase();

    // Server-side price lookup & calculation (prevent client tampering)
    const verifiedItems: OrderItem[] = [];
    let totalPrice = 0;

    for (const reqItem of body.items) {
      const prod = data.products.find((p) => p.id === reqItem.productId);
      if (!prod) {
        return NextResponse.json(
          { ok: false, error: `ไม่พบสินค้า ${reqItem.productId}` },
          { status: 400 }
        );
      }
      if (!prod.isAvailable) {
        return NextResponse.json(
          { ok: false, error: `สินค้า "${prod.name}" ปิดรับออเดอร์ชั่วคราว` },
          { status: 400 }
        );
      }
      const qty = Math.max(1, Math.floor(Number(reqItem.qty) || 1));
      verifiedItems.push({
        productId: prod.id,
        productName: prod.name,
        qty,
        price: prod.price,
      });
      totalPrice += prod.price * qty;
    }

    const shipMethod =
      shopInfo.shippingMethods.find((s) => s.name === body.shippingMethod) ||
      shopInfo.shippingMethods[0];

    const activeRound =
      data.rounds.find((r) => r.id === body.roundId) ||
      data.rounds.find((r) => r.status === "open") ||
      data.rounds[0];

    const newOrder: Order = {
      id: `WK-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString(),
      roundId: activeRound?.id || "WK-ROUND-46",
      customerName: body.customerName.trim(),
      phone: body.phone.trim(),
      address: body.address.trim(),
      lineUserId: body.lineUserId?.trim() || undefined,
      ripenessPref: body.ripenessPref || "กรอบนอกนุ่มใน (ไก่ฉีก)",
      items: verifiedItems,
      totalPrice,
      shippingMethod: shipMethod.name,
      shippingCost: shipMethod.price,
      paymentStatus: "pending",
      orderStatus: "received",
      notes: body.notes?.trim() || undefined,
    };

    const created = await createOrderRecord(newOrder);

    // Send LINE Alert to Admin if configured
    const cfg = getRuntimeConfig();
    if (cfg.lineChannelAccessToken && cfg.lineAdminUserId) {
      await pushLineMessage(
        cfg.lineAdminUserId,
        buildOrderAlertForAdmin(created),
        cfg.lineChannelAccessToken
      );
    }

    return NextResponse.json({ ok: true, order: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
