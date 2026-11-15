// ============================================================
// Shared Order & Claim Business Logic (Web API + LINE Bot)
// ============================================================
import crypto from "crypto";
import { getAvailableUnits } from "./stock";
import {
  SheetsApiError,
  createClaimRecord,
  createOrderRecord,
  getAllDatabase,
  getRuntimeConfig,
  updateOrderRecord,
  upsertLineUser,
} from "./sheets-db";
import {
  buildClaimAlertForAdmin,
  buildClaimReceiptForCustomerFlex,
  buildOrderAlertForAdmin,
  buildOrderSummaryForCustomerFlex,
  pushLineMessage,
} from "./line-notify";
import { shopInfo } from "../data/mock";
import { resolveCourierInfo } from "./courier";
import type { Claim, Order, OrderItem } from "../types/durian";

/** สุ่มรหัสตัวเลขที่ยังไม่ถูกใช้ ถ้าช่วงเลขเริ่มแน่นจะขยายจำนวนหลักให้อัตโนมัติ */
function generateUniqueCode(prefix: string, digits: number, used: Set<string>): string {
  let len = digits;
  while (used.size > 0.5 * 9 * 10 ** (len - 1)) len++;
  for (let i = 0; i < 200; i++) {
    const min = 10 ** (len - 1);
    const code = `${prefix}${crypto.randomInt(min, min * 10)}`;
    if (!used.has(code.toUpperCase())) return code;
  }
  return `${prefix}${Date.now()}`;
}

export interface SubmitOrderInput {
  userId?: string;
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

  // เช็กสต็อกรวมต่อสินค้า (สินค้าเดียวกันอาจอยู่หลายบรรทัดคนละระดับความสุก)
  const qtyByProduct = new Map<string, number>();
  for (const it of verifiedItems) {
    qtyByProduct.set(it.productId, (qtyByProduct.get(it.productId) || 0) + it.qty);
  }
  for (const [productId, qty] of qtyByProduct) {
    const prod = data.products.find((p) => p.id === productId);
    if (!prod) continue;
    const available = getAvailableUnits(prod);
    if (available !== undefined && qty > available) {
      return {
        ok: false,
        error:
          available <= 0
            ? `สินค้า "${prod.name}" หมดแล้วในรอบนี้`
            : `สินค้า "${prod.name}" เหลือประมาณ ${available} ${prod.unit} (สั่งมา ${qty})`,
        status: 409,
      };
    }
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

  // ตัวตนผู้สั่ง: userId / lineUserId ต้องมาจากผู้เรียกที่ยืนยันแล้ว (session, LINE token, webhook)
  // ลูกค้าทั่วไปที่ไม่ล็อกอินจะไม่ถูกผูกหรือแก้ข้อมูลบัญชีสมาชิกใด ๆ
  let finalUserId = body.userId?.trim();
  const trustedLineUserId = body.lineUserId?.trim();
  if (!finalUserId && trustedLineUserId) {
    try {
      const user = await upsertLineUser({
        lineUserId: trustedLineUserId,
        customerName: body.customerName.trim(),
        phone: body.phone.trim(),
        address: body.address.trim(),
        source: "line-chat",
        notes: "ลูกค้าสั่งซื้อทุเรียน",
      });
      if (user && user.id) {
        finalUserId = user.id;
      }
    } catch (err) {
      console.warn("Auto-sync user from order failed:", err);
    }
  }

  const usedOrderIds = new Set(data.orders.map((o) => o.id.toUpperCase()));
  const newOrder: Order = {
    id: generateUniqueCode("WK-", 4, usedOrderIds),
    createdAt: new Date().toISOString(),
    roundId: activeRound?.id || "WK-ROUND-46",
    userId: finalUserId,
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

  // ชีตเป็นตัวตัดสินสุดท้าย (เช็กรหัสซ้ำ/สต็อกใต้ล็อก) — รหัสชนให้สุ่มใหม่ ของหมดให้แจ้งลูกค้า
  let created: Order | null = null;
  for (let attempt = 0; attempt < 4 && !created; attempt++) {
    try {
      created = await createOrderRecord(newOrder);
    } catch (err) {
      const code = err instanceof SheetsApiError ? err.code : "";
      if (code === "DUPLICATE_ID" && attempt < 3) {
        usedOrderIds.add(newOrder.id.toUpperCase());
        newOrder.id = generateUniqueCode("WK-", 4, usedOrderIds);
        continue;
      }
      if (code === "OUT_OF_STOCK") {
        const detail = String((err as Error).message).replace(/^.*OUT_OF_STOCK:\s*/, "");
        return { ok: false, error: `สินค้าไม่พอ: ${detail}`, status: 409 };
      }
      throw err;
    }
  }
  if (!created) {
    return { ok: false, error: "ไม่สามารถออกเลขคำสั่งซื้อได้ กรุณาลองใหม่", status: 500 };
  }

  const cfg = getRuntimeConfig();
  if (cfg.lineChannelAccessToken) {
    // 1. Send Order Confirmation directly to Customer (if ordered via LINE or logged in with LINE)
    if (created.lineUserId) {
      try {
        const customerMessages = buildOrderSummaryForCustomerFlex(created);
        await pushLineMessage(
          created.lineUserId,
          customerMessages,
          cfg.lineChannelAccessToken
        );
      } catch (err) {
        console.warn("Failed to push customer order receipt via LINE:", err);
      }
    }

    // 2. Send Admin Notification (only if admin ID is configured and NOT the same as customer)
    if (cfg.lineAdminUserId && cfg.lineAdminUserId !== created.lineUserId) {
      try {
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
      } catch (err) {
        console.warn("Failed to push admin order alert via LINE:", err);
      }
    }
  }

  return { ok: true, order: created };
}

export interface SubmitClaimInput {
  orderId?: string;
  userId?: string;
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

  const usedClaimIds = new Set(data.claims.map((c) => c.claimId.toUpperCase()));
  const newClaim: Claim = {
    claimId: generateUniqueCode("CLM-", 5, usedClaimIds),
    createdAt: new Date().toISOString(),
    orderId: orderIdClean,
    userId: body.userId?.trim() || matchedOrder?.userId || undefined,
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
  if (cfg.lineChannelAccessToken) {
    // 1. Send Claim Confirmation to Customer (if original order had lineUserId)
    const customerLineId = matchedOrder?.lineUserId;
    if (customerLineId) {
      try {
        await pushLineMessage(
          customerLineId,
          buildClaimReceiptForCustomerFlex(created),
          cfg.lineChannelAccessToken
        );
      } catch (err) {
        console.warn("Failed to push customer claim receipt via LINE:", err);
      }
    }

    // 2. Send Admin Alert (only if configured and not customer)
    if (cfg.lineAdminUserId && cfg.lineAdminUserId !== customerLineId) {
      try {
        await pushLineMessage(
          cfg.lineAdminUserId,
          buildClaimAlertForAdmin(created),
          cfg.lineChannelAccessToken
        );
      } catch (err) {
        console.warn("Failed to push admin claim alert via LINE:", err);
      }
    }
  }

  return { ok: true, claim: created, matchedOrder };
}
