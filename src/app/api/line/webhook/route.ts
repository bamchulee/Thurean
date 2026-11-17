// ============================================================
// LINE OA Webhook — ร้านทุเรียนวินคิน
//
// กลุ่มแอดมิน : ชั่ง / ส่ง / ถึง / สรุป / สต็อก + ปุ่มยืนยันสลิป ยกเลิก ส่งยอด
// ลูกค้า (1:1) : จอง (ปุ่มพกข้อมูลการจองเอง ไม่พึ่งสถานะในเซิร์ฟเวอร์) → ส่งสลิป → เคลม / ติดตาม
// ทุกการเปลี่ยนสถานะออเดอร์ผ่าน lib/order-workflow.ts
// ============================================================
import { after, NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getAllDatabase,
  getBankAccount,
  getRuntimeConfig,
  loadAppSettings,
  ocrSlipImage,
  setLineAdminTarget,
  upsertLineUser,
} from "../../../../lib/sheets-db";
import {
  buildAddressFormFlex,
  buildBookingReceiptFlex,
  buildClaimReceiptForCustomerFlex,
  buildCustomerStatusFlex,
  buildLiveStreamFlex,
  buildMainQuickReply,
  buildDeliveredNoticeFlex,
  buildMoreMenuFlex,
  buildNeedAddressMessage,
  buildOrderCatalogMessages,
  buildPromotionsCarouselFlex,
  buildQtyPickerMessage,
  buildRipenessPickerMessage,
  buildStockOverviewMessages,
  buildTicketAlertForAdmin,
  buildUserOrdersFlex,
  buildWelcomeFlex,
  pushLineMessage,
  replyLineMessage,
  showLineLoadingAnimation,
} from "../../../../lib/line-notify";
import { checkClaimEligibility } from "../../../../lib/claim-policy";
import { downloadAndVerifyLineImage } from "../../../../lib/line-media";
import { clearLineSession, getLineSession, setLineSession } from "../../../../lib/line-sessions";
import { submitNewClaim, submitNewOrder } from "../../../../lib/order-service";
import { findAwaitingPaymentOrders, markDelivered, notifyAdmins, submitSlip } from "../../../../lib/order-workflow";
import { ORDER_STATUS_META, orderStatusOf } from "../../../../lib/order-status";
import {
  RIPENESS_OPTIONS,
  type BookingDraft,
  clampQty,
  draftFromParams,
  draftToParams,
  newBookingKey,
  ripenessLabel,
} from "../../../../lib/booking-draft";
import { addressFormUrlFor, bookingReviewMessages } from "../../../../lib/line-booking";
import { formatProductStock } from "../../../../lib/stock";
import { isValidLineSignature } from "../../../../lib/line-verify";
import { checkSlip, readSlipQr } from "../../../../lib/slip-qr";
import { readSlipText } from "../../../../lib/slip-text";
import { extractOrderId, findOrderById } from "../../../../lib/ids";
import { shopInfo } from "../../../../data/shop";
import type { DatabaseState, Order, RuntimeConfig, User } from "../../../../types/durian";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface LineWebhookEvent {
  type: string;
  webhookEventId?: string;
  deliveryContext?: { isRedelivery?: boolean };
  replyToken?: string;
  source?: { type?: string; userId?: string; groupId?: string; roomId?: string };
  postback?: { data?: string };
  message?: {
    id?: string;
    type: string;
    text?: string;
    title?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
}

interface Ctx {
  ev: LineWebhookEvent;
  userId: string;
  token: string;
  cfg: RuntimeConfig;
  baseUrl: string;
  reply: (messages: unknown[]) => Promise<boolean>;
}

// LINE ส่ง event ซ้ำได้ (redelivery) — จำ id ที่ทำไปแล้วใน instance นี้
const seenEventIds = new Map<string, number>();

function alreadyHandled(ev: LineWebhookEvent): boolean {
  const id = ev.webhookEventId;
  if (!id) return false;
  const now = Date.now();
  if (seenEventIds.size > 2000) {
    for (const [k, t] of seenEventIds) if (now - t > 15 * 60 * 1000) seenEventIds.delete(k);
  }
  if (seenEventIds.has(id)) return true;
  seenEventIds.set(id, now);
  return false;
}

function resolvePublicBaseUrl(req: NextRequest, configuredUrl?: string): string {
  if (configuredUrl && configuredUrl.startsWith("https://")) {
    return configuredUrl.replace(/\/+$/, "");
  }
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    return `${proto}://${host}`.replace(/\/+$/, "");
  }
  return "";
}

function text(t: string, withMenu = true): Record<string, unknown> {
  return withMenu ? { type: "text", text: t, quickReply: buildMainQuickReply() } : { type: "text", text: t };
}

function quickReplyMsg(t: string, options: { label: string; text: string }[]) {
  return [
    {
      type: "text",
      text: t,
      quickReply: {
        items: options.map((opt) => ({
          type: "action",
          action: { type: "message", label: opt.label.slice(0, 20), text: opt.text },
        })),
      },
    },
  ];
}

const cleanDigits = (p?: string) => (p || "").replace(/[^\d]/g, "");

function findLineUser(data: DatabaseState, lineUserId: string): User | undefined {
  return (data.users || []).find((u) => u.lineUserId === lineUserId);
}

function contactOf(user?: User): { name: string; phone: string; address: string } | null {
  if (!user) return null;
  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.displayName || "";
  if (!name || cleanDigits(user.phone).length < 9 || !(user.address || "").trim()) return null;
  return { name, phone: user.phone, address: user.address.trim() };
}

/** ออเดอร์ของลูกค้าคนนี้: ผูกบัญชี LINE หรือเบอร์ที่บันทึกไว้ตรงกัน (ใหม่สุดก่อน) */
function ordersOfUser(data: DatabaseState, lineUserId: string): Order[] {
  const user = findLineUser(data, lineUserId);
  const phone = cleanDigits(user?.phone);
  return data.orders
    .filter(
      (o) =>
        o.lineUserId === lineUserId ||
        (user && o.userId && o.userId === user.id) ||
        (phone.length >= 9 && cleanDigits(o.phone) === phone)
    )
    .sort((a, b) => (b.createDate || b.createdAt || "").localeCompare(a.createDate || a.createdAt || ""));
}

function activeRoundOf(data: DatabaseState) {
  return data.rounds.find((r) => r.status === "open") || data.rounds[0];
}

