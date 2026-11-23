// ============================================================
// ขั้นตอนหลังลูกค้าจอง (ใช้ร่วมกันทั้งปุ่มในกลุ่ม LINE แอดมิน และหน้าแอดมินบนเว็บ)
// ทุกการเปลี่ยนสถานะผ่านไฟล์นี้ที่เดียว: เช็กลำดับ → บันทึกชีต → แจ้งลูกค้า
// ============================================================
import {
  getAllDatabase,
  getRuntimeConfig,
  updateOrderRecord,
} from "./sheets-db";
import {
  type AdminAlertLinks,
  adminOrderUrl,
  getLineChatUrl,
  buildCancelledNoticeFlex,
  buildDeliveredNoticeFlex,
  buildPaymentConfirmedFlex,
  buildPaymentQrForCustomerFlex,
  buildShippedNoticeFlex,
  buildSlipAlertForAdmin,
  buildOrderUpdateAlertForAdmin,
  buildSlipRejectedNotice,
  buildSlipSubmittedReceiptFlex,
  pushLineMessage,
} from "./line-notify";
import { findOrderById } from "./ids";
import { runInBackground } from "./background";
import { resolveCourierInfo } from "./courier";
import {
  type CanonicalOrderStatus,
  canTransitionOrderStatus,
  canWeigh,
  normalizePaymentStatus,
  orderStatusOf,
} from "./order-status";
import type { Order, OrderItem, Product } from "../types/durian";

export type WorkflowResult =
  | { ok: true; order: Order; changed: boolean }
  | { ok: false; error: string; status: number };

const fail = (error: string, status = 409): WorkflowResult => ({ ok: false, error, status });

/** ปลายทางแจ้งเตือนทีมงาน: กลุ่มแอดมิน (หลัก) + LINE แอดมินส่วนตัว (สำรอง) */
export function getAdminTargets(): string[] {
  const cfg = getRuntimeConfig();
  return Array.from(
    new Set([cfg.lineAdminGroupId, cfg.lineAdminUserId].map((v) => (v || "").trim()).filter(Boolean))
  );
}

export async function notifyAdmins(messages: unknown[]): Promise<void> {
  const token = getRuntimeConfig().lineChannelAccessToken;
  for (const target of getAdminTargets()) {
    const res = await pushLineMessage(target, messages, token);
    if (!res.sent) console.warn(`[workflow] admin alert to ${target} failed: ${res.reason}`);
  }
}

/** ปุ่มในการ์ดกลุ่มแอดมิน: เปิดหน้าออเดอร์นี้ / แชทลูกค้าคนนี้ */
export async function adminAlertLinks(order: Order): Promise<AdminAlertLinks> {
  const cfg = getRuntimeConfig();
  return {
    orderUrl: adminOrderUrl(order.id, cfg.publicBaseUrl),
    chatUrl: await getLineChatUrl(order.lineUserId, cfg.lineChannelAccessToken),
  };
}

/** อัปเดตสถานะ → การ์ดเข้ากลุ่มแอดมิน (ส่งเบื้องหลัง แอดมินที่กดอยู่ไม่ต้องรอ) */
function alertGroup(
  event: Parameters<typeof buildOrderUpdateAlertForAdmin>[0],
  order: Order,
  actor: string,
  reason?: string
): void {
  runInBackground(`group alert ${event} ${order.id}`, async () =>
    notifyAdmins(buildOrderUpdateAlertForAdmin(event, order, await adminAlertLinks(order), { actor, reason }))
  );
}

async function notifyCustomer(order: Order, messages: unknown[]): Promise<void> {
  if (!order.lineUserId) return;
  const res = await pushLineMessage(order.lineUserId, messages, getRuntimeConfig().lineChannelAccessToken);
  if (!res.sent) console.warn(`[workflow] customer notice ${order.id} failed: ${res.reason}`);
}

/** อ่านสด (ไม่ใช้แคช) เพราะการเปลี่ยนสถานะต้องเห็นค่าล่าสุดเสมอ */
async function loadFresh(orderRef: string): Promise<{ order?: Order; products: Product[] }> {
  const { data } = await getAllDatabase(true);
  return { order: findOrderById(data.orders, orderRef), products: data.products };
}

async function save(order: Order, updates: Partial<Order>, actor: string): Promise<Order> {
  const now = new Date().toISOString();
  const patch: Partial<Order> = { ...updates, updatedAt: now, updatedBy: actor };
  await updateOrderRecord(order.id, patch);
  return { ...order, ...patch };
}

function publicBaseUrl(): string | undefined {
  return getRuntimeConfig().publicBaseUrl;
}

// ------------------------------------------------------------
// ชั่งน้ำหนัก → รอชำระเงิน (ส่ง QR ยอดจริงให้ลูกค้า)
// ------------------------------------------------------------

