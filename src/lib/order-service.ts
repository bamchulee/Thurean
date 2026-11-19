// ============================================================
// Shared Order & Claim Business Logic (Web API + LINE Bot)
// ============================================================
import { getAvailableUnits, pricePerKgOf } from "./stock";
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
  buildBookingReceiptFlex,
  buildClaimAlertForAdmin,
  buildClaimReceiptForCustomerFlex,
  buildOrderAlertForAdmin,
  pushLineMessage,
} from "./line-notify";
import { adminAlertLinks, notifyAdmins } from "./order-workflow";
import { shopInfo } from "../data/shop";
import { runInBackground } from "./background";
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
  lineUserId?: string;
  roundId?: string;
  channel?: string;
  notes?: string;
  createdBy?: string;
  /** คีย์จากปุ่มยืนยันใน LINE — กดซ้ำได้ออเดอร์เดิม */
  bookingKey?: string;
  /** price ต่อชิ้นกำหนดเองได้เฉพาะแอดมิน (ขายหน้าร้าน/ราคาพิเศษ) */
  items?: { productId: string; qty: number; ripenessPref?: string; price?: number }[];
  // ช่องด้านล่างรับเฉพาะแอดมิน (options.trusted) เช่น คีย์ออเดอร์หน้าร้านที่จ่ายแล้ว
  shippingCost?: number;
  courier?: string;
  vehicleType?: string;
  slipUrl?: string;
  paymentStatus?: string;
  orderStatus?: OrderStatus;
}

export type SubmitOrderResult =
  | { ok: true; order: Order; duplicate?: boolean }
  | { ok: false; error: string; status: number };