function addressFormUrl(ctx: Ctx, draft?: BookingDraft): string {
  return addressFormUrlFor(ctx.baseUrl, ctx.userId, draft);
}

function parseContactInput(raw: string): { customerName: string; phone: string; address: string } | null {
  const cleaned = raw.trim();
  const phoneMatch = cleaned.match(/0\d{1,2}[-\s]?\d{3}[-\s]?\d{4}/);
  if (!phoneMatch) return null;

  const phoneRaw = phoneMatch[0];
  const phone = phoneRaw.replace(/[\s-]+/g, "");
  const phoneIdx = cleaned.indexOf(phoneRaw);
  const before = cleaned.slice(0, phoneIdx).replace(/[/,|:\n]+/g, " ").trim();
  const after = cleaned.slice(phoneIdx + phoneRaw.length).replace(/^[/,|:\s-]+/, "").trim();

  let customerName = before;
  let address = after;
  if (!customerName && after) {
    const parts = after.split(/[/|\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      customerName = parts[0];
      address = parts.slice(1).join(" ");
    }
  }
  if (!customerName || address.length < 8) return null;
  return { customerName, phone, address };
}

// ============================================================
// Entry
// ============================================================

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  // ตรวจลายเซ็นด้วยค่าที่มีอยู่แล้วทันที (env/แคช) — โหลดจาก Apps Script เฉพาะตอนยังไม่มีค่าเลย
  let secret = (getRuntimeConfig().lineChannelSecret || "").trim();
  if (!secret) {
    await loadAppSettings();
    secret = (getRuntimeConfig().lineChannelSecret || "").trim();
  }
  if (!secret) {
    // ไม่ตั้ง secret = ตรวจไม่ได้ว่ามาจาก LINE จริง → ไม่รับ (ใครก็ปลอมข้อความ/กดปุ่มแอดมินได้)
    console.error("[LINE Webhook] LINE_CHANNEL_SECRET is not set — rejecting all events");
    return NextResponse.json({ ok: false, error: "LINE_CHANNEL_SECRET not configured" }, { status: 500 });
  }
  if (!isValidLineSignature(rawBody, req.headers.get("x-line-signature"), secret)) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  let events: LineWebhookEvent[] = [];
  try {
    events = (JSON.parse(rawBody || "{}") as { events?: LineWebhookEvent[] }).events || [];
  } catch {
    return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }
  if (events.length === 0) return NextResponse.json({ ok: true });

  // ตอบ LINE ว่า "รับแล้ว" ทันที แล้วค่อยทำงานเบื้องหลัง — ถ้าตอบช้า LINE จะส่ง event เดิมซ้ำ (reply token ใช้ไม่ได้)
  const baseUrlHint = resolvePublicBaseUrl(req, getRuntimeConfig().publicBaseUrl);
  const work = () => processEvents(events, req, baseUrlHint);
  try {
    after(work);
  } catch {
    // นอก request ของ Next (เช่นสคริปต์ทดสอบ) — ทำให้เสร็จก่อนตอบ
    await work();
  }
  return NextResponse.json({ ok: true });
}

async function processEvents(events: LineWebhookEvent[], req: NextRequest, baseUrlHint: string) {
  // log สั้นๆ ไว้ไล่ปัญหา (ไม่มีข้อความ/รหัสลูกค้า)
  console.log(
    "[LINE Webhook]",
    events.map((ev) => `${ev.source?.type || "?"}:${ev.type}${ev.message ? "/" + ev.message.type : ""}${ev.deliveryContext?.isRedelivery ? " (redelivery)" : ""}`).join(", ")
  );

  // โชว์ "กำลังพิมพ์…" ให้ลูกค้าก่อนอย่างอื่น
  const earlyToken = getRuntimeConfig().lineChannelAccessToken || "";
  await Promise.all(
    events
      .filter((ev) => ev.source?.type === "user" && ev.source.userId && (ev.type === "message" || ev.type === "postback"))
      .map((ev) => showLineLoadingAnimation(ev.source!.userId!, earlyToken, 20))
  );

  // โหลดค่าตั้งค่า + ฐานข้อมูล (รหัสกลุ่ม/บัญชีแอดมินที่ผูกไว้มากับข้อมูลชีต)
  await loadAppSettings();
  await getAllDatabase().catch((err) => console.warn("[LINE Webhook] preload failed", err));
  const cfg = getRuntimeConfig();
  const token = cfg.lineChannelAccessToken || "";
  if (!token) {
    console.error("[LINE Webhook] LINE_CHANNEL_ACCESS_TOKEN is not set — cannot reply");
    return;
  }
  const baseUrl = cfg.publicBaseUrl ? resolvePublicBaseUrl(req, cfg.publicBaseUrl) : baseUrlHint;

  for (const ev of events) {
    if (alreadyHandled(ev)) continue;
    const userId = ev.source?.userId || "";
    // push แทนการตอบได้เฉพาะ event ที่ LINE ส่งซ้ำ (reply token ของรอบซ้ำมักใช้ไม่ได้)
    // event ปกติถ้าตอบไม่สำเร็จจะไม่ push ซ้ำ — กันลูกค้าได้ข้อความเบิ้ลและกันโควต้า push หมด
    const pushFallback = ev.deliveryContext?.isRedelivery ? userId || undefined : undefined;
    const ctx: Ctx = {
      ev,
      userId,
      token,
      cfg,
      baseUrl,
      reply: (messages) => replyLineMessage(ev.replyToken || "", messages, token, pushFallback),
    };
    try {
      await handleEvent(ctx);
    } catch (err) {
      console.error("[LINE Webhook] event failed", ev.type, err);
      if (ev.replyToken && ev.source?.type === "user") {
        await ctx.reply([text(`ขออภัยครับ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง หรือโทร ${shopInfo.phone} ครับ 🙏`)]);
      }
    }
  }
}

async function handleEvent(ctx: Ctx) {
  const { ev } = ctx;
  const sourceType = ev.source?.type;
  if (sourceType === "group" || sourceType === "room") {
    return handleGroupEvent(ctx, ev.source?.groupId || ev.source?.roomId || "");
  }
  if (!ctx.userId || !ev.replyToken) return;

  if (ev.type === "follow") {
    const { data } = await getAllDatabase();
    await ctx.reply(buildWelcomeFlex(activeRoundOf(data)));
    return;
  }
  if (ev.type === "postback") {
    const params = new URLSearchParams(ev.postback?.data || "");
    const action = params.get("action") || "";
    if (action.startsWith("admin_")) {
      // ปุ่มแอดมินรุ่นเก่า — ตอนนี้ทำรายการในหน้าออเดอร์บนเว็บแทน
      await ctx.reply([text("การ์ดนี้เป็นรุ่นเก่า ใช้ปุ่ม “เปิดออเดอร์” ในการ์ดแจ้งเตือนใหม่แทนครับ", false)]);
      return;
    }
    return handleCustomerPostback(ctx, action, params);
  }
  if (ev.type === "message" && ev.message) {
    return handleCustomerMessage(ctx);
  }
}