/**
 * ฟอร์มชั่งในหน้าออเดอร์: แต่ละรายการกรอก "กี่ลูก ลูกละกี่กิโล" + ราคาต่อกิโล (ค่าเริ่มต้นจากชีต Products)
 * ยอด = น้ำหนักรวม × ราคาต่อกิโล — จำนวนลูกจริงอาจต่างจากที่จองได้ (ใช้ตามที่ชั่ง)
 */
export type WeighInput = { items: { fruitKgs: number[]; pricePerKg?: number }[] };

export function priceItemsByWeight(
  order: Order,
  products: Product[],
  input: WeighInput
): { items: OrderItem[]; totalPrice: number; totalKg: number } | { error: string } {
  const items = order.items || [];
  if (items.length === 0) return { error: "ออเดอร์นี้ไม่มีรายการสินค้า" };
  if (!input?.items || input.items.length !== items.length) {
    return { error: "ต้องกรอกน้ำหนักให้ครบทุกรายการ" };
  }

  let totalPrice = 0;
  let totalKg = 0;
  const priced: OrderItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const fruitKgs = (input.items[i].fruitKgs || []).map((n) => Math.round(Number(n) * 100) / 100);
    if (fruitKgs.length === 0 || fruitKgs.length > 50) {
      return { error: `${it.productName}: ต้องมีอย่างน้อย 1 ลูก` };
    }
    if (fruitKgs.some((n) => !Number.isFinite(n) || n <= 0 || n > 30)) {
      return { error: `${it.productName}: น้ำหนักต่อลูกต้องอยู่ระหว่าง 0–30 กก.` };
    }
    const prod = products.find((p) => p.id === it.productId);
    const override = Number(input.items[i].pricePerKg);
    const pricePerKg = override > 0 ? override : Number(prod?.pricePerKg || it.pricePerKg || 0);
    if (!pricePerKg) return { error: `${it.productName}: ยังไม่มีราคาต่อกิโล` };

    const kg = Math.round(fruitKgs.reduce((s, n) => s + n, 0) * 100) / 100;
    totalKg += kg;
    totalPrice += Math.round(kg * pricePerKg);
    priced.push({ ...it, qty: fruitKgs.length, fruitKgs, actualWeightKg: kg, pricePerKg, price: pricePerKg });
  }
  return { items: priced, totalPrice, totalKg: Math.round(totalKg * 100) / 100 };
}

export async function weighOrder(orderRef: string, input: WeighInput, actor: string): Promise<WorkflowResult> {
  const { order, products } = await loadFresh(orderRef);
  if (!order) return fail(`ไม่พบออเดอร์ "${orderRef}"`, 404);
  if (!canWeigh(order)) {
    return fail(`ออเดอร์ #${order.id} อยู่สถานะ "${orderStatusOf(order)}" — ชั่งได้เฉพาะก่อนลูกค้าชำระเงิน`);
  }
  const priced = priceItemsByWeight(order, products, input);
  if ("error" in priced) return fail(priced.error, 400);

  const qty = priced.items.reduce((s, it) => s + it.qty, 0) || 1;
  const updated = await save(
    order,
    {
      items: priced.items,
      totalPrice: priced.totalPrice,
      grandTotal: priced.totalPrice + (order.shippingCost || 0),
      pricePerItem: priced.items[0].pricePerKg,
      quantity: qty,
      weightPerItem: `${(priced.totalKg / qty).toFixed(2)} กก.`,
      orderStatus: "รอชำระเงิน",
      paymentStatus: "pending",
      weighedAt: new Date().toISOString(),
    },
    actor
  );
  await notifyCustomer(updated, buildPaymentQrForCustomerFlex(updated, publicBaseUrl()));
  alertGroup("weighed", updated, actor);
  return { ok: true, order: updated, changed: true };
}

/** ออเดอร์ที่แอดมินคีย์ราคาเหมาไว้แล้ว (ไม่ต้องชั่ง): ส่งยอดตามนั้นได้เลย */
export async function quoteAtBookedPrice(orderRef: string, actor: string): Promise<WorkflowResult> {
  const { order } = await loadFresh(orderRef);
  if (!order) return fail(`ไม่พบออเดอร์ "${orderRef}"`, 404);
  if (orderStatusOf(order) !== "สั่งจอง") {
    return fail(`ออเดอร์ #${order.id} อยู่สถานะ "${orderStatusOf(order)}" แล้ว`);
  }
  if (!(order.totalPrice > 0)) {
    return fail(`ออเดอร์ #${order.id} ยังไม่มียอดเงิน — ต้องชั่งน้ำหนักก่อน`, 400);
  }
  const updated = await save(
    order,
    {
      orderStatus: "รอชำระเงิน",
      paymentStatus: "pending",
      grandTotal: order.totalPrice + (order.shippingCost || 0),
      weighedAt: new Date().toISOString(),
    },
    actor
  );
  await notifyCustomer(updated, buildPaymentQrForCustomerFlex(updated, publicBaseUrl()));
  alertGroup("weighed", updated, actor);
  return { ok: true, order: updated, changed: true };
}