export async function submitNewOrder(
  body: SubmitOrderInput,
  options?: { skipCustomerNotify?: boolean; trusted?: boolean }
): Promise<SubmitOrderResult> {
  const trusted = Boolean(options?.trusted);
  if (!body.customerName?.trim() || !body.phone?.trim() || !body.address?.trim()) {
    return {
      ok: false,
      error: "กรุณากรอกชื่อ เบอร์โทร และที่อยู่จัดส่งให้ครบถ้วน",
      status: 400,
    };
  }
  if ((body.phone || "").replace(/\D/g, "").length < 9) {
    return { ok: false, error: "เบอร์โทรไม่ถูกต้อง (ต้องมี 9-10 หลัก)", status: 400 };
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return {
      ok: false,
      error: "กรุณาเลือกสินค้าอย่างน้อย 1 รายการ",
      status: 400,
    };
  }

  const { data } = await getAllDatabase();

  const bookingKey = body.bookingKey?.trim() || undefined;
  if (bookingKey) {
    const existing = data.orders.find((o) => o.bookingKey === bookingKey);
    if (existing) return { ok: true, order: existing, duplicate: true };
  }

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
    // ลูกค้าสั่งเองได้ไม่เกิน 50 — แอดมินคีย์ออเดอร์ใหญ่ (ยกลัง) ได้ถึง 999
    const qty = Math.min(trusted ? 999 : 50, Math.max(1, Math.floor(Number(reqItem.qty) || 1)));
    const itemLabel = prod.name;
    if (reqItem.ripenessPref) {
      ripenessSummarySet.push(`${prod.variety || prod.name}: ${reqItem.ripenessPref} x${qty}`);
    }
    // ขายตามน้ำหนักจริง: ตอนจองยังไม่มียอด (คิดตอนแอดมินชั่ง) — แอดมินคีย์ราคาเหมาเองได้ (ขายหน้าร้าน)
    const perKg = pricePerKgOf(prod);
    const fixedPrice = trusted && typeof reqItem.price === "number" && reqItem.price > 0 ? reqItem.price : undefined;
    verifiedItems.push({
      productId: prod.id,
      productName: itemLabel,
      qty,
      price: fixedPrice ?? perKg,
      productType: prod.productType,
      grade: prod.grade,
      weightPerItem: prod.weight,
      pricePerKg: perKg,
    });
    if (fixedPrice !== undefined) totalPrice += Math.round(fixedPrice * qty);
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

  // จองเข้ารอบที่เปิดอยู่ — รอบเต็มแล้วไม่รับเพิ่ม (ถ้ายังไม่เปิดรอบ ก็รับจองไว้ก่อนได้)
  const activeRound =
    data.rounds.find((r) => r.id === body.roundId && r.status === "open") ||
    data.rounds.find((r) => r.status === "open");
  const totalFruitCount = verifiedItems.reduce((sum, it) => sum + it.qty, 0);
  if (!trusted && activeRound && activeRound.totalQuota > 0 && totalFruitCount > activeRound.quotaRemaining) {
    return {
      ok: false,
      error:
        activeRound.quotaRemaining <= 0
          ? `รอบส่ง "${activeRound.name}" เต็มแล้วครับ`
          : `รอบส่งนี้รับได้อีก ${activeRound.quotaRemaining} ลูก (สั่งมา ${totalFruitCount})`,
      status: 409,
    };
  }

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
  const now = new Date().toISOString();
  const shippingCost =
    trusted && typeof body.shippingCost === "number" ? body.shippingCost : shipMethod.price;

  const newOrder: Order = {
    id: localNextId("orders", usedOrderIds),
    createdAt: now,
    createDate: now,
    roundId: activeRound?.id || "",
    userId: finalUserId,
    customerName: body.customerName.trim(),
    phone: body.phone.trim(),
    address: body.address.trim(),
    lineUserId: trustedLineUserId || undefined,
    productType: firstProd?.productType || "รับคัดลูก",
    productId: firstProd?.id || verifiedItems[0]?.productId || "",
    productName: firstProd?.name || verifiedItems[0]?.productName || "",
    pricePerItem: firstProd?.pricePerKg || firstProd?.price || 0,
    weightPerItem: "รอชั่งน้ำหนักจริง",
    quantity: totalFruitCount,
    channel: body.channel || (trustedLineUserId ? "LINE OA" : "หน้าร้าน / Web"),
    vehicleType: (trusted && body.vehicleType) || "รถห้องเย็นปรับอุณหภูมิ",
    courier:
      (trusted && body.courier?.trim()) ||
      resolveCourierInfo(undefined, undefined, shipMethod.name).name ||
      "Flash Express",
    ripenessPref:
      body.ripenessPref ||
      (ripenessSummarySet.length > 0 ? ripenessSummarySet.join(" | ") : undefined),
    items: verifiedItems,
    totalPrice,
    shippingMethod: shipMethod.name,
    shippingCost,
    grandTotal: totalPrice + shippingCost,
    paymentStatus: (trusted && body.paymentStatus) || "pending",
    orderStatus: (trusted && body.orderStatus) || "สั่งจอง",
    createdBy: body.createdBy || "customer",
    updatedBy: body.createdBy || "customer",
    isActive: 1,
    slipUrl: (trusted && body.slipUrl?.trim()) || undefined,
    bookingKey,
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
  // ชีตตอบเลขเดิมกลับมา = bookingKey นี้เคยบันทึกแล้ว (แคชของ instance นี้ยังไม่เห็น)
  if (bookingKey && usedOrderIds.has(created.id)) {
    return { ok: true, order: created, duplicate: true };
  }

  // แจ้ง LINE ลูกค้า + กลุ่มแอดมินเบื้องหลัง — ลูกค้าเห็นว่าสั่งสำเร็จทันที ไม่ต้องรอส่งข้อความ
  const cfg = getRuntimeConfig();
  const order = created;
  runInBackground(`order ${order.id} notifications`, async () => {
    if (order.lineUserId && !options?.skipCustomerNotify) {
      const res = await pushLineMessage(order.lineUserId, buildBookingReceiptFlex(order), cfg.lineChannelAccessToken);
      if (!res.sent) console.warn("Failed to push booking receipt via LINE:", res.reason);
    }
    await notifyAdmins(buildOrderAlertForAdmin(order, await adminAlertLinks(order)));
  });

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
  // แจ้ง LINE เบื้องหลัง — ลูกค้าเห็นผลแจ้งเคลมทันที
  if (cfg.lineChannelAccessToken) runInBackground(`claim ${created.claimId} notifications`, async () => {
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
  });

  return { ok: true, claim: created, matchedOrder };
}