// ============================================================
// กลุ่มแอดมิน
// ============================================================

function isAdminGroup(ctx: Ctx, groupId: string): boolean {
  return Boolean(groupId && ctx.cfg.lineAdminGroupId && groupId === ctx.cfg.lineAdminGroupId);
}

const ADMIN_GROUP_INTRO = [
  "✅ กลุ่มนี้เป็นกลุ่มแจ้งเตือนแอดมินแล้ว",
  "",
  "กลุ่มนี้รับแค่การแจ้งเตือน (ออเดอร์ใหม่ / สลิป / เคลม / ลูกค้าทักแอดมิน)",
  "ทุกการ์ดมีปุ่ม:",
  "⚖️ เปิดออเดอร์ — ชั่งน้ำหนัก ยืนยันสลิป จัดส่ง ยกเลิก ในหน้าเว็บ (ล็อกอินแอดมินครั้งแรกด้วย PIN)",
  "💬 แชทลูกค้า — เปิดห้องแชทใน LINE OA Manager",
].join("\n");

async function handleGroupEvent(ctx: Ctx, groupId: string) {
  const { ev } = ctx;
  if (!ev.replyToken) return;
  const replyGroup = (msgs: unknown[]) => replyLineMessage(ev.replyToken || "", msgs, ctx.token);

  if (ev.type === "join") {
    await replyGroup([
      text(
        `🍈 สวัสดีครับ บอทร้าน${shopInfo.name}\nถ้าจะใช้กลุ่มนี้รับแจ้งเตือนออเดอร์ ให้แอดมินพิมพ์:\n/bind-admin <PIN หลังบ้าน>`,
        false
      ),
    ]);
    return;
  }
  // กลุ่มรับแค่การแจ้งเตือน: ไม่มีคำสั่งหรือปุ่มทำรายการ (การ์ดรุ่นเก่าที่มีปุ่ม postback กดแล้วไม่มีผล)
  if (ev.type !== "message" || ev.message?.type !== "text") return;

  const raw = (ev.message.text || "").trim();
  const lower = raw.toLowerCase();
  const admin = isAdminGroup(ctx, groupId);

  if (lower.startsWith("/bind-admin")) {
    const pin = raw.replace(/^\/bind-admin/i, "").trim();
    if (!ctx.cfg.adminPin) {
      await replyGroup([text("ยังไม่ได้ตั้ง ADMIN_PIN ที่ Vercel — ผูกกลุ่มไม่ได้ครับ", false)]);
    } else if (pin !== ctx.cfg.adminPin) {
      await replyGroup([text("❌ PIN ไม่ถูกต้อง (พิมพ์ /bind-admin <PIN>)", false)]);
    } else {
      await setLineAdminTarget("group", groupId);
      await replyGroup([text(ADMIN_GROUP_INTRO, false)]);
    }
    return;
  }
  if (lower === "รหัสกลุ่ม" || lower === "/group" || lower === "group id") {
    await replyGroup([
      text(`📌 Group ID: ${groupId}\n${admin ? "✅ เป็นกลุ่มแอดมิน" : "❌ ยังไม่ได้ผูก (พิมพ์ /bind-admin <PIN>)"}`, false),
    ]);
  }
  // ข้อความอื่นในกลุ่ม: ไม่ตอบ
}

// ============================================================
// ลูกค้า: ปุ่ม (postback)
// ============================================================

/** ลูกค้ากด "ได้รับของแล้ว" → จัดส่งสำเร็จ (เฉพาะออเดอร์ของตัวเองที่กำลังจัดส่ง) */
async function confirmReceived(ctx: Ctx, orderId: string) {
  const { data } = await getAllDatabase(true);
  const order = ordersOfUser(data, ctx.userId).find((o) => o.id === orderId);
  if (!order) {
    await ctx.reply([text("ไม่พบออเดอร์นี้ในบัญชี LINE ของคุณครับ")]);
    return;
  }
  const status = orderStatusOf(order);
  if (status === "จัดส่งสำเร็จ") {
    await ctx.reply([text(`ออเดอร์ ${order.id} บันทึกว่าได้รับของแล้วครับ 🙏`)]);
    return;
  }
  if (status !== "กำลังจัดส่ง") {
    await ctx.reply([text(`ออเดอร์ ${order.id} ยังไม่ได้ออกจัดส่งครับ (สถานะ: ${status})`)]);
    return;
  }
  const res = await markDelivered(order.id, "customer-line", { notifyCustomer: false });
  if (!res.ok || !res.order) {
    await ctx.reply([text(res.ok ? "บันทึกแล้วครับ" : res.error)]);
    return;
  }
  await ctx.reply(buildDeliveredNoticeFlex(res.order));
  await notifyAdmins([text(`📦 ลูกค้ายืนยันได้รับของแล้ว\nออเดอร์ ${order.id} — ${order.customerName}`, false)]);
}