// ------------------------------------------------------------
// สลิป: ลูกค้าส่ง → แอดมินยืนยัน / ตีกลับ
// ------------------------------------------------------------

/** ออเดอร์ที่รอรับสลิปของลูกค้าคนนี้ (ล่าสุดก่อน) */
export function findAwaitingPaymentOrders(orders: Order[], lineUserId: string): Order[] {
  return orders
    .filter(
      (o) =>
        o.lineUserId === lineUserId &&
        orderStatusOf(o) === "รอชำระเงิน" &&
        normalizePaymentStatus(o.paymentStatus) !== "confirmed"
    )
    .sort((a, b) => (b.weighedAt || b.createDate || "").localeCompare(a.weighedAt || a.createDate || ""));
}

export async function submitSlip(
  orderRef: string,
  slipPath: string,
  actor: string,
  qr?: {
    slipRef?: string;
    slipBank?: string;
    slipCheck?: string;
    slipFileUrl?: string;
    slipAmount?: number;
    slipAmountCheck?: string;
    slipAccountCheck?: string;
    /** สรุปผลจาก Gemini (โชว์ในการ์ดแอดมิน ไม่เก็บลงชีต) */
    aiNote?: string;
  }
): Promise<WorkflowResult> {
  const { order } = await loadFresh(orderRef);
  if (!order) return fail(`ไม่พบออเดอร์ "${orderRef}"`, 404);
  if (orderStatusOf(order) !== "รอชำระเงิน") {
    return fail(`ออเดอร์ #${order.id} ยังไม่ถึงขั้นชำระเงิน (สถานะ "${orderStatusOf(order)}")`);
  }
  const updated = await save(
    order,
    {
      slipUrl: slipPath,
      paymentStatus: "slip_submitted",
      slipSubmittedAt: new Date().toISOString(),
      ...(qr
        ? {
            slipRef: qr.slipRef || "",
            slipBank: qr.slipBank || "",
            slipCheck: qr.slipCheck || "",
            slipFileUrl: qr.slipFileUrl || "",
            slipAmount: qr.slipAmount,
            slipAmountCheck: qr.slipAmountCheck || "",
            slipAccountCheck: qr.slipAccountCheck || "",
          }
        : {}),
    },
    actor
  );
  await notifyCustomer(updated, buildSlipSubmittedReceiptFlex(updated));
  await notifyAdmins(buildSlipAlertForAdmin(updated, await adminAlertLinks(updated), slipPath, qr?.aiNote));
  return { ok: true, order: updated, changed: true };
}

export async function confirmPayment(orderRef: string, actor: string): Promise<WorkflowResult> {
  const { order } = await loadFresh(orderRef);
  if (!order) return fail(`ไม่พบออเดอร์ "${orderRef}"`, 404);
  const status = orderStatusOf(order);
  if (status === "ชำระเงินแล้ว/เตรียมจัดส่ง" && normalizePaymentStatus(order.paymentStatus) === "confirmed") {
    return { ok: true, order, changed: false };
  }
  if (status !== "รอชำระเงิน") {
    return fail(`ออเดอร์ #${order.id} อยู่สถานะ "${status}" — ยืนยันยอดได้หลังชั่งน้ำหนักแล้วเท่านั้น`);
  }
  const updated = await save(
    order,
    { orderStatus: "ชำระเงินแล้ว/เตรียมจัดส่ง", paymentStatus: "confirmed", paidAt: new Date().toISOString() },
    actor
  );
  await notifyCustomer(updated, buildPaymentConfirmedFlex(updated));
  alertGroup("paid", updated, actor);
  return { ok: true, order: updated, changed: true };
}

export async function rejectSlip(orderRef: string, actor: string, reason?: string): Promise<WorkflowResult> {
  const { order } = await loadFresh(orderRef);
  if (!order) return fail(`ไม่พบออเดอร์ "${orderRef}"`, 404);
  if (orderStatusOf(order) !== "รอชำระเงิน" || normalizePaymentStatus(order.paymentStatus) !== "slip_submitted") {
    return fail(`ออเดอร์ #${order.id} ไม่มีสลิปที่รอตรวจ`);
  }
  const updated = await save(order, { paymentStatus: "pending" }, actor);
  await notifyCustomer(updated, buildSlipRejectedNotice(updated, publicBaseUrl(), reason));
  alertGroup("slip_rejected", updated, actor, reason);
  return { ok: true, order: updated, changed: true };
}

