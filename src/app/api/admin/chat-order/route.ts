import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminOperatorName, requireStaff, unauthorizedResponse } from "../../../../lib/admin-auth";
import { getAllDatabase, getRuntimeConfig, updateOrderRecord } from "../../../../lib/sheets-db";
import { submitNewOrder } from "../../../../lib/order-service";
import { buildBookingReceiptFlex, buildPaymentQrForCustomerFlex, pushLineMessage } from "../../../../lib/line-notify";
import type { Order, OrderItem } from "../../../../types/durian";

export const dynamic = "force-dynamic";

// ============================================================
// แอดมินสร้างออเดอร์ให้ลูกค้าที่คุยในแชท (สั่งแบบพูดคุย ไม่ผ่านปุ่ม)
// แต่ละรายการเลือกวิธีคิดเงิน: รอชั่ง / ชั่งแล้ว (กก. × ราคา/กก.) / ราคาเหมา
// ทุกรายการมีราคาแล้ว → ออเดอร์ขึ้น "รอชำระเงิน" + ส่งสรุปยอดพร้อม QR ทาง LINE ทันที
// ============================================================

type Line = {
  productId: string;
  qty: number;
  ripeness?: string;
  mode: "weigh" | "kg" | "lump";
  totalKg?: number;
  pricePerKg?: number;
  amount?: number;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** ดึงชื่อ/เบอร์/ที่อยู่ของลูกค้า LINE มาเติมฟอร์ม */
export async function GET(req: NextRequest) {
  if (!(await requireStaff(req))) return unauthorizedResponse();
  const lineUserId = req.nextUrl.searchParams.get("lineUserId") || "";
  const { data } = await getAllDatabase();
  const u = lineUserId ? (data.users || []).find((x) => x.lineUserId === lineUserId) : undefined;
  if (!u) return NextResponse.json({ ok: true, customer: lineUserId ? { lineUserId } : null });
  const name = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.displayName || "";
  return NextResponse.json({
    ok: true,
    customer: { lineUserId, userId: u.id, name, phone: u.phone || "", address: u.postalCode && !(u.address || "").includes(u.postalCode) ? `${u.address || ""} ${u.postalCode}`.trim() : (u.address || "").trim() },
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireStaff(req))) return unauthorizedResponse();
  try {
    const body = (await req.json()) as {
      lineUserId?: string;
      userId?: string;
      customerName?: string;
      phone?: string;
      address?: string;
      shippingMethod?: string;
      shippingCost?: number;
      notes?: string;
      lines?: Line[];
      send?: boolean;
    };
    const lines = (body.lines || []).filter((l) => l.productId && num(l.qty) > 0).slice(0, 20);
    if (lines.length === 0) return NextResponse.json({ ok: false, error: "เพิ่มสินค้าอย่างน้อย 1 รายการ" }, { status: 400 });
    for (const l of lines) {
      if (l.mode === "kg" && (num(l.totalKg) <= 0 || num(l.pricePerKg) <= 0)) {
        return NextResponse.json({ ok: false, error: "รายการแบบชั่งแล้ว ต้องกรอกน้ำหนักรวมและราคาต่อกิโล" }, { status: 400 });
      }
      if (l.mode === "lump" && num(l.amount) <= 0) {
        return NextResponse.json({ ok: false, error: "รายการแบบราคาเหมา ต้องกรอกยอดเงิน" }, { status: 400 });
      }
    }
    const actor = getAdminOperatorName(req);
    const shippingCost = Math.max(0, num(body.shippingCost));

    // 1) สร้างออเดอร์ (ตัดสต็อก/ออกเลขในชีต) — ยังไม่แจ้งลูกค้า เดี๋ยวแจ้งทีเดียวตอนท้าย
    const res = await submitNewOrder(
      {
        customerName: body.customerName || "",
        phone: body.phone || "",
        address: body.address || "",
        shippingMethod: body.shippingMethod,
        shippingCost,
        notes: body.notes?.slice(0, 500),
        userId: body.userId,
        lineUserId: body.lineUserId || undefined,
        channel: "LINE (แอดมินคีย์จากแชท)",
        createdBy: actor,
        items: lines.map((l) => ({ productId: l.productId, qty: Math.floor(num(l.qty)), ripenessPref: l.ripeness })),
      },
      { trusted: true, skipCustomerNotify: true }
    );
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
    let order: Order = res.order;

    // 2) ใส่ราคาตามที่แอดมินคิด
    const priced = lines.every((l) => l.mode !== "weigh");
    if (priced) {
      let totalPrice = 0;
      let totalKg = 0;
      const items: OrderItem[] = order.items.map((it, i) => {
        const l = lines[i];
        if (l.mode === "kg") {
          const kg = Math.round(num(l.totalKg) * 100) / 100;
          const perKg = num(l.pricePerKg);
          totalKg += kg;
          totalPrice += Math.round(kg * perKg);
          return { ...it, actualWeightKg: kg, pricePerKg: perKg, price: perKg };
        }
        const amount = Math.round(num(l.amount));
        totalPrice += amount;
        return { ...it, lineTotal: amount, price: Math.round((amount / Math.max(1, it.qty)) * 100) / 100 };
      });
      const patch: Partial<Order> = {
        items,
        totalPrice,
        grandTotal: totalPrice + (order.shippingCost || 0),
        orderStatus: "รอชำระเงิน",
        paymentStatus: "pending",
        weighedAt: new Date().toISOString(),
        updatedBy: actor,
        updatedAt: new Date().toISOString(),
        ...(totalKg > 0 ? { weightPerItem: `${Math.round((totalKg / Math.max(1, order.quantity || 1)) * 100) / 100} กก.` } : {}),
      };
      await updateOrderRecord(order.id, patch);
      order = { ...order, ...patch };
    }

    // 3) แจ้งลูกค้าทาง LINE
    let sent = false;
    let sendError: string | undefined;
    if (body.send !== false && order.lineUserId) {
      const cfg = getRuntimeConfig();
      const msgs = priced ? buildPaymentQrForCustomerFlex(order, cfg.publicBaseUrl) : buildBookingReceiptFlex(order);
      const push = await pushLineMessage(order.lineUserId, msgs, cfg.lineChannelAccessToken);
      sent = push.sent;
      if (!push.sent) sendError = push.reason || "LINE ไม่ตอบรับ";
    }
    return NextResponse.json({ ok: true, order, sent, sendError, priced }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