async function handleCustomerPostback(ctx: Ctx, action: string, params: URLSearchParams) {
  switch (action) {
    case "cancel":
      clearLineSession(ctx.userId);
      await ctx.reply([text("ยกเลิกรายการแล้วครับ เลือกเมนูด้านล่างต่อได้เลย")]);
      return;
    case "received":
      return confirmReceived(ctx, params.get("orderId") || "");
    case "stock":
      return replyStock(ctx);
    case "order":
      return replyCatalog(ctx);
    case "my_orders":
    case "status":
      return replyMyOrders(ctx);
    case "track_order":
      return replyOwnOrderStatus(ctx, params.get("orderId") || "");
    case "open_ticket":
      return startTicket(ctx, params.get("orderId") || undefined);
    case "claim":
      return params.get("orderId") ? startClaimForOrder(ctx, params.get("orderId") || "") : startClaim(ctx);
    case "claim_order":
      return startClaimForOrder(ctx, params.get("orderId") || "");
    case "promo": {
      const { data } = await getAllDatabase();
      await ctx.reply(buildPromotionsCarouselFlex(data.promotions || []));
      return;
    }
    case "live":
      await ctx.reply(buildLiveStreamFlex(ctx.cfg));
      return;
    case "more": {
      const { data } = await getAllDatabase();
      await ctx.reply(buildMoreMenuFlex(ctx.baseUrl, activeRoundOf(data)));
      return;
    }
    case "order_pick":
      return replyQtyPicker(ctx, params.get("productId") || params.get("pid") || "");
    case "order_step": {
      const step = params.get("step") || "qty";
      if (step === "qty") return replyQtyPicker(ctx, params.get("pid") || "");
      if (step === "ripeness") {
        return replyRipenessPicker(ctx, params.get("pid") || "", clampQty(params.get("qty")));
      }
      // ปุ่มรุ่นก่อน (step=address / step=confirm) ที่ยังค้างอยู่ในแชท → การ์ดยืนยันชุดใหม่
      const draft = draftFromParams(params);
      if (draft) return replyBookingReview(ctx, draft);
      return replyCatalog(ctx);
    }
    case "order_confirm": {
      const draft = draftFromParams(params);
      if (!draft || !draft.key) return replyCatalog(ctx);
      return confirmBooking(ctx, draft);
    }
    case "attach_slip":
      return promptSlip(ctx, params.get("orderId") || "");
    case "confirm_without_slip":
    case "confirm_saved_address":
      // ปุ่มรุ่นก่อน: แสดงสถานะออเดอร์แทน
      return replyMyOrders(ctx);
    default:
      await ctx.reply(buildWelcomeFlex());
  }
}

// ------------------------------------------------------------
// เมนูทั่วไป
// ------------------------------------------------------------

async function replyStock(ctx: Ctx) {
  clearLineSession(ctx.userId);
  const { data } = await getAllDatabase();
  await ctx.reply(buildStockOverviewMessages(activeRoundOf(data), data.products, "stock", ctx.baseUrl));
}

async function replyCatalog(ctx: Ctx) {
  clearLineSession(ctx.userId);
  const { data } = await getAllDatabase();
  await ctx.reply(buildOrderCatalogMessages(data.products, activeRoundOf(data), ctx.baseUrl));
}

async function replyMyOrders(ctx: Ctx) {
  clearLineSession(ctx.userId);
  const { data } = await getAllDatabase();
  const orders = ordersOfUser(data, ctx.userId);
  if (orders.length === 0) {
    await ctx.reply([text("ยังไม่มีออเดอร์ในบัญชี LINE นี้ครับ\nกด \"สั่งซื้อทุเรียน\" เพื่อจองได้เลย หรือพิมพ์เลขออเดอร์ที่ได้จากหน้าเว็บ")]);
    return;
  }
  await ctx.reply(buildUserOrdersFlex(orders, data.claims || [], ctx.baseUrl));
}

/** ดูสถานะได้เฉพาะออเดอร์ของตัวเอง (เลขออเดอร์เดาง่าย — กันคนอื่นส่องชื่อ/ยอด) */
async function replyOwnOrderStatus(ctx: Ctx, orderRef: string) {
  const { data } = await getAllDatabase();
  const order = findOrderById(ordersOfUser(data, ctx.userId), orderRef);
  if (!order) {
    await ctx.reply([
      text(`ไม่พบออเดอร์ ${orderRef} ในบัญชี LINE นี้ครับ\nถ้าสั่งผ่านหน้าเว็บ เช็กได้ที่ ${ctx.baseUrl || "หน้าเว็บร้าน"}/tracking`),
    ]);
    return;
  }
  const flex = buildCustomerStatusFlex(order);
  if (flex[0] && typeof flex[0] === "object") (flex[0] as Record<string, unknown>).quickReply = buildMainQuickReply();
  await ctx.reply(flex);
}

// ------------------------------------------------------------
// จอง: จำนวน → ความสุก → ยืนยัน
// ------------------------------------------------------------

async function loadOrderableProduct(ctx: Ctx, productId: string) {
  const { data } = await getAllDatabase();
  const product = data.products.find((p) => p.id === productId);
  const stock = product ? formatProductStock(product) : null;
  if (!product || !product.isAvailable || stock?.isOutOfStock) {
    await ctx.reply([text("ขออภัยครับ สินค้านี้หมดหรือปิดรับจองชั่วคราว ลองดูพันธุ์อื่นได้เลยครับ 🍈")]);
    return null;
  }
  return { data, product, stock };
}

async function replyQtyPicker(ctx: Ctx, productId: string) {
  const loaded = await loadOrderableProduct(ctx, productId);
  if (!loaded) return;
  setLineSession(ctx.userId, { flow: "order", step: "pick_qty", productId, updatedAt: Date.now() });
  await ctx.reply(buildQtyPickerMessage(loaded.product, loaded.stock?.summary));
}

async function replyRipenessPicker(ctx: Ctx, productId: string, qty: number) {
  const loaded = await loadOrderableProduct(ctx, productId);
  if (!loaded) return;
  clearLineSession(ctx.userId);
  await ctx.reply(buildRipenessPickerMessage(loaded.product, qty, RIPENESS_OPTIONS));
}

/** หาชื่อ/ที่อยู่ลูกค้า — ไม่เจอในแคชให้อ่านสดอีกรอบ (เพิ่งกรอกฟอร์มจาก instance อื่น) */
async function loadContact(lineUserId: string) {
  let { data } = await getAllDatabase();
  let contact = contactOf(findLineUser(data, lineUserId));
  if (!contact) {
    ({ data } = await getAllDatabase(true));
    contact = contactOf(findLineUser(data, lineUserId));
  }
  return { data, contact };
}

async function replyBookingReview(ctx: Ctx, draft: BookingDraft) {
  const loaded = await loadOrderableProduct(ctx, draft.productId);
  if (!loaded) return;
  const { contact } = await loadContact(ctx.userId);
  const withKey = { ...draft, key: draft.key || newBookingKey() };
  if (!contact) {
    // ยังไม่มีที่อยู่: ฟอร์มที่อยู่จะส่งการ์ดยืนยันกลับมาเอง / พิมพ์ในแชทก็ได้ (จำร่างไว้แบบชั่วคราว)
    setLineSession(ctx.userId, { flow: "order", step: "enter_contact", draft: draftToParams(withKey), updatedAt: Date.now() });
    await ctx.reply(
      buildNeedAddressMessage(
        `${loaded.product.name} x${withKey.qty} (${ripenessLabel(withKey.ripeness)})`,
        addressFormUrl(ctx, withKey)
      )
    );
    return;
  }
  clearLineSession(ctx.userId);
  await ctx.reply(bookingReviewMessages(withKey, loaded.product, contact, ctx.baseUrl, ctx.userId));
}

