// ============================================================
// Shared Order & Claim Business Logic (Web API + LINE Bot)
// ============================================================
import { getAvailableUnits } from "./stock";
import {
  SheetsApiError,
  createClaimRecord,
  createOrderRecord,
  localNextId,
  getAllDatabase,
  getRuntimeConfig,
  updateOrderRecord,
  recordGuestCustomer,
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
import { checkClaimEligibility } from "./claim-policy";
import { findOrderById } from "./ids";
import type { Claim, Order, OrderItem, OrderStatus } from "../types/durian";

export interface SubmitOrderInput {
  userId?: string;
  customerName?: string;
  phone?: string;
  address?: string;
  ripenessPref?: string;
  shippingMethod?: string;
  shippingCost?: number;
  lineUserId?: string;
  roundId?: string;
  slipUrl?: string;
  courier?: string;
  channel?: string;
  vehicleType?: string;
  weightPerItem?: string | number;
  notes?: string;
  paymentStatus?: "pending" | "confirmed" | "refunded" | string;
  orderStatus?: OrderStatus;
  createdBy?: string;
  items?: { productId: string; qty: number; ripenessPref?: string; weightPerItem?: string | number }[];
}

export type SubmitOrderResult =
  | { ok: true; order: Order }
  | { ok: false; error: string; status: number };

export async function submitNewOrder(
  body: SubmitOrderInput,
  options?: { skipCustomerNotify?: boolean }
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
  } else if (!finalUserId) {
    // ลูกค้าเว็บที่ไม่ล็อกอิน: เก็บชื่อ/เบอร์/ที่อยู่ลงชีต Users เหมือนเดิม
    try {
      finalUserId = await recordGuestCustomer({
        customerName: body.customerName,
        phone: body.phone,
        address: body.address,
      });
    } catch (err) {
      console.warn("Saving guest customer failed:", err);
    }
  }

  const usedOrderIds = new Set(data.orders.map((o) => o.id));
  const firstProd = data.products.find((p) => p.id === verifiedItems[0]?.productId);
  const totalFruitCount = verifiedItems.reduce((sum, it) => sum + it.qty, 0);

  const newOrder: Order = {
    id: localNextId("orders", usedOrderIds),
    createdAt: new Date().toISOString(),
    createDate: new Date().toISOString(),
    roundId: activeRound?.id || "WK-ROUND-46",
    userId: finalUserId,
    customerName: body.customerName.trim(),
    phone: body.phone.trim(),
    address: body.address.trim(),
    lineUserId: body.lineUserId?.trim() || undefined,
    productType: firstProd?.productType || "รับคัดลูก",
    productId: firstProd?.id || verifiedItems[0]?.productId || "",
    productName: firstProd?.name || verifiedItems[0]?.productName || "",
    pricePerItem: firstProd?.pricePerKg || firstProd?.price || verifiedItems[0]?.price || 0,
    weightPerItem: body.weightPerItem || firstProd?.weight || "รอชั่งน้ำหนักจริง",
    quantity: totalFruitCount,
    channel: body.channel || (body.lineUserId ? "LINE Official" : "หน้าร้าน / Web"),
    vehicleType: body.vehicleType || "รถห้องเย็นปรับอุณหภูมิ",
    courier:
      body.courier?.trim() ||
      resolveCourierInfo(undefined, undefined, shipMethod.name).name ||
      "Flash Express",
    ripenessPref:
      body.ripenessPref ||
      (ripenessSummarySet.length > 0
        ? ripenessSummarySet.join(" | ")
        : "กรอบนอกนุ่มใน (ไก่ฉีก)"),
    items: verifiedItems,
    totalPrice,
    shippingMethod: shipMethod.name,
    shippingCost: typeof body.shippingCost === "number" ? body.shippingCost : shipMethod.price,
    paymentStatus: body.paymentStatus || "pending",
    orderStatus: body.orderStatus || "สั่งจอง",
    createdBy: body.createdBy || "customer",
    updatedBy: body.createdBy || "customer",
    isActive: 1,
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
        usedOrderIds.add(newOrder.id);
        newOrder.id = localNextId("orders", usedOrderIds);
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
    if (created.lineUserId && !options?.skipCustomerNotify) {
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

    // 2. Send Admin / Team Notification:
    // Support LINE Admin Group (preferred) and LINE Admin User ID
    const adminTargets = [cfg.lineAdminGroupId, cfg.lineAdminUserId].filter(
      (id): id is string => Boolean(id && id.trim())
    );

    for (const targetId of adminTargets) {
      try {
        const messages = buildOrderAlertForAdmin(created, cfg.publicBaseUrl);
        if (created.slipUrl && cfg.publicBaseUrl) {
          const fullSlipUrl = created.slipUrl.startsWith("http")
            ? created.slipUrl
            : `${cfg.publicBaseUrl}${created.slipUrl}`;
          messages.push({
            type: "image",
            originalContentUrl: fullSlipUrl,
            previewImageUrl: fullSlipUrl,
          });
        }
        await pushLineMessage(
          targetId,
          messages,
          cfg.lineChannelAccessToken
        );
      } catch (err) {
        console.warn(`Failed to push admin order alert to ${targetId}:`, err);
      }
    }
  }

  return { ok: true, order: created };
}

export interface SubmitClaimInput {
  orderId?: string;
  userId?: string;
  lineUserId?: string;
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
  const matchedOrder = findOrderById(data.orders, orderIdClean);

  if (!matchedOrder) {
    return {
      ok: false,
      error: `ไม่พบรหัสคำสั่งซื้อ "${orderIdClean}" ในระบบ กรุณาตรวจสอบตัวเลขอีกครั้ง`,
      status: 404,
    };
  }

  // ตรวจสอบความเป็นเจ้าของออเดอร์ (User/เบอร์โทร ต้องตรงกับคำสั่งซื้อนั้น)
  const claimingPhone = (body.phone || "").replace(/[^\d]/g, "");
  const orderPhone = (matchedOrder.phone || "").replace(/[^\d]/g, "");
  const isOwner = Boolean(
    (body.userId && matchedOrder.userId && body.userId === matchedOrder.userId) ||
    (body.lineUserId && matchedOrder.lineUserId && body.lineUserId === matchedOrder.lineUserId) ||
    (claimingPhone && orderPhone && claimingPhone === orderPhone) ||
    !matchedOrder.userId
  );

  if (!isOwner) {
    return {
      ok: false,
      error: `รหัสคำสั่งซื้อ "${orderIdClean}" ไม่ตรงกับข้อมูลบัญชีหรือเบอร์โทรศัพท์ของคุณ (${body.phone}) กรุณาตรวจสอบรหัสออเดอร์อีกครั้งครับ`,
      status: 403,
    };
  }

  // ตรวจสอบเงื่อนไขการรับประกันเคลม (Master Data Claim Policy)
  const eligibility = checkClaimEligibility(matchedOrder, data.claims || []);
  if (!eligibility.eligible) {
    return {
      ok: false,
      error: eligibility.reason || "ไม่สามารถแจ้งเคลมออเดอร์นี้ได้",
      status: 400,
    };
  }

  const usedClaimIds = new Set(data.claims.map((c) => c.claimId));
  const newClaim: Claim = {
    claimId: localNextId("claims", usedClaimIds),
    createdAt: new Date().toISOString(),
    orderId: matchedOrder.id,
    userId: body.userId?.trim() || matchedOrder?.userId || undefined,
    lineUserId: matchedOrder?.lineUserId || undefined,
    customerName: matchedOrder?.customerName || undefined,
    phone: body.phone.trim(),
    ripenessType: eligibility.warrantyType,
    deliveredAt: matchedOrder?.deliveredAt || undefined,
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

    // 2. Send Admin / Team Claim Alert
    const adminTargets = [cfg.lineAdminGroupId, cfg.lineAdminUserId].filter(
      (id): id is string => Boolean(id && id.trim())
    );
    for (const targetId of adminTargets) {
      try {
        await pushLineMessage(
          targetId,
          buildClaimAlertForAdmin(created, cfg.publicBaseUrl),
          cfg.lineChannelAccessToken
        );
      } catch (err) {
        console.warn(`Failed to push admin claim alert to ${targetId}:`, err);
      }
    }
  }

  return { ok: true, claim: created, matchedOrder };
}
