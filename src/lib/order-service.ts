// ============================================================
// Shared Order & Claim Business Logic (Web API + LINE Bot)
// ============================================================
import {
  createClaimRecord,
  createOrderRecord,
  getAllDatabase,
  getRuntimeConfig,
  updateOrderRecord,
} from "./sheets-db";
import {
  buildClaimAlertForAdmin,
  buildOrderAlertForAdmin,
  pushLineMessage,
} from "./line-notify";
import { shopInfo } from "../data/mock";
import { resolveCourierInfo } from "./courier";
import type { Claim, Order, OrderItem } from "../types/durian";

export interface SubmitOrderInput {
  customerName?: string;
  phone?: string;
  address?: string;
  ripenessPref?: string;
  shippingMethod?: string;
  lineUserId?: string;
  roundId?: string;
  slipUrl?: string;
  courier?: string;
  notes?: string;
  items?: { productId: string; qty: number; ripenessPref?: string }[];
}

export type SubmitOrderResult =
  | { ok: true; order: Order }
  | { ok: false; error: string; status: number };

export async function submitNewOrder(
  body: SubmitOrderInput
): Promise<SubmitOrderResult> {
  if (!body.customerName?.trim() || !body.phone?.trim() || !body.address?.trim()) {
    return {
      ok: false,
      error: "กรุณากรอกชื่อ เบอร์โทร และที่อยู่จัดส่งให้ครบถ้วน",
      status: 400,
    };
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return {
      ok: false,
      error: "กรุณาเลือกสินค้าอย่างน้อย 1 รายการ",
      status: 400,
    };
  }

  const { data } = await getAllDatabase();

  const verifiedItems: OrderItem[] = [];
  const ripenessSummarySet: string[] = [];
  let totalPrice = 0;

  for (const reqItem of body.items) {
    const prod = data.products.find((p) => p.id === reqItem.productId);
    if (!prod) {
      return {
        ok: false,
        error: `ไม่พบสินค้า ${reqItem.productId}`,
        status: 400,
      };
    }
    if (!prod.isAvailable) {
      return {
        ok: false,
        error: `สินค้า "${prod.name}" ปิดรับออเดอร์ชั่วคราว`,
        status: 400,
      };
    }
    const qty = Math.max(1, Math.floor(Number(reqItem.qty) || 1));
    const itemLabel = reqItem.ripenessPref
      ? `${prod.name} (${reqItem.ripenessPref})`
      : prod.name;
    if (reqItem.ripenessPref) {
      ripenessSummarySet.push(`${prod.variety}: ${reqItem.ripenessPref} x${qty}`);
    }
    verifiedItems.push({
      productId: prod.id,
      productName: itemLabel,
      qty,
      price: prod.price,
    });
    totalPrice += prod.price * qty;
  }

  const shipQuery = (body.shippingMethod || "").trim().toLowerCase();
  const shipMethod =
    shopInfo.shippingMethods.find(
      (s) =>
        s.name.toLowerCase() === shipQuery ||
        (shipQuery && s.name.toLowerCase().includes(shipQuery))
    ) || shopInfo.shippingMethods[0];

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
    ripenessPref:
      body.ripenessPref ||
      (ripenessSummarySet.length > 0
        ? ripenessSummarySet.join(" | ")
        : "กรอบนอกนุ่มใน (ไก่ฉีก)"),
    items: verifiedItems,
    totalPrice,
    shippingMethod: shipMethod.name,
    shippingCost: shipMethod.price,
    paymentStatus: "pending",
    orderStatus: "received",
    courier:
      body.courier?.trim() ||
      resolveCourierInfo(undefined, undefined, shipMethod.name).name,
    slipUrl: body.slipUrl?.trim() || undefined,
    notes: body.notes?.trim() || undefined,
  };

  const created = await createOrderRecord(newOrder);

  const cfg = getRuntimeConfig();
  if (cfg.lineChannelAccessToken && cfg.lineAdminUserId) {
    const messages = buildOrderAlertForAdmin(created);
    if (created.slipUrl && cfg.publicBaseUrl) {
      const fullSlipUrl = `${cfg.publicBaseUrl}${created.slipUrl}`;
      messages.push({
        type: "image",
        originalContentUrl: fullSlipUrl,
        previewImageUrl: fullSlipUrl,
      });
    }
    await pushLineMessage(
      cfg.lineAdminUserId,
      messages,
      cfg.lineChannelAccessToken
    );
  }

  return { ok: true, order: created };
}

export interface SubmitClaimInput {
  orderId?: string;
  phone?: string;
  reason?: string;
  description?: string;
  evidenceName?: string;
}

export type SubmitClaimResult =
  | { ok: true; claim: Claim; matchedOrder?: Order }
  | { ok: false; error: string; status: number };

export async function submitNewClaim(
  body: SubmitClaimInput
): Promise<SubmitClaimResult> {
  if (!body.orderId?.trim() || !body.phone?.trim() || !body.reason?.trim()) {
    return {
      ok: false,
      error: "กรุณากรอกรหัสคำสั่งซื้อ เบอร์โทร และลักษณะปัญหา",
      status: 400,
    };
  }

  const orderIdClean = body.orderId.trim().toUpperCase();
  const { data } = await getAllDatabase();
  const matchedOrder = data.orders.find(
    (o) => o.id.toUpperCase() === orderIdClean
  );

  const newClaim: Claim = {
    claimId: `CLM-${Math.floor(10000 + Math.random() * 89999)}`,
    createdAt: new Date().toISOString(),
    orderId: orderIdClean,
    phone: body.phone.trim(),
    reason: body.reason.trim(),
    description: body.description?.trim() || "",
    evidenceName: body.evidenceName?.trim() || undefined,
    status: "pending",
    lotId: matchedOrder?.lotId || undefined,
  };

  const created = await createClaimRecord(newClaim);

  if (matchedOrder) {
    await updateOrderRecord(matchedOrder.id, { orderStatus: "claimed" });
  }

  const cfg = getRuntimeConfig();
  if (cfg.lineChannelAccessToken && cfg.lineAdminUserId) {
    await pushLineMessage(
      cfg.lineAdminUserId,
      buildClaimAlertForAdmin(created),
      cfg.lineChannelAccessToken
    );
  }

  return { ok: true, claim: created, matchedOrder };
}