// ------------------------------------------------------------
// ยกเลิก (Apps Script คืนสต็อกให้เมื่อสถานะเปลี่ยนเป็น "ยกเลิก")
// ------------------------------------------------------------

export async function cancelOrder(orderRef: string, actor: string, reason?: string): Promise<WorkflowResult> {
  const { order } = await loadFresh(orderRef);
  if (!order) return fail(`ไม่พบออเดอร์ "${orderRef}"`, 404);
  const status = orderStatusOf(order);
  if (status === "ยกเลิก") return { ok: true, order, changed: false };
  if (!canTransitionOrderStatus(status, "ยกเลิก")) {
    return fail(`ออเดอร์ #${order.id} ส่งของไปแล้ว (สถานะ "${status}") ยกเลิกไม่ได้`);
  }
  const wasPaid = normalizePaymentStatus(order.paymentStatus) === "confirmed";
  const updated = await save(
    order,
    {
      orderStatus: "ยกเลิก",
      // เงินที่จ่ายแล้วต้องคืน — แอดมินโอนคืนเอง ระบบแค่บันทึกว่าต้องคืน
      paymentStatus: wasPaid ? "refunded" : normalizePaymentStatus(order.paymentStatus),
      cancelledAt: new Date().toISOString(),
      cancelReason: (reason || "").trim() || "ยกเลิกโดยแอดมิน",
    },
    actor
  );
  await notifyCustomer(updated, buildCancelledNoticeFlex(updated));
  alertGroup("cancelled", updated, actor, reason);
  return { ok: true, order: updated, changed: true };
}

// ------------------------------------------------------------
// จัดส่ง
// ------------------------------------------------------------

export async function markShipped(
  orderRef: string,
  shipping: { trackingNo?: string; courier?: string },
  actor: string
): Promise<WorkflowResult> {
  const { order } = await loadFresh(orderRef);
  if (!order) return fail(`ไม่พบออเดอร์ "${orderRef}"`, 404);
  const status = orderStatusOf(order);
  if (!canTransitionOrderStatus(status, "กำลังจัดส่ง")) {
    return fail(`ออเดอร์ #${order.id} อยู่สถานะ "${status}" — ต้องยืนยันยอดชำระก่อนจัดส่ง`);
  }
  const trackingNo = (shipping.trackingNo || order.trackingNo || "").trim();
  const courier =
    (shipping.courier || "").trim() ||
    (trackingNo ? resolveCourierInfo(trackingNo, order.courier, order.shippingMethod).name : order.courier);
  const updated = await save(
    order,
    { orderStatus: "กำลังจัดส่ง", trackingNo: trackingNo || undefined, courier },
    actor
  );
  if (status !== "กำลังจัดส่ง") {
    await notifyCustomer(updated, buildShippedNoticeFlex(updated));
    alertGroup("shipped", updated, actor);
  }
  return { ok: true, order: updated, changed: status !== "กำลังจัดส่ง" };
}

export async function markDelivered(orderRef: string, actor: string, opts: { notifyCustomer?: boolean } = {}): Promise<WorkflowResult> {
  const { order } = await loadFresh(orderRef);
  if (!order) return fail(`ไม่พบออเดอร์ "${orderRef}"`, 404);
  const status = orderStatusOf(order);
  if (status === "จัดส่งสำเร็จ") return { ok: true, order, changed: false };
  if (status !== "กำลังจัดส่ง") {
    return fail(`ออเดอร์ #${order.id} ยังไม่ได้จัดส่ง (สถานะ "${status}")`);
  }
  const updated = await save(
    order,
    { orderStatus: "จัดส่งสำเร็จ", deliveredAt: new Date().toISOString() },
    actor
  );
  if (opts.notifyCustomer !== false) await notifyCustomer(updated, buildDeliveredNoticeFlex(updated));
  alertGroup("delivered", updated, actor);
  return { ok: true, order: updated, changed: true };
}

/** หน้าแอดมินเลือกสถานะจาก dropdown → เรียกขั้นตอนที่ตรงกัน (ห้ามข้ามขั้น) */
export async function setOrderStatus(
  orderRef: string,
  next: CanonicalOrderStatus,
  extras: { trackingNo?: string; courier?: string; cancelReason?: string },
  actor: string
): Promise<WorkflowResult> {
  switch (next) {
    case "รอชำระเงิน":
      return quoteAtBookedPrice(orderRef, actor);
    case "ชำระเงินแล้ว/เตรียมจัดส่ง":
      return confirmPayment(orderRef, actor);
    case "กำลังจัดส่ง":
      return markShipped(orderRef, extras, actor);
    case "จัดส่งสำเร็จ":
      return markDelivered(orderRef, actor);
    case "ยกเลิก":
      return cancelOrder(orderRef, actor, extras.cancelReason);
    case "สั่งจอง":
    default:
      return fail("ย้อนสถานะกลับไม่ได้", 400);
  }
}