async function confirmBooking(ctx: Ctx, draft: BookingDraft) {
  const { contact } = await loadContact(ctx.userId);
  if (!contact) return replyBookingReview(ctx, draft);
  const ship = shopInfo.shippingMethods[draft.ship] || shopInfo.shippingMethods[0];
  const ripeness = ripenessLabel(draft.ripeness);

  const res = await submitNewOrder(
    {
      customerName: contact.name,
      phone: contact.phone,
      address: contact.address,
      ripenessPref: ripeness,
      shippingMethod: ship.name,
      lineUserId: ctx.userId,
      channel: "LINE OA",
      bookingKey: draft.key,
      createdBy: "line-customer",
      items: [{ productId: draft.productId, qty: draft.qty, ripenessPref: ripeness }],
    },
    { skipCustomerNotify: true }
  );
  clearLineSession(ctx.userId);
  if (!res.ok) {
    await ctx.reply([text(`จองไม่สำเร็จครับ: ${res.error}`)]);
    return;
  }
  const messages = buildBookingReceiptFlex(res.order);
  if (res.duplicate) messages.unshift(text(`ℹ️ การจองนี้บันทึกไว้แล้วครับ (ออเดอร์ #${res.order.id}) — ไม่ได้สร้างซ้ำ`, false));
  await ctx.reply(messages);
}

// ------------------------------------------------------------
// สลิป
// ------------------------------------------------------------

async function promptSlip(ctx: Ctx, orderRef: string) {
  const { data } = await getAllDatabase();
  const order = findOrderById(ordersOfUser(data, ctx.userId), orderRef);
  if (!order) {
    await ctx.reply([text(`ไม่พบออเดอร์ ${orderRef} ในบัญชีนี้ครับ`)]);
    return;
  }
  const status = orderStatusOf(order);
  if (status === "สั่งจอง") {
    await ctx.reply([text(`ออเดอร์ #${order.id} ยังรอแอดมินชั่งน้ำหนักครับ ยังไม่ต้องโอน\nชั่งเสร็จจะส่งยอดจริงพร้อม QR ให้ในแชทนี้ครับ 🍈`)]);
    return;
  }
  if (status !== "รอชำระเงิน") {
    await ctx.reply([text(`ออเดอร์ #${order.id} ${ORDER_STATUS_META[status].customerHint}`)]);
    return;
  }
  await ctx.reply([
    text(
      `📸 ส่ง "รูปสลิป" ของออเดอร์ #${order.id} เข้ามาในแชทนี้ได้เลยครับ\nยอดที่ต้องโอน ฿${(order.totalPrice + order.shippingCost).toLocaleString()}\n\nแอดมินตรวจยอดแล้วจะแจ้งยืนยันให้ครับ`
    ),
  ]);
}

async function handleImage(ctx: Ctx, messageId: string) {
  const session = getLineSession(ctx.userId);
  if (session?.flow === "claim" && session.step === "enter_detail") {
    return finishClaim(ctx, { imageMessageId: messageId });
  }

  const { data } = await getAllDatabase(true);
  const awaiting = findAwaitingPaymentOrders(data.orders, ctx.userId);
  const media = await downloadAndVerifyLineImage(messageId, ctx.token, "slip");

  if (awaiting.length > 0) {
    if (!media.ok || !media.apiPath) {
      await ctx.reply([text(`อ่านรูปสลิปไม่ได้ (${media.reason}) รบกวนส่งเป็นรูป JPG/PNG อีกครั้งครับ`)]);
      return;
    }
    // อ่าน QR บนสลิป: ธนาคารผู้โอน + เลขรายการ → กันรูปที่ไม่ใช่สลิปและสลิปที่เคยใช้กับออเดอร์อื่น
    const qr = media.buffer ? await readSlipQr(media.buffer) : { found: false };
    const slipCheck = checkSlip(qr, data.orders, awaiting[0].id);
    // อ่านยอด + บัญชีผู้รับจากตัวหนังสือบนสลิป (OCR ฟรีผ่าน Google Drive ของร้าน) และเก็บรูปถาวร
    const target = awaiting[0];
    const expected = (target.totalPrice || 0) + (target.shippingCost || 0);
    const ocr = media.buffer
      ? await ocrSlipImage(media.buffer, media.contentType || "image/jpeg", `${target.id}-${messageId}.${media.filename?.split(".").pop() || "jpg"}`).catch((err) => {
          console.warn("[LINE Webhook] slip OCR failed", String(err));
          return null;
        })
      : null;
    const textCheck = ocr ? readSlipText(ocr.text, expected, getBankAccount()) : null;
    console.log("[LINE Webhook] slip QR", slipCheck, qr.bankCode || "-", "amount", textCheck?.amountCheck || "-", "account", textCheck?.accountCheck || "-");
    // submitSlip ส่งใบรับสลิปให้ลูกค้า + แจ้งกลุ่มแอดมิน (พร้อมผลตรวจ QR) ให้กดยืนยันเอง
    const res = await submitSlip(awaiting[0].id, media.apiPath, "customer-line", {
      slipRef: qr.transRef,
      slipBank: qr.bankName,
      slipCheck,
      slipFileUrl: ocr?.fileUrl,
      slipAmount: textCheck?.amount,
      slipAmountCheck: textCheck?.amountCheck,
      slipAccountCheck: textCheck?.accountCheck,
    });
    // ยอดขาด/ผิดบัญชี: บอกลูกค้าทันที (แอดมินเห็นผลเดียวกันในการ์ดแจ้งเตือน)
    if (res.ok && textCheck && (textCheck.amountCheck === "mismatch" || textCheck.accountCheck === "mismatch")) {
      await ctx.reply([
        text(`⚠️ ตรวจสลิปของออเดอร์ ${target.id} แล้วพบว่า\n${textCheck.notes.filter((n) => /ขาด|เกิน|ไม่ใช่บัญชีร้าน/.test(n)).join("\n")}\n\nยอดที่ต้องโอน: ฿${expected.toLocaleString()}\nโอนเข้า: ${getBankAccount().bank} ${getBankAccount().number} (${getBankAccount().name})\nแอดมินจะตรวจอีกครั้งครับ ถ้าโอนเพิ่มส่งสลิปใหม่เข้ามาได้เลย`),
      ]);
    }
    if (!res.ok) await ctx.reply([text(res.error)]);
    else if (awaiting.length > 1) {
      await ctx.reply([
        text(`ผูกสลิปกับออเดอร์ล่าสุด #${awaiting[0].id} แล้วครับ (มีอีก ${awaiting.length - 1} ออเดอร์ที่รอชำระ — ถ้าผิดใบ กด "คุยกับแอดมิน")`),
      ]);
    }
    return;
  }

  // ไม่มีออเดอร์ที่รอโอน: ส่งรูปให้แอดมินดู แต่ไม่ไปเปลี่ยนสถานะออเดอร์ไหน
  const booked = ordersOfUser(data, ctx.userId).find((o) => orderStatusOf(o) === "สั่งจอง");
  const user = findLineUser(data, ctx.userId);
  const imageUrl = media.ok && ctx.baseUrl ? `${ctx.baseUrl}${media.apiPath}` : "";
  await notifyAdmins([
    text(
      `🖼️ ลูกค้าส่งรูปทางแชท (ไม่มีออเดอร์ที่รอโอน)\n👤 ${user ? contactOf(user)?.name || user.displayName : "ลูกค้า LINE"}${booked ? `\n📦 มีออเดอร์จอง #${booked.id} (ยังไม่ชั่ง)` : ""}`,
      false
    ),
    ...(imageUrl ? [{ type: "image", originalContentUrl: imageUrl, previewImageUrl: imageUrl }] : []),
  ]);
  await ctx.reply([
    text(
      booked
        ? `ได้รับรูปแล้วครับ 🙏 ออเดอร์ #${booked.id} ยังรอแอดมินชั่งน้ำหนัก ยังไม่ต้องโอนนะครับ — ชั่งเสร็จจะส่งยอดจริงให้`
        : "ได้รับรูปแล้วครับ แอดมินจะดูและตอบกลับในแชทนี้ครับ 🙏"
    ),
  ]);
}

// ------------------------------------------------------------
// ที่อยู่ที่ลูกค้าพิมพ์ / ปักหมุดในแชท
// ------------------------------------------------------------

async function saveContactAndContinue(
  ctx: Ctx,
  contact: { customerName?: string; phone?: string; address: string; mapsUrl?: string; latitude?: number; longitude?: number },
  source: string
) {
  const user = await upsertLineUser({
    lineUserId: ctx.userId,
    customerName: contact.customerName,
    phone: contact.phone,
    address: contact.address,
    mapsUrl: contact.mapsUrl,
    latitude: contact.latitude,
    longitude: contact.longitude,
    source,
  });
  const saved = contactOf(user);
  const session = getLineSession(ctx.userId);
  const draft =
    session?.flow === "order" && session.step === "enter_contact" && session.draft
      ? draftFromParams(new URLSearchParams(session.draft))
      : null;

  if (draft && saved) {
    const { data } = await getAllDatabase();
    const product = data.products.find((p) => p.id === draft.productId);
    if (product) {
      clearLineSession(ctx.userId);
      await ctx.reply([
        text(`📍 บันทึกที่อยู่แล้วครับ ตรวจสอบแล้วกดยืนยันการจองได้เลย`, false),
        ...bookingReviewMessages(draft, product, saved, ctx.baseUrl, ctx.userId),
      ]);
      return;
    }
  }
  if (!saved) {
    await ctx.reply([
      text(
        `📍 บันทึกตำแหน่งแล้วครับ\nยังขาด${!user.phone ? "เบอร์โทร" : "ชื่อผู้รับ"} — พิมพ์ชื่อและเบอร์มาได้เลย เช่น สมชาย 0812345678 หรือกรอกฟอร์ม: ${addressFormUrl(ctx, draft || undefined)}`
      ),
    ]);
    return;
  }
  await ctx.reply([
    text(`🍈 บันทึกที่อยู่จัดส่งแล้วครับ\n👤 ${saved.name}\n📞 ${saved.phone}\n📍 ${saved.address}\n\nกด "สั่งซื้อทุเรียน" เพื่อจองได้เลยครับ`),
  ]);
}

// ------------------------------------------------------------
// Ticket คุยกับแอดมิน
// ------------------------------------------------------------

async function startTicket(ctx: Ctx, orderId?: string) {
  setLineSession(ctx.userId, { flow: "ticket", step: "await_message", orderId, updatedAt: Date.now() });
  await ctx.reply([
    {
      type: "text",
      text: `💬 พิมพ์เรื่องที่อยากสอบถามส่งมาได้เลยครับ${orderId ? ` (ออเดอร์ #${orderId})` : ""}\nทีมงานจะได้รับแจ้งเตือนทันที แล้วตอบกลับในแชทนี้ครับ 🙏`,
      quickReply: {
        items: ["สอบถามสถานะพัสดุ", "สอบถามเรื่องความสุก", "แจ้งเปลี่ยนที่อยู่", "ยกเลิก"].map((t) => ({
          type: "action",
          action: { type: "message", label: t, text: t },
        })),
      },
    },
  ]);
}

async function sendTicket(ctx: Ctx, message: string, orderId?: string) {
  const ticketId = `TCK-${Math.floor(100000 + Math.random() * 900000)}`;
  const { data } = await getAllDatabase();
  const user = findLineUser(data, ctx.userId);
  await notifyAdmins(
    buildTicketAlertForAdmin(
      {
        ticketId,
        customerName: contactOf(user)?.name || user?.displayName || "ลูกค้า LINE",
        phone: user?.phone,
        lineUserId: ctx.userId,
        orderId,
        message,
        createdAt: new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
      },
      ctx.baseUrl
    )
  );
  clearLineSession(ctx.userId);
  await ctx.reply([text(`✅ ส่งเรื่องถึงแอดมินแล้วครับ (Ticket #${ticketId})\nแอดมินจะตอบกลับในแชทนี้โดยเร็วครับ 🙏`)]);
}

// ------------------------------------------------------------
// เคลม (ใช้ความจำชั่วคราวของแชท — ถ้าหายลูกค้าเริ่มใหม่ได้จากเมนูแจ้งเคลม)
// ------------------------------------------------------------

const CLAIM_POLICY_TEXT =
  "🛡️ รับเคลมฟรี\n• สุกพร้อมทาน/เนื้อล้วน: ภายใน 24 ชม. หลังได้รับของ\n• แก่จัด/บ่มเอง: ภายใน 72 ชม. หลังได้รับของ";

const CLAIM_REASONS = ["ยังไม่สุก / แข็ง", "สุกงอม / เน่าเสีย", "เนื้อเละ / ขึ้นรา", "น้ำหนักไม่ครบ", "กล่องพัสดุเสียหาย"];

async function startClaim(ctx: Ctx) {
  const { data } = await getAllDatabase();
  const eligible = ordersOfUser(data, ctx.userId).filter((o) => checkClaimEligibility(o, data.claims || []).eligible);
  setLineSession(ctx.userId, { flow: "claim", step: "enter_order", updatedAt: Date.now() });
  if (eligible.length > 0) {
    await ctx.reply(
      quickReplyMsg(`${CLAIM_POLICY_TEXT}\n\nเลือกออเดอร์ที่ต้องการเคลม หรือพิมพ์เลขออเดอร์ครับ`, [
        ...eligible.slice(0, 5).map((o) => ({ label: `เคลม #${o.id}`, text: o.id })),
        { label: "ยกเลิก", text: "ยกเลิก" },
      ])
    );
    return;
  }
  await ctx.reply(
    quickReplyMsg(`${CLAIM_POLICY_TEXT}\n\nพิมพ์เลขออเดอร์ (เช่น OD000012) ที่ต้องการเคลมครับ`, [{ label: "ยกเลิก", text: "ยกเลิก" }])
  );
}

async function startClaimForOrder(ctx: Ctx, orderRef: string) {
  const { data } = await getAllDatabase();
  const order = findOrderById(data.orders, extractOrderId(orderRef) || orderRef);
  if (!order) {
    await ctx.reply(quickReplyMsg(`❌ ไม่พบเลขออเดอร์ "${orderRef}" ครับ ตรวจสอบอีกครั้ง`, [{ label: "ยกเลิก", text: "ยกเลิก" }]));
    return;
  }
  const owned = ordersOfUser(data, ctx.userId).some((o) => o.id === order.id);
  if (!owned) {
    // ออเดอร์จากหน้าเว็บ (ไม่ได้ผูก LINE): ให้ยืนยันด้วยเบอร์ที่ใช้สั่ง
    setLineSession(ctx.userId, { flow: "claim", step: "enter_phone", orderId: order.id, updatedAt: Date.now() });
    await ctx.reply(quickReplyMsg(`ยืนยันตัวตน: พิมพ์เบอร์โทรที่ใช้สั่งออเดอร์ #${order.id} ครับ`, [{ label: "ยกเลิก", text: "ยกเลิก" }]));
    return;
  }
  return askClaimReason(ctx, order, data);
}

async function askClaimReason(ctx: Ctx, order: Order, data: DatabaseState) {
  const eligibility = checkClaimEligibility(order, data.claims || []);
  if (!eligibility.eligible) {
    clearLineSession(ctx.userId);
    await ctx.reply([text(eligibility.reason || "ออเดอร์นี้แจ้งเคลมไม่ได้ครับ")]);
    return;
  }
  setLineSession(ctx.userId, { flow: "claim", step: "pick_reason", orderId: order.id, phone: order.phone, updatedAt: Date.now() });
  await ctx.reply(
    quickReplyMsg(`✅ ออเดอร์ #${order.id} อยู่ในระยะรับประกัน\nพบปัญหาแบบไหนครับ?`, [
      ...CLAIM_REASONS.map((r) => ({ label: r, text: r })),
      { label: "ยกเลิก", text: "ยกเลิก" },
    ])
  );
}

async function finishClaim(ctx: Ctx, input: { imageMessageId?: string; description?: string }) {
  const session = getLineSession(ctx.userId);
  if (session?.flow !== "claim" || !session.orderId) return startClaim(ctx);
  let evidenceName: string | undefined;
  if (input.imageMessageId) {
    const saved = await downloadAndVerifyLineImage(input.imageMessageId, ctx.token, "claim");
    if (saved.ok) evidenceName = saved.apiPath;
  }
  const res = await submitNewClaim({
    orderId: session.orderId,
    phone: session.phone,
    lineUserId: ctx.userId,
    reason: session.reason || "อื่น ๆ",
    description: input.description || (evidenceName ? "ส่งรูปหลักฐานทางแชท LINE" : "แจ้งเคลมทาง LINE"),
    evidenceName,
  });
  clearLineSession(ctx.userId);
  if (!res.ok) {
    await ctx.reply([text(`ส่งเคลมไม่สำเร็จ: ${res.error}`)]);
    return;
  }
  await ctx.reply(buildClaimReceiptForCustomerFlex(res.claim));
}

async function continueClaim(ctx: Ctx, msg: string): Promise<boolean> {
  const session = getLineSession(ctx.userId);
  if (session?.flow !== "claim") return false;

  if (session.step === "enter_order") {
    await startClaimForOrder(ctx, msg);
    return true;
  }
  if (session.step === "enter_phone") {
    const { data } = await getAllDatabase();
    const order = session.orderId ? findOrderById(data.orders, session.orderId) : undefined;
    if (!order || cleanDigits(msg).length < 9 || cleanDigits(order.phone) !== cleanDigits(msg)) {
      clearLineSession(ctx.userId);
      await ctx.reply([text("เบอร์โทรไม่ตรงกับออเดอร์นี้ครับ ถ้าต้องการความช่วยเหลือ กด \"คุยกับแอดมิน\" ได้เลย")]);
      return true;
    }
    await askClaimReason(ctx, order, data);
    return true;
  }
  if (session.step === "pick_reason") {
    setLineSession(ctx.userId, { ...session, step: "enter_detail", reason: msg.slice(0, 100) });
    await ctx.reply(
      quickReplyMsg("ส่งรูปทุเรียนเป็นหลักฐาน หรือพิมพ์อธิบายเพิ่มได้เลยครับ", [
        { label: "ไม่มีรายละเอียดเพิ่ม", text: "แจ้งเคลมตามอาการที่เลือก" },
        { label: "ยกเลิก", text: "ยกเลิก" },
      ])
    );
    return true;
  }
  if (session.step === "enter_detail") {
    await finishClaim(ctx, { description: msg.slice(0, 500) });
    return true;
  }
  return false;
}

// ============================================================
// ลูกค้า: ข้อความ
// ============================================================

const TEXT_COMMANDS: { match: (t: string) => boolean; run: (ctx: Ctx) => Promise<void> }[] = [
  {
    match: (t) => ["สั่ง", "สั่งซื้อ", "สั่งทุเรียน", "สั่งซื้อทุเรียน", "จอง", "สั่งจอง", "จองทุเรียน", "สั่งจองทุเรียน", "เปิดจอง"].includes(t),
    run: replyCatalog,
  },
  {
    match: (t) => t.includes("เช็กสต็อก") || t.includes("เช็คสต็อก") || ["สต็อก", "สต๊อค", "เมนู", "ดูสินค้า"].includes(t),
    run: replyStock,
  },
  {
    match: (t) =>
      ["เช็กสถานะ", "เช็คสถานะ", "เช็กสถานะออเดอร์", "เช็กพัสดุ", "เช็คพัสดุ", "สถานะ", "ประวัติคำสั่งซื้อ", "ออเดอร์ของฉัน", "คำสั่งซื้อของฉัน"].includes(t) ||
      t.includes("ประวัติการสั่ง"),
    run: replyMyOrders,
  },
  { match: (t) => ["แจ้งเคลม", "เคลม", "แจ้งเคลม 100%", "ส่งเคลม"].includes(t), run: startClaim },
  {
    match: (t) => ["คุยกับแอดมิน", "ติดต่อแอดมิน", "แอดมิน", "สอบถาม", "ช่วยด้วย", "ติดต่อเจ้าหน้าที่", "ถามแอดมิน", "ticket"].includes(t),
    run: (ctx) => startTicket(ctx),
  },
  {
    match: (t) => t.includes("โปรโมชั่น") || t === "โปร",
    run: async (ctx) => {
      const { data } = await getAllDatabase();
      await ctx.reply(buildPromotionsCarouselFlex(data.promotions || []));
    },
  },
  {
    match: (t) => t.includes("ไลฟ์สด") || t === "live" || t === "ดูไลฟ์",
    run: async (ctx) => {
      await ctx.reply(buildLiveStreamFlex(ctx.cfg));
    },
  },
  {
    match: (t) => t === "เพิ่มเติม" || t === "เว็บไซต์" || t.includes("หน้าเว็บไซต์"),
    run: async (ctx) => {
      const { data } = await getAllDatabase();
      await ctx.reply(buildMoreMenuFlex(ctx.baseUrl, activeRoundOf(data)));
    },
  },
  {
    match: (t) => ["ที่อยู่", "ที่อยู่ของฉัน", "เช็คที่อยู่", "เช็กที่อยู่", "แก้ไขที่อยู่", "เปลี่ยนที่อยู่", "ข้อมูลจัดส่ง", "ข้อมูลของฉัน"].includes(t),
    run: async (ctx) => {
      const { contact } = await loadContact(ctx.userId);
      await ctx.reply(
        buildAddressFormFlex(contact ? { customerName: contact.name, phone: contact.phone, address: contact.address } : null, addressFormUrl(ctx))
      );
    },
  },
];

async function handleCustomerMessage(ctx: Ctx) {
  const msg = ctx.ev.message!;

  if (msg.type === "image" && msg.id) return handleImage(ctx, msg.id);

  if (msg.type === "location") {
    const mapsUrl =
      typeof msg.latitude === "number" && typeof msg.longitude === "number"
        ? `https://www.google.com/maps?q=${msg.latitude},${msg.longitude}`
        : "";
    const place = [msg.title, msg.address].filter(Boolean).join(" ").trim() || "ตำแหน่งที่ปักหมุด";
    const { data } = await getAllDatabase();
    const existing = findLineUser(data, ctx.userId);
    return saveContactAndContinue(
      ctx,
      {
        customerName: contactOf(existing)?.name || undefined,
        phone: existing?.phone || undefined,
        address: mapsUrl ? `${place}\n📍 หมุดแผนที่: ${mapsUrl}` : place,
        mapsUrl: mapsUrl || undefined,
        latitude: msg.latitude,
        longitude: msg.longitude,
      },
      "line-location"
    );
  }

  if (msg.type !== "text") {
    await ctx.reply(buildWelcomeFlex());
    return;
  }

  const raw = (msg.text || "").trim();
  const lower = raw.toLowerCase();

  if (["ยกเลิก", "cancel", "เริ่มใหม่"].includes(lower)) {
    clearLineSession(ctx.userId);
    await ctx.reply([text("ยกเลิกรายการแล้วครับ เลือกเมนูด้านล่างต่อได้เลย")]);
    return;
  }
  if (lower === "myid") {
    await ctx.reply([text(`LINE User ID ของคุณ:\n${ctx.userId}`, false)]);
    return;
  }
  // ผูกบัญชีนี้เป็นแอดมินสำรอง (รับแจ้งเตือนในแชทส่วนตัว + กดปุ่มแอดมินได้) — ต้องมี PIN
  if (lower.startsWith("/admin")) {
    const pin = raw.replace(/^\/admin/i, "").trim();
    if (!ctx.cfg.adminPin || pin !== ctx.cfg.adminPin) {
      await ctx.reply([text("❌ PIN ไม่ถูกต้อง (พิมพ์ /admin <PIN หลังบ้าน>)", false)]);
      return;
    }
    await setLineAdminTarget("user", ctx.userId);
    await ctx.reply([text("✅ ผูกบัญชีนี้เป็นแอดมินรับแจ้งเตือนสำรองแล้วครับ", false)]);
    return;
  }

  const command = TEXT_COMMANDS.find((c) => c.match(lower));
  if (command) {
    if (getLineSession(ctx.userId)?.flow !== "ticket") clearLineSession(ctx.userId);
    return command.run(ctx);
  }

  const session = getLineSession(ctx.userId);

  if (session?.flow === "ticket") return sendTicket(ctx, raw.slice(0, 1000), session.orderId);
  if (await continueClaim(ctx, raw)) return;

  // พิมพ์จำนวนเองหลังเลือกสินค้า
  if (session?.flow === "order" && session.step === "pick_qty" && session.productId && /^\d{1,2}$/.test(raw)) {
    const qty = Number(raw);
    if (qty >= 1 && qty <= 10) return replyRipenessPicker(ctx, session.productId, qty);
  }

  const contact = parseContactInput(raw);
  if (contact) return saveContactAndContinue(ctx, contact, "line-chat");

  const orderCode = extractOrderId(raw);
  if (orderCode) return replyOwnOrderStatus(ctx, orderCode);

  const { data } = await getAllDatabase();
  await ctx.reply(buildWelcomeFlex(activeRoundOf(data)));
}

