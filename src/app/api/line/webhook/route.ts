import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getAllDatabase,
  getRuntimeConfig,
  saveRuntimeConfig,
  setAdminGroupId,
  updateOrderRecord,
  updateProductRecord,
  upsertLineUser,
} from "../../../../lib/sheets-db";
import {
  buildAddressFormFlex,
  buildBookingReceiptFlex,
  buildClaimReceiptForCustomerFlex,
  buildCustomerStatusFlex,
  buildLiveStreamFlex,
  buildMainQuickReply,
  buildMoreMenuFlex,
  buildOrderSummaryForCustomerFlex,
  buildOrderCatalogMessages,
  buildPaymentConfirmedFlex,
  buildPaymentQrForCustomerFlex,
  buildUserOrdersFlex,
  buildPromotionsCarouselFlex,
  buildPromptPayQrPaymentFlex,
  buildShippedNoticeFlex,
  buildSlipAlertForAdmin,
  buildSlipSubmittedReceiptFlex,
  buildStockOverviewMessages,
  buildTicketAlertForAdmin,
  buildWelcomeFlex,
  pushLineMessage,
  replyLineMessage,
  showLineLoadingAnimation,
} from "../../../../lib/line-notify";
import { checkClaimEligibility } from "../../../../lib/claim-policy";
import { downloadAndVerifyLineImage } from "../../../../lib/line-media";
import {
  clearLineSession,
  getLineSession,
  setLineSession,
} from "../../../../lib/line-sessions";
import {
  submitNewClaim,
  submitNewOrder,
} from "../../../../lib/order-service";
import { formatProductStock } from "../../../../lib/stock";
import { isValidLineSignature } from "../../../../lib/line-verify";
import { extractOrderId, findOrderById } from "../../../../lib/ids";
import { canTransitionOrderStatus, normalizeOrderStatus } from "../../../../lib/order-status";
import { shopInfo } from "../../../../data/mock";
import type { Order } from "../../../../types/durian";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface LineWebhookEvent {
  type: string;
  webhookEventId?: string;
  deliveryContext?: { isRedelivery?: boolean };
  replyToken?: string;
  source?: { userId?: string };
  postback?: { data?: string };
  message?: { id?: string; type: string; text?: string };
}

// In-memory deduplication of LINE webhook events (protects against retry loops)
const processedEventIds = new Map<string, number>();
const activeProcessingEventIds = new Set<string>();

function shouldSkipWebhookEvent(ev: LineWebhookEvent): boolean {
  const eventId = ev.webhookEventId;
  if (!eventId) return false;

  const now = Date.now();
  // Evict items older than 15 minutes if map grows large
  if (processedEventIds.size > 1000) {
    for (const [id, ts] of processedEventIds.entries()) {
      if (now - ts > 15 * 60 * 1000) {
        processedEventIds.delete(id);
      }
    }
  }

  if (processedEventIds.has(eventId) || activeProcessingEventIds.has(eventId)) {
    console.warn(
      `[LINE Webhook] Skipping duplicate/redelivered event: ${eventId} (isRedelivery=${Boolean(
        ev.deliveryContext?.isRedelivery
      )})`
    );
    return true;
  }

  activeProcessingEventIds.add(eventId);
  return false;
}

function markWebhookEventFinished(ev: LineWebhookEvent) {
  const eventId = ev.webhookEventId;
  if (eventId) {
    activeProcessingEventIds.delete(eventId);
    processedEventIds.set(eventId, Date.now());
  }
}

function resolvePublicBaseUrl(req: NextRequest, configuredUrl?: string): string {
  if (configuredUrl && configuredUrl.startsWith("https://")) {
    return configuredUrl.replace(/\/+$/, "");
  }
  const fwdHost =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const fwdProto = req.headers.get("x-forwarded-proto") || "https";
  if (
    fwdHost &&
    !fwdHost.startsWith("localhost") &&
    !fwdHost.startsWith("127.0.0.1")
  ) {
    return `${fwdProto}://${fwdHost}`.replace(/\/+$/, "");
  }
  return "";
}

function parseContactInput(raw: string): {
  customerName: string;
  phone: string;
  address: string;
} | null {
  const cleaned = raw.trim();
  const phoneMatch = cleaned.match(/0\d{1,2}[-\s]?\d{3}[-\s]?\d{4}/);
  if (!phoneMatch) return null;

  const phoneRaw = phoneMatch[0];
  const phone = phoneRaw.replace(/\s+/g, "");
  const phoneIdx = cleaned.indexOf(phoneRaw);
  const before = cleaned.slice(0, phoneIdx).replace(/[/,|:\n]+/g, " ").trim();
  const after = cleaned
    .slice(phoneIdx + phoneRaw.length)
    .replace(/^[/,|:\s-]+/, "")
    .trim();

  let customerName = before;
  let address = after;

  if (!customerName && after) {
    const parts = after
      .split(/[/|\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      customerName = parts[0];
      address = parts.slice(1).join(" ");
    }
  }

  if (!customerName || !address) return null;
  return { customerName, phone, address };
}

function resolveShippingOption(input?: string) {
  const query = (input || "").trim().toLowerCase();
  return (
    shopInfo.shippingMethods.find(
      (s) =>
        s.name.toLowerCase() === query ||
        (query && s.name.toLowerCase().includes(query))
    ) || shopInfo.shippingMethods[0]
  );
}

function quickReplyMsg(text: string, options: { label: string; text: string }[]) {
  return [
    {
      type: "text",
      text,
      quickReply: {
        items: options.map((opt) => ({
          type: "action",
          action: {
            type: "message",
            label: opt.label.slice(0, 20),
            text: opt.text,
          },
        })),
      },
    },
  ];
}

export async function POST(req: NextRequest) {
  try {
    // ตรวจว่ามาจาก LINE จริง (ใช้ Channel secret ของ Messaging API: 2012537899)
    const rawBody = await req.text();
    const sigHeader = req.headers.get("x-line-signature");
    const configuredSecret = (process.env.LINE_CHANNEL_SECRET || "").trim();
    const messagingChannelSecret = "356a87feb4277a81d8e558e9ca1805a7";

    let signatureValid = false;
    if (configuredSecret && isValidLineSignature(rawBody, sigHeader, configuredSecret)) {
      signatureValid = true;
    } else if (isValidLineSignature(rawBody, sigHeader, messagingChannelSecret)) {
      signatureValid = true;
    } else if (!configuredSecret) {
      console.warn("[security] LINE_CHANNEL_SECRET ยังไม่ได้ตั้ง");
      signatureValid = true;
    }

    if (!signatureValid) {
      console.error("[LINE Webhook] Invalid signature from LINE");
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody || "{}") as { events?: LineWebhookEvent[] };
    const cfg = getRuntimeConfig();
    const token =
      cfg.lineChannelAccessToken ||
      process.env.LINE_CHANNEL_ACCESS_TOKEN ||
      "PdFpuOJEzMXiSaUJDIssLxWbbXYtaUE0/e6/1IVXsGDWtu+MpuSsxtx+p2JAZYnh5L68apEKj1Pr8ceQ3UCv9nONR954SD4V8acz6dNxKoghEA0GKanpmzY+p+bM82oxNGaC2Z+LqK1HBSa+Rt/GPgdB04t89/1O/w1cDnyilFU=";
    const publicBaseUrl = resolvePublicBaseUrl(req, cfg.publicBaseUrl);
    const events = body.events || [];

    for (const ev of events) {
      if (shouldSkipWebhookEvent(ev)) {
        continue;
      }
      try {
        const replyToken = ev.replyToken;
        const userId = ev.source?.userId || "";
        if (!replyToken || !token) continue;

      // แสดง Animation จุดสามจุด (...) ขยับได้ "กำลังพิมพ์..." ให้ลูกค้าเห็นทันทีทุกครั้งที่กดริชเมนูหรือส่งข้อความ
      if (userId) {
        await showLineLoadingAnimation(userId, token, 15);
      }

      // 0. Bot Joined a Group Event (Greeting only - never auto-bind admin group!)
      if (ev.type === "join") {
        await replyLineMessage(
          replyToken,
          [
            {
              type: "text",
              text: `🎉 สวัสดีครับ! บอทร้านทุเรียนวินคินพร้อมให้บริการครับ 🍈✨`,
            },
          ],
          token
        );
        continue;
      }

      // Group message handling
      const evSource = ev.source as any;
      if (evSource?.type === "group" || evSource?.type === "room") {
        const groupId = evSource?.groupId || evSource?.roomId || "";
        const adminGroupId = cfg.lineAdminGroupId || process.env.LINE_ADMIN_GROUP_ID || "";
        const isAdminGroup = Boolean(adminGroupId && groupId === adminGroupId);
        const rawMsg = ev.message?.type === "text" ? (ev.message.text || "").trim() : "";
        const msgText = rawMsg.toLowerCase();

        // Safe explicit bind command with PIN (e.g. /bind-admin 1234)
        if (msgText.startsWith("/bind-admin")) {
          const pin = rawMsg.replace(/^\/bind-admin/i, "").trim();
          const validPin = cfg.adminPin || "135775";
          if (pin === validPin) {
            await setAdminGroupId(groupId);
            await replyLineMessage(
              replyToken,
              [
                {
                  type: "text",
                  text: `🍈 ยืนยันรหัส PIN ถูกต้อง!\n\n📌 ผูก Group ID: ${groupId} เป็นกลุ่มแจ้งเตือนแอดมินเรียบร้อยแล้วครับ ✅\n(บันทึกถาวรลงระบบเรียบร้อย)`,
                },
              ],
              token,
              userId
            );
          } else {
            await replyLineMessage(
              replyToken,
              [{ type: "text", text: "❌ รหัส PIN ไม่ถูกต้องครับ (พิมพ์ /bind-admin <PIN 6 หลัก>)" }],
              token,
              userId
            );
          }
          continue;
        }

        if (
          msgText === "รหัสกลุ่ม" ||
          msgText === "/group" ||
          msgText === "group id" ||
          msgText === "groupid"
        ) {
          const currentAdminGroupId = cfg.lineAdminGroupId || process.env.LINE_ADMIN_GROUP_ID || "";
          const isCurrentAdminGroup = Boolean(currentAdminGroupId && groupId === currentAdminGroupId);
          await replyLineMessage(
            replyToken,
            [
              {
                type: "text",
                text: `📌 Group ID: ${groupId}\nสถานะกลุ่มแอดมิน: ${isCurrentAdminGroup ? "✅ เป็นกลุ่มแอดมินรับแจ้งเตือน" : "❌ ยังไม่ได้ผูกเป็นกลุ่มแอดมิน"}\n\nหากต้องการใช้กลุ่มนี้รับแจ้งเตือนออเดอร์ ให้พิมพ์:\n/bind-admin <PIN>`,
              },
            ],
            token,
            userId
          );
          continue;
        }

        // If this is NOT the authorized admin group, ignore admin commands completely
        if (!isAdminGroup) {
          continue;
        }

        // Admin quick weigh command in admin group: ชั่ง <OrderID> <WeightKg>
        const weighMatchGroup = rawMsg.match(/^(?:ชั่ง|นน|weight)\s+([a-zA-Z0-9_-]+)\s+([0-9.]+)/i);
        if (weighMatchGroup) {
          const orderTargetId = weighMatchGroup[1].trim();
          const weightNum = parseFloat(weighMatchGroup[2]);
          const { data } = await getAllDatabase();
          const foundOrder = findOrderById(data.orders, orderTargetId);
          if (!foundOrder) {
            await replyLineMessage(
              replyToken,
              [{ type: "text", text: `❌ ไม่พบคำสั่งซื้อ "${orderTargetId}" ในระบบครับ` }],
              token,
              userId
            );
            continue;
          }

          const currentStatus = normalizeOrderStatus(foundOrder.orderStatus);
          if (currentStatus !== "สั่งจอง" && currentStatus !== "รอชำระเงิน") {
            await replyLineMessage(
              replyToken,
              [{ type: "text", text: `⚠️ ออเดอร์ #${foundOrder.id} อยู่ในสถานะ "${foundOrder.orderStatus}" ไม่สามารถบันทึกชั่งน้ำหนักได้ (ชั่งได้เฉพาะสถานะ สั่งจอง หรือ รอชำระเงิน)` }],
              token,
              userId
            );
            continue;
          }

          const firstItem = foundOrder.items?.[0];
          const prod = data.products.find((p) => p.id === firstItem?.productId || p.name === firstItem?.productName || p.id === (foundOrder as any).productId) || data.products[0];
          const pricePerKg = prod?.pricePerKg || prod?.price || 220;
          const qty = firstItem?.qty || foundOrder.quantity || 1;
          const calculatedTotal = Math.round(weightNum * pricePerKg * qty);
          const shippingCost = foundOrder.shippingCost || 0;
          const grandTotal = calculatedTotal + shippingCost;

          const updated = await updateOrderRecord(foundOrder.id, {
            weightPerItem: `${weightNum} กก.`,
            totalPrice: calculatedTotal,
            grandTotal,
            orderStatus: "รอชำระเงิน",
            weighedAt: new Date().toISOString(),
            updatedBy: "Admin (LINE Weigh)",
            updatedAt: new Date().toISOString(),
          });

          await replyLineMessage(
            replyToken,
            [
              {
                type: "text",
                text: `✅ บันทึกน้ำหนักออเดอร์ #${foundOrder.id} สำเร็จ!\n\n📦 สินค้า: ${prod?.name || foundOrder.productName || foundOrder.id}\n⚖️ น้ำหนักจริง: ${weightNum} กก.\n💰 ยอดรวมจริง: ฿${grandTotal.toLocaleString()} (จาก ฿${pricePerKg}/กก. รวมส่ง ฿${shippingCost})\n📌 สถานะ: 🟠 รอชำระเงิน\n\n📲 ระบบส่งบิลยอดจริงพร้อม QR PromptPay ให้ลูกค้าทางแชทเรียบร้อยครับ! 🍈✨`,
              },
            ],
            token,
            userId
          );

          if (updated && updated.lineUserId) {
            await pushLineMessage(
              updated.lineUserId,
              buildPaymentQrForCustomerFlex(updated, publicBaseUrl),
              token
            );
          }
          continue;
        }

        // Admin group check stock command
        if (msgText.includes("สต็อก") || msgText.includes("stock") || msgText.includes("สินค้า")) {
          const { data } = await getAllDatabase();
          const activeRound = data.rounds.find((r) => r.status === "open") || data.rounds[0];
          const stockMessages = buildStockOverviewMessages(activeRound, data.products, "stock", publicBaseUrl);
          await replyLineMessage(replyToken, stockMessages, token);
          continue;
        }

        // Admin group check recent orders command
        if (msgText.includes("ออเดอร์") || msgText.includes("order") || msgText.includes("ยอดขาย") || msgText.includes("รายการสั่ง")) {
          const { data } = await getAllDatabase();
          const pendingWeigh = data.orders.filter((o) => o.orderStatus === "รอชั่งน้ำหนัก/สรุปยอด");
          const pendingPay = data.orders.filter((o) => o.orderStatus === "รอชำระเงิน");
          const readyShip = data.orders.filter((o) => o.orderStatus === "ชำระเงินแล้ว/เตรียมจัดส่ง");
          const textSummary = [
            `📋 สรุปรายการคำสั่งซื้อร้านทุเรียนวิ่นขิ่น`,
            `----------------------------------`,
            `⚖️ รอชั่งน้ำหนัก: ${pendingWeigh.length} รายการ`,
            pendingWeigh.slice(0, 3).map((o) => `• #${o.id}: ${o.customerName} (${o.items[0]?.productName || ""})`).join("\n"),
            `\n💳 รอชำระเงิน: ${pendingPay.length} รายการ`,
            pendingPay.slice(0, 3).map((o) => `• #${o.id}: ฿${o.totalPrice.toLocaleString()}`).join("\n"),
            `\n📦 เตรียมจัดส่ง: ${readyShip.length} รายการ`,
            `----------------------------------`,
            `💡 คำสั่งชั่งน้ำหนักพิมพ์: ชั่ง <OrderID> <กก.>`,
            `เช่น: ชั่ง OD000001 3.85`,
          ].filter(Boolean).join("\n");

          await replyLineMessage(replyToken, [{ type: "text", text: textSummary }], token);
          continue;
        }

        // Admin group help command
        if (msgText.includes("คำสั่ง") || msgText.includes("help") || msgText === "?" || msgText === "ช่วยเหลือ") {
          await replyLineMessage(
            replyToken,
            [
              {
                type: "text",
                text: `🍈 คำสั่งแอดมินในกลุ่ม LINE ทุเรียนวิ่นขิ่น:\n\n1. ชั่ง <รหัสออเดอร์> <นน.กก.>\n   เช่น: ชั่ง OD000001 3.85\n   (คำนวณราคาจริง อัปเดตชีต และส่งบิล QR ให้ลูกค้าทันที)\n\n2. สต็อก (เช็คสต็อกทุเรียนหน้าสวน)\n3. ออเดอร์ (ดูสรุปออเดอร์ที่ค้างอยู่)\n4. รหัสกลุ่ม (เช็ค Group ID)`,
              },
            ],
            token
          );
          continue;
        }

        // In group, ignore other casual chatter so team conversation isn't interrupted
        continue;
      }

      // 1. Follow Event -> Welcome Card
      if (ev.type === "follow") {
        const { data } = await getAllDatabase();
        const activeRound =
          data.rounds.find((r) => r.status === "open") || data.rounds[0];
        await replyLineMessage(replyToken, buildWelcomeFlex(activeRound), token);
        continue;
      }

      // 2. Postback Button Event
      if (ev.type === "postback") {
        const params = new URLSearchParams(ev.postback?.data || "");
        const action = params.get("action") || "";

        if (action === "cancel") {
          clearLineSession(userId);
          await replyLineMessage(
            replyToken,
            [
              {
                type: "text",
                text: "ยกเลิกรายการแล้วครับ เลือกเมนูด้านล่างต่อได้เลย",
                quickReply: buildMainQuickReply(),
              },
            ],
            token
          );
          continue;
        }

        if (action === "stock") {
          clearLineSession(userId);
          const { data } = await getAllDatabase();
          const activeRound =
            data.rounds.find((r) => r.status === "open") || data.rounds[0];
          await replyLineMessage(
            replyToken,
            buildStockOverviewMessages(
              activeRound,
              data.products,
              "stock",
              publicBaseUrl
            ),
            token
          );
          continue;
        }

        if (action === "order") {
          clearLineSession(userId);
          const { data } = await getAllDatabase();
          const activeRound =
            data.rounds.find((r) => r.status === "open") || data.rounds[0];
          await replyLineMessage(
            replyToken,
            buildOrderCatalogMessages(
              data.products,
              activeRound,
              publicBaseUrl
            ),
            token
          );
          continue;
        }

        if (action === "my_orders") {
          clearLineSession(userId);
          const { data } = await getAllDatabase();
          const cleanPhone = (p?: string) => (p || "").replace(/[^\d]/g, "");
          const users = Array.isArray(data?.users) ? data.users : [];
          const userObj = users.find((u) => u.lineUserId === userId);
          const userPhone = cleanPhone(userObj?.phone);
          const userOrders = (data.orders || []).filter(
            (o) =>
              (o.lineUserId && o.lineUserId === userId) ||
              (o.userId && (o.userId === userId || o.userId === userObj?.id)) ||
              (userPhone && cleanPhone(o.phone) === userPhone)
          );
          await replyLineMessage(
            replyToken,
            buildUserOrdersFlex(userOrders, data.claims || [], publicBaseUrl),
            token
          );
          continue;
        }

        if (action === "track_order") {
          const orderId = params.get("orderId") || "";
          const { data } = await getAllDatabase();
          const order = data.orders.find((o) => o.id.toUpperCase() === orderId.toUpperCase());
          if (order) {
            const flex = buildCustomerStatusFlex(order);
            await replyLineMessage(replyToken, flex, token);
          } else {
            await replyLineMessage(
              replyToken,
              [
                {
                  type: "text",
                  text: `ไม่พบข้อมูลออเดอร์ ${orderId} ในระบบครับ`,
                  quickReply: buildMainQuickReply(),
                },
              ],
              token
            );
          }
          continue;
        }

        // ----------------------------------------------------
        // Action: open_ticket (Customer wants to talk to admin / open support ticket)
        // ----------------------------------------------------
        if (action === "open_ticket") {
          const orderId = params.get("orderId") || "";
          setLineSession(userId, {
            flow: "ticket",
            step: "await_message",
            orderId,
            updatedAt: Date.now(),
          });
          await replyLineMessage(
            replyToken,
            [
              {
                type: "text",
                text: `🍈 สอบถามทีมงาน / เปิด Ticket ติดต่อแอดมิน 💬${orderId ? `\n(อ้างอิงออเดอร์ #${orderId})` : ""}\n\nกรุณาพิมพ์ข้อความหรือคำถามของคุณส่งเข้ามาในแชทนี้ได้เลยครับ\n\nทีมงานจะได้รับการแจ้งเตือนเข้ากลุ่มแอดมินทันที และจะรีบเปิดแชทเข้ามาตอบกลับคุณโดยเร็วที่สุดครับ 🙏`,
                quickReply: {
                  items: [
                    { type: "action", action: { type: "message", label: "สอบถามสถานะพัสดุ", text: "สอบถามสถานะพัสดุ" } },
                    { type: "action", action: { type: "message", label: "สอบถามเรื่องความสุก", text: "สอบถามเรื่องความสุก" } },
                    { type: "action", action: { type: "message", label: "แจ้งเปลี่ยนที่อยู่", text: "แจ้งเปลี่ยนที่อยู่" } },
                    { type: "action", action: { type: "message", label: "ยกเลิก", text: "ยกเลิก" } },
                  ],
                },
              },
            ],
            token
          );
          continue;
        }

        // ----------------------------------------------------
        // Action: order_step (Stateless Ordering Wizard: Variety -> Qty -> Ripeness -> Address -> PromptPay QR)
        // ----------------------------------------------------
        if (action === "order_step" || action === "order_pick") {
          const step = params.get("step") || (action === "order_pick" ? "qty" : "qty");
          const pid = params.get("pid") || params.get("productId") || "WK-01";
          const qty = Math.max(1, parseInt(params.get("qty") || "1", 10) || 1);
          const ripeness = params.get("ripeness") || "กรอบนอกนุ่มใน (ไก่ฉีก)";

          const { data } = await getAllDatabase();
          const prod = data.products.find((p) => p.id === pid) || data.products[0];
          const pricePerKg = prod?.pricePerKg || prod?.price || 220;
          const avgWeight = prod?.avgWeightKg || parseFloat(prod?.weight || "4.0") || 4.0;
          const stockInfo = prod ? formatProductStock(prod) : null;

          if (!prod || !prod.isAvailable || stockInfo?.isOutOfStock) {
            await replyLineMessage(
              replyToken,
              [
                {
                  type: "text",
                  text: "ขออภัยครับ สินค้าพันธุ์นี้หมดสต็อกชั่วคราวแล้ว กดสั่งซื้อเพื่อดูพันธุ์อื่นนะครับ 🍈",
                  quickReply: buildMainQuickReply(),
                },
              ],
              token
            );
            continue;
          }

          // Step 1: Qty Selection (เลือกกี่ลูก - ราคาต่อกิโลกรัม)
          if (step === "qty") {
            setLineSession(userId, {
              flow: "order",
              step: "pick_qty",
              productId: prod.id,
              productName: prod.name,
              price: pricePerKg,
              updatedAt: Date.now(),
            });

            await replyLineMessage(
              replyToken,
              [
                {
                  type: "text",
                  text: `🍈 ${prod.name}\n💰 ราคา: ฿${pricePerKg.toLocaleString()} / กิโลกรัม (ไม่ใช่ราคาต่อลูก)\n⚖️ น้ำหนักประมาณ ${prod.weight || "3.5 - 4.5 กก."} ต่อลูก\n📦 สต็อก: ${stockInfo?.summary || "มีสินค้าพร้อมส่ง"}\n\nต้องการรับกี่ลูกดีครับ? (กดเลือกจำนวนด้านล่างได้เลยครับ):`,
                  quickReply: {
                    items: [
                      {
                        type: "action",
                        action: {
                          type: "postback",
                          label: "1 ลูก",
                          data: `action=order_step&step=ripeness&pid=${encodeURIComponent(prod.id)}&qty=1`,
                          displayText: "1 ลูก",
                        },
                      },
                      {
                        type: "action",
                        action: {
                          type: "postback",
                          label: "2 ลูก",
                          data: `action=order_step&step=ripeness&pid=${encodeURIComponent(prod.id)}&qty=2`,
                          displayText: "2 ลูก",
                        },
                      },
                      {
                        type: "action",
                        action: {
                          type: "postback",
                          label: "3 ลูก",
                          data: `action=order_step&step=ripeness&pid=${encodeURIComponent(prod.id)}&qty=3`,
                          displayText: "3 ลูก",
                        },
                      },
                      {
                        type: "action",
                        action: {
                          type: "postback",
                          label: "4 ลูก",
                          data: `action=order_step&step=ripeness&pid=${encodeURIComponent(prod.id)}&qty=4`,
                          displayText: "4 ลูก",
                        },
                      },
                      {
                        type: "action",
                        action: {
                          type: "postback",
                          label: "5 ลูก",
                          data: `action=order_step&step=ripeness&pid=${encodeURIComponent(prod.id)}&qty=5`,
                          displayText: "5 ลูก",
                        },
                      },
                      {
                        type: "action",
                        action: { type: "message", label: "ยกเลิก", text: "ยกเลิก" },
                      },
                    ],
                  },
                },
              ],
              token
            );
            continue;
          }

          // Step 2: Ripeness Selection (เลือกระดับความสุก / Texture)
          if (step === "ripeness") {
            setLineSession(userId, {
              flow: "order",
              step: "pick_ripeness",
              productId: prod.id,
              productName: prod.name,
              price: pricePerKg,
              qty,
              updatedAt: Date.now(),
            });

            await replyLineMessage(
              replyToken,
              [
                {
                  type: "text",
                  text: `🍈 ${prod.name} จำนวน ${qty} ลูก\n💰 ราคา: ฿${pricePerKg.toLocaleString()} / กก. (คัดแก่จัด 85%+)\n\nเลือกระดับความสุก/Texture ที่ต้องการได้เลยครับ:`,
                  quickReply: {
                    items: [
                      {
                        type: "action",
                        action: {
                          type: "postback",
                          label: "กรอบนอกนุ่มใน",
                          data: `action=order_step&step=address&pid=${encodeURIComponent(prod.id)}&qty=${qty}&ripeness=${encodeURIComponent("กรอบนอกนุ่มใน (ไก่ฉีก)")}`,
                          displayText: "กรอบนอกนุ่มใน (ไก่ฉีก)",
                        },
                      },
                      {
                        type: "action",
                        action: {
                          type: "postback",
                          label: "สุกพอดีกิน",
                          data: `action=order_step&step=address&pid=${encodeURIComponent(prod.id)}&qty=${qty}&ripeness=${encodeURIComponent("สุกพอดีกิน (เนื้อเนียนครีม)")}`,
                          displayText: "สุกพอดีกิน (เนื้อเนียนครีม)",
                        },
                      },
                      {
                        type: "action",
                        action: {
                          type: "postback",
                          label: "ห่าม-กรอบมัน",
                          data: `action=order_step&step=address&pid=${encodeURIComponent(prod.id)}&qty=${qty}&ripeness=${encodeURIComponent("ห่าม-กรอบมัน")}`,
                          displayText: "ห่าม-กรอบมัน",
                        },
                      },
                      {
                        type: "action",
                        action: {
                          type: "postback",
                          label: "สุกงอมหวานจัด",
                          data: `action=order_step&step=address&pid=${encodeURIComponent(prod.id)}&qty=${qty}&ripeness=${encodeURIComponent("สุกงอม (เนื้อนุ่มหวานจัด)")}`,
                          displayText: "สุกงอม (เนื้อนุ่มหวานจัด)",
                        },
                      },
                      {
                        type: "action",
                        action: { type: "message", label: "ยกเลิก", text: "ยกเลิก" },
                      },
                    ],
                  },
                },
              ],
              token
            );
            continue;
          }

          // Step 3: Address Confirmation (ยืนยันที่อยู่)
          if (step === "address") {
            const users = Array.isArray(data?.users) ? data.users : [];
            const userObj = users.find((u) => u.lineUserId === userId);
            const hasSavedAddress = Boolean(userObj && userObj.address && userObj.phone);

            setLineSession(userId, {
              flow: "order",
              step: "enter_contact",
              productId: prod.id,
              productName: prod.name,
              price: pricePerKg,
              qty,
              ripenessPref: ripeness,
              updatedAt: Date.now(),
            });

            if (hasSavedAddress && userObj) {
              const customerName = `${userObj.firstName || ""} ${userObj.lastName || ""}`.trim() || userObj.displayName || "คุณลูกค้า";
              const addressBubble = {
                type: "bubble",
                header: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#1B4D31",
                  paddingAll: "lg",
                  contents: [
                    {
                      type: "text",
                      text: "📍 ยืนยันที่อยู่จัดส่งทุเรียน",
                      color: "#FDE047",
                      weight: "bold",
                      size: "md",
                    },
                    {
                      type: "text",
                      text: `${prod.name} x${qty} ลูก (${ripeness})`,
                      color: "#FFFFFF",
                      size: "xs",
                      margin: "xs",
                    },
                  ],
                },
                body: {
                  type: "box",
                  layout: "vertical",
                  spacing: "sm",
                  contents: [
                    {
                      type: "text",
                      text: `👤 ผู้รับ: ${customerName}`,
                      weight: "bold",
                      size: "sm",
                      color: "#111827",
                    },
                    {
                      type: "text",
                      text: `📞 เบอร์โทร: ${userObj.phone}`,
                      size: "xs",
                      color: "#4B5563",
                    },
                    {
                      type: "text",
                      text: `🏠 ที่อยู่: ${userObj.address}`,
                      size: "xs",
                      color: "#374151",
                      wrap: true,
                    },
                  ],
                },
                footer: {
                  type: "box",
                  layout: "vertical",
                  spacing: "sm",
                  contents: [
                    {
                      type: "button",
                      style: "primary",
                      color: "#15803D",
                      height: "sm",
                      action: {
                        type: "postback",
                        label: "✅ ยืนยันการจอง",
                        data: `action=order_step&step=confirm&pid=${encodeURIComponent(prod.id)}&qty=${qty}&ripeness=${encodeURIComponent(ripeness)}&use_saved=1&bkey=BK_${userId.slice(-6)}_${prod.id}_${qty}_${Date.now().toString(36)}`,
                        displayText: "ยืนยันการจอง",
                      },
                    },
                    {
                      type: "button",
                      style: "secondary",
                      height: "sm",
                      action: {
                        type: "message",
                        label: "✏️ พิมพ์ที่อยู่ใหม่ในแชท",
                        text: "เปลี่ยนที่อยู่",
                      },
                    },
                  ],
                },
              };

              await replyLineMessage(
                replyToken,
                [
                  {
                    type: "flex",
                    altText: "ยืนยันที่อยู่จัดส่งทุเรียน",
                    contents: addressBubble,
                  },
                ],
                token
              );
              continue;
            } else {
              const formUrl = `${publicBaseUrl || "https://durianwinkin.vercel.app"}/address?userId=${encodeURIComponent(userId)}`;
              await replyLineMessage(
                replyToken,
                [
                  {
                    type: "text",
                    text: `🍈 ได้รับข้อมูล: ${prod.name} x${qty} ลูก (${ripeness})\n\n📍 กรุณาแจ้ง "ชื่อผู้รับ เบอร์โทรศัพท์ 10 หลัก และที่อยู่จัดส่ง" ส่งมาในแชทนี้ได้เลยครับ\n\nตัวอย่าง:\nสมชาย 0812345678 99/1 สุขุมวิท กทม. 10110\n\n(หรือกดปุ่มปักหมุด 🗺️ แผนที่ด้านล่างได้เลยครับ)`,
                    quickReply: {
                      items: [
                        {
                          type: "action",
                          action: { type: "location", label: "🗺️ ปักหมุดแผนที่" },
                        },
                        {
                          type: "action",
                          action: {
                            type: "uri",
                            label: "📝 เปิดฟอร์มที่อยู่",
                            uri: formUrl,
                          },
                        },
                        {
                          type: "action",
                          action: { type: "message", label: "ยกเลิก", text: "ยกเลิก" },
                        },
                      ],
                    },
                  },
                ],
                token
              );
              continue;
            }
          }

          // Step 4: Confirm -> Create Booking with ODxxxxxx and Show Booking Receipt (WITHOUT QR)
          if (step === "confirm") {
            const users = Array.isArray(data?.users) ? data.users : [];
            const userObj = users.find((u) => u.lineUserId === userId);

            // If user has no address/phone, ask for them cleanly (do not create dummy order with "-")
            if (!userObj || !userObj.phone || !userObj.address) {
              const formUrl = `${publicBaseUrl || "https://durianwinkin.vercel.app"}/address?userId=${encodeURIComponent(userId)}`;
              await replyLineMessage(
                replyToken,
                [
                  {
                    type: "text",
                    text: "กรุณาระบุชื่อ เบอร์โทร และที่อยู่จัดส่งเพื่อบันทึกการจองครับ 📍",
                  },
                  ...buildAddressFormFlex(userObj || null, formUrl),
                ],
                token,
                userId
              );
              continue;
            }

            const customerName = (`${userObj.firstName || ""} ${userObj.lastName || ""}`.trim() || userObj.displayName || "ลูกค้า");
            const phone = userObj.phone;
            const address = userObj.address;

            const shipMethod = shopInfo.shippingMethods[0];
            const shippingCost = shipMethod.price;
            const bookingKey = params.get("bkey") || `BK_${userId}_${prod.id}_${qty}`;

            const result = await submitNewOrder(
              {
                customerName,
                phone,
                address,
                ripenessPref: ripeness,
                shippingMethod: shipMethod.name,
                shippingCost,
                lineUserId: userId || undefined,
                channel: "LINE OA",
                orderStatus: "สั่งจอง",
                bookingKey,
                notes: `สั่งจองผ่านระบบแชท LINE OA (ราคา ฿${pricePerKg}/กก. นน.เฉลี่ย ~${avgWeight} กก./ลูก)`,
                items: [
                  {
                    productId: prod.id,
                    qty,
                    ripenessPref: ripeness,
                    weightPerItem: `${avgWeight} กก.`,
                  },
                ],
              },
              { skipCustomerNotify: true }
            );

            clearLineSession(userId);

            if (!result.ok) {
              await replyLineMessage(
                replyToken,
                [{ type: "text", text: `เกิดข้อผิดพลาดในการสร้างคำสั่งจอง: ${result.error}`, quickReply: buildMainQuickReply() }],
                token,
                userId
              );
              continue;
            }

            const createdOrder = result.order;

            // Reply to customer with Booking Receipt (WITHOUT QR CODE!)
            await replyLineMessage(
              replyToken,
              buildBookingReceiptFlex(createdOrder),
              token,
              userId
            );
            continue;
          }
        }

        if (action === "confirm_saved_address") {
          const { data } = await getAllDatabase();
          const users = Array.isArray(data?.users) ? data.users : [];
          const userObj = users.find((u) => u.lineUserId === userId);

          if (!userObj || !userObj.address) {
            const formUrl = `${publicBaseUrl || "https://durianwinkin.vercel.app"}/address?userId=${encodeURIComponent(userId)}`;
            await replyLineMessage(
              replyToken,
              buildAddressFormFlex(null, formUrl),
              token
            );
            continue;
          }

          const currentSession = getLineSession(userId);
          if (currentSession?.flow === "order" && currentSession.step === "enter_contact") {
            const qty = currentSession.qty || 1;
            const prod = data.products.find((p) => p.id === currentSession.productId) || data.products[0];
            const pricePerKg = prod?.pricePerKg || prod?.price || currentSession.price || 220;
            const avgWeight = prod?.avgWeightKg || parseFloat(prod?.weight || "4.0") || 4.0;
            const shipOpt =
              shopInfo.shippingMethods.find(
                (s) => s.name.toLowerCase() === (currentSession.shippingMethod || "").toLowerCase()
              ) || shopInfo.shippingMethods[0];
            const shippingCost = shipOpt.price;
            const customerName =
              `${userObj.firstName || ""} ${userObj.lastName || ""}`.trim() ||
              userObj.displayName ||
              userObj.username ||
              "ลูกค้า";
            const phone = userObj.phone || "";
            const address = userObj.address || "";
            const ripenessPref = currentSession.ripenessPref || "กรอบนอกนุ่มใน (ไก่ฉีก)";

            const orderRes = await submitNewOrder(
              {
                customerName,
                phone,
                address,
                ripenessPref,
                shippingMethod: shipOpt.name,
                shippingCost,
                lineUserId: userId || undefined,
                channel: "LINE OA",
                orderStatus: "สั่งจอง",
                bookingKey: `BK_${userId}_${prod.id}_${qty}_saved`,
                notes: `สั่งจองผ่านแชท LINE OA (ยืนยันที่อยู่เดิม)`,
                items: [
                  {
                    productId: prod.id,
                    qty,
                    ripenessPref,
                    weightPerItem: `${avgWeight} กก.`,
                  },
                ],
              },
              { skipCustomerNotify: true }
            );

            clearLineSession(userId);

            if (!orderRes.ok) {
              await replyLineMessage(
                replyToken,
                [{ type: "text", text: `ไม่สามารถบันทึกคำสั่งจองได้: ${orderRes.error}` }],
                token,
                userId
              );
              continue;
            }

            await replyLineMessage(
              replyToken,
              buildBookingReceiptFlex(orderRes.order),
              token,
              userId
            );
            continue;
          }

          const fallbackName =
            `${userObj.firstName || ""} ${userObj.lastName || ""}`.trim() ||
            userObj.displayName ||
            userObj.username ||
            "คุณลูกค้า";

          await replyLineMessage(
            replyToken,
            [
              {
                type: "text",
                text: `🍈 ที่อยู่จัดส่งของคุณพร้อมใช้งานแล้วครับ!\n\n👤 ${fallbackName}\n📞 ${userObj.phone || "-"}\n📍 ${userObj.address || "-"}\n\nต้องการสั่งซื้อทุเรียนตัดสด กด 'สั่งซื้อ' ได้เลยครับ`,
                quickReply: buildMainQuickReply(),
              },
            ],
            token
          );
          continue;
        }

        if (action === "claim_order") {
          const orderId = params.get("orderId") || "";
          const { data } = await getAllDatabase();
          const order = data.orders.find((o) => o.id.toUpperCase() === orderId.toUpperCase());
          if (!order) {
            await replyLineMessage(
              replyToken,
              [
                {
                  type: "text",
                  text: `ไม่พบข้อมูลออเดอร์ ${orderId} ในระบบครับ`,
                  quickReply: buildMainQuickReply(),
                },
              ],
              token
            );
            continue;
          }

          const eligibility = checkClaimEligibility(order, data.claims || []);
          if (!eligibility.eligible) {
            await replyLineMessage(
              replyToken,
              [
                {
                  type: "text",
                  text: eligibility.reason || "ไม่สามารถแจ้งเคลมออเดอร์นี้ได้ครับ",
                  quickReply: buildMainQuickReply(),
                },
              ],
              token
            );
            continue;
          }

          setLineSession(userId, {
            flow: "claim",
            step: "pick_reason",
            orderId: order.id,
            phone: order.phone,
            updatedAt: Date.now(),
          });

          const isRipen = eligibility.warrantyType === "ready_to_eat";
          const policyNote = isRipen
            ? "🛡️ ทุเรียนสุกพร้อมทาน (รับประกัน 24 ชม. หลังพัสดุส่งถึง)"
            : "🛡️ ทุเรียนแก่จัด/บ่มเอง (รับประกัน 3 วัน / 72 ชม. หลังพัสดุส่งถึง)";

          await replyLineMessage(
            replyToken,
            quickReplyMsg(
              `✅ ยืนยันสิทธิ์เคลมสำเร็จ!\n${policyNote}\nออเดอร์ #${order.id} — พบปัญหาด้านใดครับ?`,
              [
                { label: "ยังไม่สุก / แข็ง", text: "ยังไม่สุก / แข็ง" },
                { label: "สุกงอม / เน่าเสีย", text: "สุกงอม / เน่าเสีย" },
                { label: "เนื้อเละ / ขึ้นรา", text: "เนื้อเละ / ขึ้นรา" },
                { label: "น้ำหนักไม่ครบ", text: "น้ำหนักไม่ครบ" },
                { label: "กล่องพัสดุเสียหาย", text: "กล่องพัสดุเสียหาย" },
                { label: "ยกเลิก", text: "ยกเลิก" },
              ]
            ),
            token
          );
          continue;
        }

        if (action === "promo") {
          clearLineSession(userId);
          const { data } = await getAllDatabase();
          await replyLineMessage(
            replyToken,
            buildPromotionsCarouselFlex(data.promotions || []),
            token
          );
          continue;
        }

        if (action === "live") {
          clearLineSession(userId);
          await replyLineMessage(replyToken, buildLiveStreamFlex(cfg), token);
          continue;
        }

        if (action === "more") {
          clearLineSession(userId);
          const { data } = await getAllDatabase();
          const activeRound =
            data.rounds.find((r) => r.status === "open") || data.rounds[0];
          await replyLineMessage(
            replyToken,
            buildMoreMenuFlex(publicBaseUrl, activeRound),
            token
          );
          continue;
        }

        if (action === "order_pick") {
          const productId = params.get("productId") || "";
          const { data } = await getAllDatabase();
          const prod = data.products.find((p) => p.id === productId);
          const activeRound =
            data.rounds.find((r) => r.status === "open") || data.rounds[0];
          const stockInfo = prod ? formatProductStock(prod) : null;

          if (!prod || !prod.isAvailable || stockInfo?.isOutOfStock) {
            await replyLineMessage(
              replyToken,
              [
                {
                  type: "text",
                  text: "ขออภัยครับ รายการนี้หมดสต็อกชั่วคราวแล้ว กดเช็กสต็อกเพื่อดูพันธุ์อื่นนะครับ",
                  quickReply: buildMainQuickReply(),
                },
              ],
              token
            );
            continue;
          }

          if (
            activeRound &&
            (activeRound.status === "closed" || activeRound.quotaRemaining <= 0)
          ) {
            await replyLineMessage(
              replyToken,
              [
                {
                  type: "text",
                  text: `ขออภัยครับ โควต้ารอบ "${activeRound.name}" เต็มแล้ว รอติดตามรอบหน้านะครับ`,
                  quickReply: buildMainQuickReply(),
                },
              ],
              token
            );
            continue;
          }

          setLineSession(userId, {
            flow: "order",
            step: "pick_qty",
            productId: prod.id,
            productName: prod.name,
            price: prod.price,
            updatedAt: Date.now(),
          });

          await replyLineMessage(
            replyToken,
            quickReplyMsg(
              `🍈 ${prod.name}\n💰 ราคา: ฿${prod.price.toLocaleString()}/${prod.unit}\n📦 สต็อก: ${stockInfo?.summary}\n\nต้องการรับกี่${prod.unit}ดีครับ?`,
              [
                { label: `1 ${prod.unit}`, text: "1" },
                { label: `2 ${prod.unit}`, text: "2" },
                { label: `3 ${prod.unit}`, text: "3" },
                { label: "ยกเลิก", text: "ยกเลิก" },
              ]
            ),
            token
          );
          continue;
        }

        if (action === "attach_slip") {
          const orderId = params.get("orderId") || "";
          setLineSession(userId, {
            flow: "order",
            step: "await_slip",
            orderId,
            productId: "WK-01",
            productName: "ทุเรียนวิ่นขิ่น",
            price: 220,
            updatedAt: Date.now(),
          });
          await replyLineMessage(
            replyToken,
            [
              {
                type: "text",
                text: `📸 กรุณาส่ง "รูปภาพสลิปโอนเงิน" เข้ามาในแชทนี้ได้เลยครับ${orderId ? ` สำหรับออเดอร์ #${orderId}` : ""}\n\nเมื่อส่งรูปสลิปแล้ว แอดมินจะตรวจสอบยอดเงินและยืนยันการจัดส่งให้คุณทันทีครับ ✨`,
                quickReply: {
                  items: [
                    { type: "action", action: { type: "message", label: "ยกเลิก", text: "ยกเลิก" } },
                  ],
                },
              },
            ],
            token,
            userId
          );
          continue;
        }

        if (action === "track_order") {
          const orderId = params.get("orderId") || "";
          const { data } = await getAllDatabase();
          const foundOrder = findOrderById(data.orders, orderId);
          if (foundOrder) {
            await replyLineMessage(
              replyToken,
              buildCustomerStatusFlex(foundOrder),
              token,
              userId
            );
          } else {
            await replyLineMessage(
              replyToken,
              [{ type: "text", text: `ไม่พบข้อมูลออเดอร์ #${orderId} ครับ กรุณาตรวจสอบรหัสอีกครั้ง` }],
              token,
              userId
            );
          }
          continue;
        }

        if (action === "admin_confirm_slip") {
          const adminGroupId = cfg.lineAdminGroupId || process.env.LINE_ADMIN_GROUP_ID || "";
          const evSource = ev.source as any;
          if (evSource?.type === "group" && adminGroupId && evSource.groupId !== adminGroupId) {
            await replyLineMessage(replyToken, [{ type: "text", text: "❌ ปฏิเสธ: เฉพาะกลุ่มแอดมินที่ได้รับอนุญาตเท่านั้นครับ" }], token, userId);
            continue;
          }
          const orderId = params.get("orderId") || "";
          const { data } = await getAllDatabase();
          const foundOrder = findOrderById(data.orders, orderId);
          if (!foundOrder) {
            await replyLineMessage(replyToken, [{ type: "text", text: `❌ ไม่พบออเดอร์ #${orderId}` }], token, userId);
            continue;
          }
          const updated = await updateOrderRecord(foundOrder.id, {
            paymentStatus: "confirmed",
            orderStatus: "ชำระเงินแล้ว/เตรียมจัดส่ง",
            paidAt: new Date().toISOString(),
            updatedBy: "Admin (Confirm Slip)",
            updatedAt: new Date().toISOString(),
          });
          await replyLineMessage(
            replyToken,
            [{ type: "text", text: `✅ ยืนยันยอดชำระเงินสำหรับออเดอร์ #${foundOrder.id} เรียบร้อยแล้ว!\n📌 สถานะ: 🟢 ชำระเงินแล้ว / เตรียมจัดส่ง` }],
            token,
            userId
          );
          if (updated && updated.lineUserId) {
            await pushLineMessage(
              updated.lineUserId,
              buildPaymentConfirmedFlex(updated),
              token
            );
          }
          continue;
        }

        if (action === "admin_reject_slip") {
          const adminGroupId = cfg.lineAdminGroupId || process.env.LINE_ADMIN_GROUP_ID || "";
          const evSource = ev.source as any;
          if (evSource?.type === "group" && adminGroupId && evSource.groupId !== adminGroupId) {
            await replyLineMessage(replyToken, [{ type: "text", text: "❌ ปฏิเสธ: เฉพาะกลุ่มแอดมินที่ได้รับอนุญาตเท่านั้นครับ" }], token, userId);
            continue;
          }
          const orderId = params.get("orderId") || "";
          const { data } = await getAllDatabase();
          const foundOrder = findOrderById(data.orders, orderId);
          if (!foundOrder) {
            await replyLineMessage(replyToken, [{ type: "text", text: `❌ ไม่พบออเดอร์ #${orderId}` }], token, userId);
            continue;
          }
          await updateOrderRecord(foundOrder.id, {
            paymentStatus: "pending",
            updatedBy: "Admin (Reject Slip)",
            updatedAt: new Date().toISOString(),
          });
          await replyLineMessage(
            replyToken,
            [{ type: "text", text: `⚠️ แจ้งลูกค้าให้ส่งสลิปใหม่สำหรับออเดอร์ #${foundOrder.id} เรียบร้อยแล้ว` }],
            token,
            userId
          );
          if (foundOrder.lineUserId) {
            await pushLineMessage(
              foundOrder.lineUserId,
              [
                {
                  type: "text",
                  text: `❌ ขออภัยครับ สลิปโอนเงินสำหรับออเดอร์ #${foundOrder.id} ยอดไม่ตรงหรือไม่สามารถตรวจสอบได้\n\nรบกวนตรวจสอบยอดชำระ ฿${(foundOrder.totalPrice + (foundOrder.shippingCost || 0)).toLocaleString()} และกดปุ่ม "แนบสลิป" หรือส่งรูปสลิปใหม่อีกครั้งครับ 🙏`,
                },
              ],
              token
            );
          }
          continue;
        }

        if (action === "admin_cancel_order") {
          const adminGroupId = cfg.lineAdminGroupId || process.env.LINE_ADMIN_GROUP_ID || "";
          const evSource = ev.source as any;
          if (evSource?.type === "group" && adminGroupId && evSource.groupId !== adminGroupId) {
            await replyLineMessage(replyToken, [{ type: "text", text: "❌ ปฏิเสธ: เฉพาะกลุ่มแอดมินที่ได้รับอนุญาตเท่านั้นครับ" }], token, userId);
            continue;
          }
          const orderId = params.get("orderId") || "";
          const { data } = await getAllDatabase();
          const foundOrder = findOrderById(data.orders, orderId);
          if (!foundOrder) {
            await replyLineMessage(replyToken, [{ type: "text", text: `❌ ไม่พบออเดอร์ #${orderId}` }], token, userId);
            continue;
          }
          await updateOrderRecord(foundOrder.id, {
            orderStatus: "ยกเลิก",
            cancelledAt: new Date().toISOString(),
            cancelReason: "แอดมินยกเลิกผ่านกลุ่ม",
            updatedBy: "Admin (Cancel Group)",
            updatedAt: new Date().toISOString(),
          });
          // Return stock
          for (const it of foundOrder.items || []) {
            const prod = data.products.find((p) => p.id === it.productId);
            if (prod && typeof prod.stockQty === "number") {
              await updateProductRecord(prod.id, { stockQty: prod.stockQty + it.qty });
            }
          }
          await replyLineMessage(
            replyToken,
            [{ type: "text", text: `❌ ยกเลิกออเดอร์ #${foundOrder.id} และคืนสต็อกเรียบร้อยแล้วครับ` }],
            token,
            userId
          );
          if (foundOrder.lineUserId) {
            await pushLineMessage(
              foundOrder.lineUserId,
              [{ type: "text", text: `คำสั่งซื้อ #${foundOrder.id} ถูกยกเลิกเรียบร้อยแล้วครับ หากมีข้อสงสัยสามารถกดปุ่ม "คุยกับแอดมิน" ได้ตลอดเวลาครับ 🍈` }],
              token
            );
          }
          continue;
        }

        if (action === "confirm_without_slip") {
          const session = getLineSession(userId);
          const { data } = await getAllDatabase();
          // Find user's latest order if session is missing (sort descending by createDate)
          const users = Array.isArray(data?.users) ? data.users : [];
          const userObj = users.find((u) => u.lineUserId === userId);
          const userOrders = data.orders.filter((o) => o.lineUserId === userId || (userObj && o.userId === userObj.id));
          const latestOrder = userOrders.sort((a, b) => new Date(b.createDate || 0).getTime() - new Date(a.createDate || 0).getTime())[0];

          if (latestOrder) {
            await replyLineMessage(
              replyToken,
              buildBookingReceiptFlex(latestOrder),
              token,
              userId
            );
            continue;
          }

          if (
            session &&
            session.flow === "order" &&
            session.customerName &&
            session.phone &&
            session.address
          ) {
            const res = await submitNewOrder(
              {
                customerName: session.customerName,
                phone: session.phone,
                address: session.address,
                ripenessPref: session.ripenessPref,
                shippingMethod: session.shippingMethod || "รถห้องเย็น (฿120)",
                lineUserId: userId || undefined,
                orderStatus: "สั่งจอง",
                notes: "สั่งจองผ่านแชท LINE OA (แจ้งโอน/ส่งสลิปภายหลัง)",
                items: [
                  {
                    productId: session.productId,
                    qty: session.qty || 1,
                    ripenessPref: session.ripenessPref,
                  },
                ],
              },
              { skipCustomerNotify: true }
            );

            clearLineSession(userId);

            if (res.ok) {
              await replyLineMessage(
                replyToken,
                buildBookingReceiptFlex(res.order),
                token,
                userId
              );
              continue;
            }
          }

          await replyLineMessage(
            replyToken,
            [
              {
                type: "text",
                text: "รับทราบครับ! แอดมินได้บันทึกการสั่งจองของคุณเรียบร้อยแล้ว เมื่อตัดชั่งน้ำหนักแล้วจะส่งยอดชำระให้ทางแชทนี้ครับ 🙏",
                quickReply: buildMainQuickReply(),
              },
            ],
            token
          );
          continue;
        }

        if (action === "claim") {
          const { data } = await getAllDatabase();
          const cleanPhone = (p?: string) => (p || "").replace(/[^\d]/g, "");
          const users = Array.isArray(data?.users) ? data.users : [];
          const userObj = users.find((u) => u.lineUserId === userId);
          const userPhone = cleanPhone(userObj?.phone);
          const userOrders = (data.orders || []).filter(
            (o) =>
              (o.lineUserId && o.lineUserId === userId) ||
              (o.userId && (o.userId === userId || o.userId === userObj?.id)) ||
              (userPhone && cleanPhone(o.phone) === userPhone)
          );

          const eligibleOrders = userOrders.filter(
            (o) => checkClaimEligibility(o, data.claims || []).eligible
          );

          if (eligibleOrders.length > 0) {
            setLineSession(userId, {
              flow: "claim",
              step: "enter_order",
              updatedAt: Date.now(),
            });

            const quickItems = eligibleOrders.slice(0, 5).map((o) => ({
              label: `เคลม #${o.id}`.slice(0, 20),
              text: o.id,
            }));
            quickItems.push({ label: "ยกเลิก", text: "ยกเลิก" });

            await replyLineMessage(
              replyToken,
              quickReplyMsg(
                `🛡️ ศูนย์รับประกันทุเรียนวินคิน (เคลมฟรี 100%)\n\n📌 เงื่อนไขการรับประกัน:\n• สุกพร้อมทาน/เนื้อล้วน: เคลมได้ภายใน 24 ชม. หลังพัสดุส่งถึง\n• แก่จัด/บ่มเอง: เคลมได้ภายใน 3 วัน (72 ชม.) หลังพัสดุส่งถึง\n\nพบออเดอร์ของคุณ ${eligibleOrders.length} รายการที่อยู่ในระยะเวลารับประกัน กดเลือกออเดอร์ด้านล่าง หรือพิมพ์รหัสคำสั่งซื้อ (เช่น WK-9520) ได้เลยครับ`,
                quickItems
              ),
              token
            );
            continue;
          }

          setLineSession(userId, {
            flow: "claim",
            step: "enter_order",
            updatedAt: Date.now(),
          });
          await replyLineMessage(
            replyToken,
            quickReplyMsg(
              "🛡️ ศูนย์รับประกันทุเรียนวินคิน (เคลมฟรี 100%)\n\n📌 เงื่อนไขการรับประกัน:\n• สุกพร้อมทาน/เนื้อล้วน: เคลมได้ภายใน 24 ชม. หลังพัสดุส่งถึง\n• แก่จัด/บ่มเอง: เคลมได้ภายใน 3 วัน (72 ชม.) หลังพัสดุส่งถึง\n\nกรุณาพิมพ์รหัสคำสั่งซื้อ (เช่น WK-9520) หรือเบอร์โทร 10 หลักที่ใช้สั่งซื้อเพื่อตรวจสอบสิทธิ์เคลมครับ",
              [{ label: "ยกเลิก", text: "ยกเลิก" }]
            ),
            token
          );
          continue;
        }

        if (action === "status") {
          const { data } = await getAllDatabase();
          const cleanPhone = (p?: string) => (p || "").replace(/[^\d]/g, "");
          const users = Array.isArray(data?.users) ? data.users : [];
          const userObj = users.find((u) => u.lineUserId === userId);
          const userPhone = cleanPhone(userObj?.phone);
          const userOrders = (data.orders || []).filter(
            (o) =>
              (o.lineUserId && o.lineUserId === userId) ||
              (o.userId && (o.userId === userId || o.userId === userObj?.id)) ||
              (userPhone && cleanPhone(o.phone) === userPhone)
          );

          if (userOrders.length > 0) {
            await replyLineMessage(
              replyToken,
              buildUserOrdersFlex(userOrders, data.claims || [], publicBaseUrl),
              token
            );
            continue;
          }

          setLineSession(userId, {
            flow: "track",
            step: "enter_query",
            updatedAt: Date.now(),
          });
          await replyLineMessage(
            replyToken,
            quickReplyMsg(
              "📦 ตรวจสอบสถานะ & บริษัทขนส่ง\n\nพิมพ์รหัสออเดอร์ (เช่น WK-9521) หรือเบอร์โทร 10 หลักที่ใช้สั่งซื้อได้เลยครับ",
              [{ label: "ยกเลิก", text: "ยกเลิก" }]
            ),
            token
          );
          continue;
        }
      }

      // 3. Message Event (Text or Image)
      if (ev.type === "message" && ev.message) {
        const msgType = ev.message.type;
        const text = (ev.message.text || "").trim();
        const lower = text.toLowerCase();

        if (msgType === "text" && lower === "myid" && userId) {
          await replyLineMessage(
            replyToken,
            [{ type: "text", text: `LINE User ID ของคุณคือ:\n${userId}` }],
            token
          );
          continue;
        }

        // Admin quick weigh command in 1-on-1 chat: ชั่ง <OrderID> <WeightKg>
        const weighMatchDm = msgType === "text" ? text.match(/^(?:ชั่ง|นน|weight)\s+([a-zA-Z0-9_-]+)\s+([0-9.]+)/i) : null;
        if (weighMatchDm) {
          const orderTargetId = weighMatchDm[1].trim().toUpperCase();
          const weightNum = parseFloat(weighMatchDm[2]);
          const { data } = await getAllDatabase();
          const foundOrder = findOrderById(data.orders, orderTargetId);
          if (foundOrder) {
            const prod = data.products.find((p) => p.id === foundOrder.productId || p.name === foundOrder.productName) || data.products[0];
            const pricePerKg = prod?.pricePerKg || prod?.price || foundOrder.pricePerItem || 220;
            const qty = foundOrder.quantity || 1;
            const calculatedTotal = Math.round(weightNum * pricePerKg * qty);

            const updated = await updateOrderRecord(foundOrder.id, {
              weightPerItem: `${weightNum} กก.`,
              totalPrice: calculatedTotal,
              grandTotal: calculatedTotal + (foundOrder.shippingCost || 0),
              orderStatus: "รอชำระเงิน",
              updatedBy: `Admin (${userId ? userId.slice(-6) : "LINE"})`,
              updatedAt: new Date().toISOString(),
            });

            await replyLineMessage(
              replyToken,
              [
                {
                  type: "text",
                  text: `✅ บันทึกน้ำหนักออเดอร์ #${foundOrder.id} สำเร็จ!\n\n📦 สินค้า: ${foundOrder.productName || foundOrder.id}\n⚖️ น้ำหนักจริง: ${weightNum} กก.\n💰 ราคารวม: ฿${calculatedTotal.toLocaleString()} (จาก ฿${pricePerKg}/กก.)\n📌 สถานะ: รอชำระเงิน\n\n📲 ระบบส่งการ์ดยอดชำระเงินให้ลูกค้าทาง LINE เรียบร้อยแล้วครับ! 🍈✨`,
                },
              ],
              token
            );

            if (updated && updated.lineUserId) {
              await pushLineMessage(
                updated.lineUserId,
                buildCustomerStatusFlex(updated),
                token
              );
            }
            continue;
          }
        }

        if (
          msgType === "text" &&
          (lower === "ยกเลิก" || lower === "cancel" || lower === "เริ่มใหม่")
        ) {
          clearLineSession(userId);
          await replyLineMessage(
            replyToken,
            [
              {
                type: "text",
                text: "ยกเลิกรายการปัจจุบันเรียบร้อยครับ เลือกเมนูด้านล่างต่อได้เลย",
                quickReply: buildMainQuickReply(),
              },
            ],
            token
          );
          continue;
        }

        const currentSession = getLineSession(userId);

        // ==========================================
        // Handle Location Message Event (GPS / Google Maps Pin)
        // ==========================================
        if (msgType === "location") {
          const locMsg = ev.message as any;
          const locTitle = (locMsg.title || "").trim();
          const locAddress = (locMsg.address || "").trim();
          const latitude: number | undefined = locMsg.latitude;
          const longitude: number | undefined = locMsg.longitude;
          const mapsUrl =
            typeof latitude === "number" && typeof longitude === "number"
              ? `https://www.google.com/maps?q=${latitude},${longitude}`
              : "";

          let locationText = [locTitle, locAddress].filter(Boolean).join(" ");
          if (!locationText && latitude && longitude) {
            locationText = `พิกัด GPS ละติจูด ${latitude}, ลองจิจูด ${longitude}`;
          }

          let fullAddressWithMap = locationText;
          if (mapsUrl && !fullAddressWithMap.includes("maps.google.com")) {
            fullAddressWithMap = `${locationText}\n📍 หมุดแผนที่: ${mapsUrl}`;
          }

          // Fetch user record
          const { data } = await getAllDatabase();
          const users = Array.isArray(data?.users) ? data.users : [];
          const userObj = users.find(
            (u) =>
              (u.lineUserId && u.lineUserId === userId) ||
              u.username === `line_${userId}` ||
              u.id === userId
          );

          const existingName = userObj
            ? (`${userObj.firstName || ""} ${userObj.lastName || ""}`.trim() || userObj.displayName || userObj.username)
            : "";
          const existingPhone = userObj?.phone || "";

          // Upsert to user table
          await upsertLineUser({
            lineUserId: userId || undefined,
            displayName: existingName || undefined,
            customerName: existingName || undefined,
            phone: existingPhone || undefined,
            address: fullAddressWithMap,
            mapsUrl: mapsUrl || undefined,
            latitude,
            longitude,
            source: "line-location",
            notes: "ปักหมุดพิกัดแผนที่ผ่าน LINE Chat",
          });

          // Check active order session
          if (
            currentSession?.flow === "order" &&
            (currentSession.step === "enter_contact" || currentSession.step === "pick_shipping")
          ) {
            const customerName = currentSession.customerName || existingName;
            const phone = currentSession.phone || existingPhone;

            if (customerName && phone && phone.replace(/\D/g, "").length >= 9) {
              // Customer already has name and phone: advance to PromptPay payment!
              const qty = currentSession.qty || 1;
              const totalPrice = (currentSession.price || 0) * qty;
              const shipOpt =
                shopInfo.shippingMethods.find(
                  (s) => s.name.toLowerCase() === (currentSession.shippingMethod || "").toLowerCase()
                ) || shopInfo.shippingMethods[0];
              const shippingCost = shipOpt.price;
              const grandTotal = totalPrice + shippingCost;

              setLineSession(userId, {
                ...currentSession,
                step: "await_slip",
                customerName,
                phone,
                address: fullAddressWithMap,
                mapsUrl: mapsUrl || undefined,
                latitude,
                longitude,
                grandTotal,
                updatedAt: Date.now(),
              });

              await replyLineMessage(
                replyToken,
                [
                  {
                    type: "text",
                    text: `📍 ได้รับพิกัด Google Maps เรียบร้อยแล้วครับ!\n\n🗺️ ที่อยู่: ${locationText}\n📌 แผนที่: ${mapsUrl}\n👤 ผู้รับ: ${customerName} (${phone})`,
                  },
                  ...(buildPromptPayQrPaymentFlex({
                    grandTotal,
                    totalPrice,
                    shippingCost,
                    shippingMethod: currentSession.shippingMethod || shipOpt.name,
                    productName: currentSession.productName || "ทุเรียนวินคิน",
                    qty,
                    customerName,
                    phone,
                    ripenessPref: currentSession.ripenessPref || "ปกติ (พร้อมทาน)",
                  }) as unknown[]),
                ],
                token
              );
              continue;
            } else {
              // Missing name or phone: save location in session and prompt user
              setLineSession(userId, {
                ...currentSession,
                step: "enter_contact",
                address: fullAddressWithMap,
                mapsUrl: mapsUrl || undefined,
                latitude,
                longitude,
                updatedAt: Date.now(),
              });

              const formUrl = `${publicBaseUrl || "https://durianwinkin.vercel.app"}/address?userId=${encodeURIComponent(userId || "")}`;
              await replyLineMessage(
                replyToken,
                [
                  {
                    type: "text",
                    text: `📍 ได้รับหมุดพิกัด Google Maps เรียบร้อยครับ!\n\n🗺️ ที่อยู่: ${locationText}\n📌 ลิงก์: ${mapsUrl}\n\nกรุณาแจ้ง "ชื่อผู้รับ และ เบอร์โทรศัพท์" ส่งในแชทนี้ (เช่น สมชาย 0812345678) หรือกดปุ่มด้านล่างเพื่อเปิดฟอร์มตรวจสอบข้อมูลครับ 🙏`,
                    quickReply: {
                      items: [
                        {
                          type: "action",
                          action: {
                            type: "uri",
                            label: "📝 เปิดฟอร์มกรอก",
                            uri: formUrl,
                          },
                        },
                        {
                          type: "action",
                          action: { type: "message", label: "ยกเลิก", text: "ยกเลิก" },
                        },
                      ],
                    },
                  },
                ],
                token
              );
              continue;
            }
          }

          // Outside order session
          const formUrl = `${publicBaseUrl || "https://durianwinkin.vercel.app"}/address?userId=${encodeURIComponent(userId || "")}`;
          await replyLineMessage(
            replyToken,
            [
              {
                type: "text",
                text: `📍 บันทึกหมุดพิกัด Google Maps เข้าสู่ระบบเรียบร้อยแล้วครับ!\n\n🗺️ ตำแหน่ง: ${locationText}\n📌 แผนที่: ${mapsUrl}\n\nระบบจำตำแหน่งนี้ไว้ใช้จัดส่งทุเรียนถึงหน้าบ้านคุณอัตโนมัติแล้วครับ ✨`,
                quickReply: buildMainQuickReply(),
              },
            ],
            token
          );
          continue;
        }

        // Global Rich Menu & Text Triggers
        if (msgType === "text") {
          const isStockCmd =
            lower.includes("เช็กสต็อก") ||
            lower.includes("เช็คสต็อก") ||
            lower.includes("เช็กสต๊อค") ||
            lower.includes("เช็คสต๊อค") ||
            lower === "สต็อก" ||
            lower === "สต๊อค" ||
            lower === "เมนู" ||
            lower.includes("ดูสินค้า") ||
            lower.includes("รอบส่ง");

          const isOrderMenuCmd =
            lower === "สั่ง" ||
            lower === "สั่งซื้อ" ||
            lower === "สั่งทุเรียน" ||
            lower === "สั่งซื้อทุเรียน" ||
            lower === "จอง" ||
            lower === "สั่งจอง" ||
            lower === "จองทุเรียน" ||
            lower === "สั่งจองทุเรียน" ||
            lower === "เปิดจอง";

          const isPromoCmd =
            lower.includes("โปรโมชั่น") || lower === "โปร";

          const isLiveCmd =
            lower.includes("ไลฟ์สด") || lower === "live" || lower === "ดูไลฟ์";

          const isMoreCmd =
            lower === "เพิ่มเติม" ||
            lower.includes("หน้าเว็บไซต์") ||
            lower === "เว็บไซต์";

          const isClaimCmd =
            lower === "แจ้งเคลม" ||
            lower === "เคลม" ||
            lower === "แจ้งเคลม 100%" ||
            lower === "ส่งเคลม";

          const isTrackCmd =
            lower === "เช็กสถานะ" ||
            lower === "เช็คสถานะ" ||
            lower === "เช็กสถานะออเดอร์" ||
            lower === "เช็กพัสดุ" ||
            lower === "เช็คพัสดุ" ||
            lower === "สถานะ";

          const isTicketCmd =
            lower === "คุยกับแอดมิน" ||
            lower === "ติดต่อแอดมิน" ||
            lower === "แอดมิน" ||
            lower === "เปิด ticket" ||
            lower === "ticket" ||
            lower === "สอบถาม" ||
            lower === "ช่วยด้วย" ||
            lower === "ติดต่อเจ้าหน้าที่" ||
            lower === "ถามแอดมิน";

          if (isTicketCmd) {
            setLineSession(userId, {
              flow: "ticket",
              step: "await_message",
              updatedAt: Date.now(),
            });
            await replyLineMessage(
              replyToken,
              [
                {
                  type: "text",
                  text: "🍈 สอบถามทีมงาน / เปิด Ticket ติดต่อแอดมิน 💬\n\nพิมพ์ข้อความหรือคำถามของคุณส่งเข้ามาในแชทนี้ได้เลยครับ\n\nทีมงานจะได้รับการแจ้งเตือนเข้ากลุ่มแอดมินทันที และจะรีบเปิดแชทเข้ามาตอบกลับคุณโดยเร็วที่สุดครับ 🙏",
                  quickReply: {
                    items: [
                      { type: "action", action: { type: "message", label: "สอบถามสถานะพัสดุ", text: "สอบถามสถานะพัสดุ" } },
                      { type: "action", action: { type: "message", label: "สอบถามเรื่องความสุก", text: "สอบถามเรื่องความสุก" } },
                      { type: "action", action: { type: "message", label: "แจ้งเปลี่ยนที่อยู่", text: "แจ้งเปลี่ยนที่อยู่" } },
                      { type: "action", action: { type: "message", label: "ยกเลิก", text: "ยกเลิก" } },
                    ],
                  },
                },
              ],
              token
            );
            continue;
          }

          const isAdminCmd =
            lower === "/admin" ||
            lower === "เป็นแอดมิน" ||
            lower === "ผูกแอดมิน" ||
            lower === "admin alert";

          if (isAdminCmd) {
            saveRuntimeConfig({ lineAdminUserId: userId });
            await replyLineMessage(
              replyToken,
              [
                {
                  type: "text",
                  text: `🍈 บันทึกแอดมินรับแจ้งเตือนเรียบร้อยแล้ว!\n\n📌 User ID: ${userId}\n✅ ระบบจะส่งแจ้งเตือนออเดอร์ใหม่ สลิป และข้อความลูกค้ามาที่แชทส่วนตัวนี้เป็นช่องทางสำรองทันทีครับ 🔔`,
                },
              ],
              token,
              userId
            );
            continue;
          }

          const isMyOrdersCmd =
            lower === "ประวัติคำสั่งซื้อ" ||
            lower === "ออเดอร์ของฉัน" ||
            lower === "คำสั่งซื้อของฉัน" ||
            lower.includes("ประวัติการสั่ง");

          if (isMyOrdersCmd) {
            clearLineSession(userId);
            const { data } = await getAllDatabase();
            const cleanPhone = (p?: string) => (p || "").replace(/[^\d]/g, "");
            const users = Array.isArray(data?.users) ? data.users : [];
            const userObj = users.find((u) => u.lineUserId === userId);
            const userPhone = cleanPhone(userObj?.phone);
            const userOrders = (data.orders || []).filter(
              (o) =>
                (o.lineUserId && o.lineUserId === userId) ||
                (o.userId && (o.userId === userId || o.userId === userObj?.id)) ||
                (userPhone && cleanPhone(o.phone) === userPhone)
            );
            await replyLineMessage(
              replyToken,
              buildUserOrdersFlex(userOrders, data.claims || [], publicBaseUrl),
              token
            );
            continue;
          }

          if (isStockCmd) {
            clearLineSession(userId);
            try {
              const { data } = await getAllDatabase();
              const rounds = Array.isArray(data?.rounds) ? data.rounds : [];
              const activeRound =
                rounds.find((r) => r.status === "open") || rounds[0];
              const products = Array.isArray(data?.products) ? data.products : [];
              await replyLineMessage(
                replyToken,
                buildStockOverviewMessages(
                  activeRound,
                  products,
                  "stock",
                  publicBaseUrl
                ),
                token
              );
            } catch (err) {
              console.error("[LINE Webhook] Stock check error:", err);
              await replyLineMessage(
                replyToken,
                [
                  {
                    type: "text",
                    text: `🍈 ทุเรียนวินคิน ยินดีต้อนรับครับ!\nขณะนี้ระบบกำลังอัปเดตข้อมูลสต็อกสดจากสวนระยอง-จันทบุรี กรุณากดเลือกเมนูด้านล่างหรือเข้าชมเว็บไซต์: ${publicBaseUrl || "https://durianwinkin.vercel.app"}`,
                    quickReply: buildMainQuickReply(),
                  },
                ],
                token
              );
            }
            continue;
          }

          if (isOrderMenuCmd) {
            clearLineSession(userId);
            try {
              const { data } = await getAllDatabase();
              const rounds = Array.isArray(data?.rounds) ? data.rounds : [];
              const activeRound =
                rounds.find((r) => r.status === "open") || rounds[0];
              const products = Array.isArray(data?.products) ? data.products : [];
              await replyLineMessage(
                replyToken,
                buildOrderCatalogMessages(
                  products,
                  activeRound,
                  publicBaseUrl
                ),
                token
              );
            } catch (err) {
              console.error("[LINE Webhook] Order menu error:", err);
            }
            continue;
          }

          if (isPromoCmd) {
            clearLineSession(userId);
            const { data } = await getAllDatabase();
            await replyLineMessage(
              replyToken,
              buildPromotionsCarouselFlex(data.promotions || []),
              token
            );
            continue;
          }

          if (isLiveCmd) {
            clearLineSession(userId);
            await replyLineMessage(replyToken, buildLiveStreamFlex(cfg), token);
            continue;
          }

          if (isMoreCmd) {
            clearLineSession(userId);
            try {
              const { data } = await getAllDatabase();
              const rounds = Array.isArray(data?.rounds) ? data.rounds : [];
              const activeRound =
                rounds.find((r) => r.status === "open") || rounds[0];
              await replyLineMessage(
                replyToken,
                buildMoreMenuFlex(publicBaseUrl, activeRound),
                token
              );
            } catch (err) {
              console.error("[LINE Webhook] More menu error:", err);
            }
            continue;
          }

          if (isClaimCmd) {
            const { data } = await getAllDatabase();
            const cleanPhone = (p?: string) => (p || "").replace(/[^\d]/g, "");
            const users = Array.isArray(data?.users) ? data.users : [];
            const userObj = users.find((u) => u.lineUserId === userId);
            const userPhone = cleanPhone(userObj?.phone);
            const userOrders = (data.orders || []).filter(
              (o) =>
                (o.lineUserId && o.lineUserId === userId) ||
                (o.userId && (o.userId === userId || o.userId === userObj?.id)) ||
                (userPhone && cleanPhone(o.phone) === userPhone)
            );

            const eligibleOrders = userOrders.filter(
              (o) => checkClaimEligibility(o, data.claims || []).eligible
            );

            if (eligibleOrders.length > 0) {
              setLineSession(userId, {
                flow: "claim",
                step: "enter_order",
                updatedAt: Date.now(),
              });

              const quickItems = eligibleOrders.slice(0, 5).map((o) => ({
                label: `เคลม #${o.id}`.slice(0, 20),
                text: o.id,
              }));
              quickItems.push({ label: "ยกเลิก", text: "ยกเลิก" });

              await replyLineMessage(
                replyToken,
                quickReplyMsg(
                  `🛡️ ศูนย์รับประกันทุเรียนวินคิน (เคลมฟรี 100%)\n\n📌 เงื่อนไขการรับประกัน:\n• สุกพร้อมทาน/เนื้อล้วน: เคลมได้ภายใน 24 ชม. หลังพัสดุส่งถึง\n• แก่จัด/บ่มเอง: เคลมได้ภายใน 3 วัน (72 ชม.) หลังพัสดุส่งถึง\n\nพบออเดอร์ของคุณ ${eligibleOrders.length} รายการที่อยู่ในระยะเวลารับประกัน กดเลือกออเดอร์ด้านล่าง หรือพิมพ์รหัสคำสั่งซื้อ (เช่น WK-9520) ได้เลยครับ`,
                  quickItems
                ),
                token
              );
              continue;
            }

            setLineSession(userId, {
              flow: "claim",
              step: "enter_order",
              updatedAt: Date.now(),
            });
            await replyLineMessage(
              replyToken,
              quickReplyMsg(
                "🛡️ ศูนย์รับประกันทุเรียนวินคิน (เคลมฟรี 100%)\n\n📌 เงื่อนไขการรับประกัน:\n• สุกพร้อมทาน/เนื้อล้วน: เคลมได้ภายใน 24 ชม. หลังพัสดุส่งถึง\n• แก่จัด/บ่มเอง: เคลมได้ภายใน 3 วัน (72 ชม.) หลังพัสดุส่งถึง\n\nกรุณาพิมพ์รหัสคำสั่งซื้อ (เช่น WK-9520) หรือเบอร์โทร 10 หลักที่ใช้สั่งซื้อเพื่อตรวจสอบสิทธิ์เคลมครับ",
                [{ label: "ยกเลิก", text: "ยกเลิก" }]
              ),
              token
            );
            continue;
          }

          if (isTrackCmd) {
            const { data } = await getAllDatabase();
            const cleanPhone = (p?: string) => (p || "").replace(/[^\d]/g, "");
            const users = Array.isArray(data?.users) ? data.users : [];
            const userObj = users.find((u) => u.lineUserId === userId);
            const userPhone = cleanPhone(userObj?.phone);
            const userOrders = (data.orders || []).filter(
              (o) =>
                (o.lineUserId && o.lineUserId === userId) ||
                (o.userId && (o.userId === userId || o.userId === userObj?.id)) ||
                (userPhone && cleanPhone(o.phone) === userPhone)
            );

            if (userOrders.length > 0) {
              await replyLineMessage(
                replyToken,
                buildUserOrdersFlex(userOrders, data.claims || [], publicBaseUrl),
                token
              );
              continue;
            }

            setLineSession(userId, {
              flow: "track",
              step: "enter_query",
              updatedAt: Date.now(),
            });
            await replyLineMessage(
              replyToken,
              quickReplyMsg(
                "📦 ตรวจสอบสถานะ & บริษัทขนส่ง\n\nพิมพ์รหัสออเดอร์ (เช่น WK-9521) หรือเบอร์โทรศัพท์ของคุณเพื่อเช็กบริษัทขนส่งและเลขพัสดุครับ",
                [{ label: "ยกเลิก", text: "ยกเลิก" }]
              ),
              token
            );
            continue;
          }

          const directOrderCode = extractOrderId(text);
          if (
            directOrderCode &&
            !(currentSession?.flow === "claim" && currentSession.step === "enter_order")
          ) {
            const { data } = await getAllDatabase();
            const order = findOrderById(data.orders, directOrderCode);
            if (order) {
              const flex = buildCustomerStatusFlex(order);
              if (flex[0] && typeof flex[0] === "object") {
                (flex[0] as Record<string, unknown>).quickReply = buildMainQuickReply();
              }
              await replyLineMessage(replyToken, flex, token);
            } else {
              await replyLineMessage(
                replyToken,
                [
                  {
                    type: "text",
                    text: `ไม่พบรหัสออเดอร์ ${directOrderCode} ในระบบครับ ตรวจสอบตัวเลขอีกครั้งหรือโทร ${shopInfo.phone}`,
                    quickReply: buildMainQuickReply(),
                  },
                ],
                token
              );
            }
            continue;
          }
        }

        // Ticket Wizard Steps (Customer talking to admin / answering prompt)
        if (currentSession?.flow === "ticket" && msgType === "text") {
          const ticketId = `TCK-${Math.floor(100000 + Math.random() * 900000)}`;
          const { data } = await getAllDatabase();
          const users = Array.isArray(data?.users) ? data.users : [];
          const userObj = users.find((u) => u.lineUserId === userId);
          const customerName = userObj
            ? (`${userObj.firstName || ""} ${userObj.lastName || ""}`.trim() || userObj.displayName || "ลูกค้า LINE")
            : "ลูกค้า LINE";

          const ticketAlert = buildTicketAlertForAdmin(
            {
              ticketId,
              customerName,
              phone: userObj?.phone,
              lineUserId: userId,
              orderId: currentSession.orderId,
              message: text,
              createdAt: new Date().toLocaleString("th-TH"),
            },
            publicBaseUrl
          );

          // Push alert to Admin Group and any admin targets
          const adminTargets: string[] = [];
          if (cfg.lineAdminGroupId) adminTargets.push(cfg.lineAdminGroupId);
          if (cfg.lineAdminUserId && !adminTargets.includes(cfg.lineAdminUserId)) {
            adminTargets.push(cfg.lineAdminUserId);
          }

          for (const tId of adminTargets) {
            try {
              await pushLineMessage(tId, ticketAlert, token);
            } catch (pushErr) {
              console.warn("Failed to push ticket alert to:", tId, pushErr);
            }
          }

          clearLineSession(userId);

          await replyLineMessage(
            replyToken,
            [
              {
                type: "text",
                text: `✅ ส่งเรื่องถึงแอดมินเรียบร้อยแล้วครับ! (Ticket #${ticketId}) 🍈\n\nเรื่อง: "${text}"\n\nทีมงานได้รับข้อความแล้ว แอดมินจะรีบเปิดแชทเข้ามาตอบกลับคุณโดยเร็วที่สุดครับ ขอบคุณครับ 🙏✨`,
                quickReply: buildMainQuickReply(),
              },
            ],
            token
          );
          continue;
        }

        // Direct Ripeness Selection via free-form text ("กรอบนอกนุ่มใน", "สุกพอดีกิน", etc.)
        const isRipenessText =
          text.includes("กรอบนอก") ||
          text.includes("ไก่ฉีก") ||
          text.includes("สุกพอดี") ||
          text.includes("เนื้อเนียน") ||
          text.includes("ห่าม") ||
          text.includes("สุกงอม");

        if (msgType === "text" && isRipenessText) {
          const pid = (currentSession && currentSession.flow === "order" ? currentSession.productId : undefined) || "WK-01";
          const qty = (currentSession && currentSession.flow === "order" ? currentSession.qty : undefined) || 1;
          const { data } = await getAllDatabase();
          const prod = data.products.find((p) => p.id === pid) || data.products[0];
          const pricePerKg = prod?.pricePerKg || prod?.price || 220;
          const users = Array.isArray(data?.users) ? data.users : [];
          const userObj = users.find((u) => u.lineUserId === userId);
          const hasSavedAddress = Boolean(userObj && userObj.address && userObj.phone);

          setLineSession(userId, {
            flow: "order",
            step: "enter_contact",
            productId: prod.id,
            productName: prod.name,
            price: pricePerKg,
            qty,
            ripenessPref: text,
            updatedAt: Date.now(),
          });

          if (hasSavedAddress && userObj) {
            const customerName = `${userObj.firstName || ""} ${userObj.lastName || ""}`.trim() || userObj.displayName || "คุณลูกค้า";
            const addressBubble = {
              type: "bubble",
              header: {
                type: "box",
                layout: "vertical",
                backgroundColor: "#1B4D31",
                paddingAll: "lg",
                contents: [
                  {
                    type: "text",
                    text: "📍 ยืนยันที่อยู่จัดส่งทุเรียน",
                    color: "#FDE047",
                    weight: "bold",
                    size: "md",
                  },
                  {
                    type: "text",
                    text: `${prod.name} x${qty} ลูก (${text})`,
                    color: "#FFFFFF",
                    size: "xs",
                    margin: "xs",
                  },
                ],
              },
              body: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: `👤 ผู้รับ: ${customerName}`,
                    weight: "bold",
                    size: "sm",
                    color: "#111827",
                  },
                  {
                    type: "text",
                    text: `📞 เบอร์โทร: ${userObj.phone}`,
                    size: "xs",
                    color: "#4B5563",
                  },
                  {
                    type: "text",
                    text: `🏠 ที่อยู่: ${userObj.address}`,
                    size: "xs",
                    color: "#374151",
                    wrap: true,
                  },
                ],
              },
              footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                  {
                    type: "button",
                    style: "primary",
                    color: "#15803D",
                    height: "sm",
                    action: {
                      type: "postback",
                      label: "✅ ยืนยันการจอง",
                      data: `action=order_step&step=confirm&pid=${encodeURIComponent(prod.id)}&qty=${qty}&ripeness=${encodeURIComponent(text)}&use_saved=1&bkey=BK_${userId.slice(-6)}_${prod.id}_${qty}_${Date.now().toString(36)}`,
                      displayText: "ยืนยันการจอง",
                    },
                  },
                  {
                    type: "button",
                    style: "secondary",
                    height: "sm",
                    action: {
                      type: "message",
                      label: "✏️ พิมพ์ที่อยู่ใหม่ในแชท",
                      text: "เปลี่ยนที่อยู่",
                    },
                  },
                ],
              },
            };

            await replyLineMessage(
              replyToken,
              [
                {
                  type: "flex",
                  altText: "ยืนยันที่อยู่จัดส่งทุเรียน",
                  contents: addressBubble,
                },
              ],
              token
            );
            continue;
          } else {
            const formUrl = `${publicBaseUrl || "https://durianwinkin.vercel.app"}/address?userId=${encodeURIComponent(userId)}`;
            await replyLineMessage(
              replyToken,
              [
                {
                  type: "text",
                  text: `🍈 ได้รับข้อมูล: ${prod.name} x${qty} ลูก (${text})\n\n📍 กรุณาแจ้ง "ชื่อผู้รับ เบอร์โทรศัพท์ 10 หลัก และที่อยู่จัดส่ง" ส่งมาในแชทนี้ได้เลยครับ\n\nตัวอย่าง:\nสมชาย 0812345678 99/1 สุขุมวิท กทม. 10110\n\n(หรือกดปุ่มปักหมุด 🗺️ แผนที่ด้านล่างได้เลยครับ)`,
                  quickReply: {
                    items: [
                      {
                        type: "action",
                        action: { type: "location", label: "🗺️ ปักหมุดแผนที่" },
                      },
                      {
                        type: "action",
                        action: {
                          type: "uri",
                          label: "📝 เปิดฟอร์มที่อยู่",
                          uri: formUrl,
                        },
                      },
                      {
                        type: "action",
                        action: { type: "message", label: "ยกเลิก", text: "ยกเลิก" },
                      },
                    ],
                  },
                },
              ],
              token
            );
            continue;
          }
        }

        // Order Wizard Steps
        if (currentSession?.flow === "order") {
          if (currentSession.step === "pick_qty" && msgType === "text") {
            const qtyNum = Math.min(
              20,
              Math.max(1, parseInt(text.replace(/[^\d]/g, ""), 10) || 0)
            );
            if (!qtyNum) {
              await replyLineMessage(
                replyToken,
                quickReplyMsg("กรุณาระบุจำนวนเป็นตัวเลข (เช่น 1 หรือ 2) ครับ", [
                  { label: "1", text: "1" },
                  { label: "2", text: "2" },
                  { label: "ยกเลิก", text: "ยกเลิก" },
                ]),
                token
              );
              continue;
            }
            setLineSession(userId, {
              ...currentSession,
              step: "pick_ripeness",
              qty: qtyNum,
            });
            await replyLineMessage(
              replyToken,
              quickReplyMsg(
                `รับ ${qtyNum} รายการ (ค่าสินค้า ฿${(currentSession.price * qtyNum).toLocaleString()})\n\nเลือกระดับความสุกที่ต้องการได้เลยครับ:`,
                [
                  { label: "กรอบนอกนุ่มใน", text: "กรอบนอกนุ่มใน (ไก่ฉีก)" },
                  { label: "สุกพอดีกิน", text: "สุกพอดีกิน (เนื้อเนียนครีม)" },
                  { label: "ห่าม-กรอบมัน", text: "ห่าม-กรอบมัน" },
                  { label: "ยกเลิก", text: "ยกเลิก" },
                ]
              ),
              token
            );
            continue;
          }

          if (currentSession.step === "pick_ripeness" && msgType === "text") {
            setLineSession(userId, {
              ...currentSession,
              step: "pick_shipping",
              ripenessPref: text,
            });
            await replyLineMessage(
              replyToken,
              quickReplyMsg("เลือกรูปแบบการจัดส่งครับ:", [
                { label: "รถห้องเย็น (฿120)", text: shopInfo.shippingMethods[0].name },
                { label: "Flash Express (฿80)", text: shopInfo.shippingMethods[1].name },
                { label: "ส่งด่วน กทม. (฿150)", text: shopInfo.shippingMethods[2].name },
                { label: "นัดรับ (฿0)", text: shopInfo.shippingMethods[3].name },
                { label: "ยกเลิก", text: "ยกเลิก" },
              ]),
              token
            );
            continue;
          }

          if (currentSession.step === "pick_shipping" && msgType === "text") {
            setLineSession(userId, {
              ...currentSession,
              step: "enter_contact",
              shippingMethod: text,
            });

            const { data } = await getAllDatabase();
            const users = Array.isArray(data?.users) ? data.users : [];
            const userObj = users.find((u) => u.lineUserId === userId);
            const formUrl = `${publicBaseUrl || "https://durianwinkin.vercel.app"}/address?userId=${encodeURIComponent(userId)}`;

            await replyLineMessage(
              replyToken,
              buildAddressFormFlex(
                userObj
                  ? {
                      customerName:
                        `${userObj.firstName || ""} ${userObj.lastName || ""}`.trim() ||
                        userObj.displayName ||
                        userObj.username ||
                        "คุณลูกค้า",
                      phone: userObj.phone,
                      address: userObj.address,
                      mapsUrl: userObj.mapsUrl,
                    }
                  : null,
                formUrl
              ),
              token
            );
            continue;
          }

          if (currentSession.step === "enter_contact" && msgType === "text") {
            const parsed = parseContactInput(text);
            if (!parsed) {
              await replyLineMessage(
                replyToken,
                quickReplyMsg(
                  "ยังอ่านข้อมูลไม่ครบครับ รบกวนพิมพ์ให้มีทั้ง ชื่อ + เบอร์โทร 10 หลัก + ที่อยู่ ในข้อความเดียวนะครับ\n\nตัวอย่าง:\nสมชาย 0812345678 99/1 สุขุมวิท กทม. 10110",
                  [{ label: "ยกเลิก", text: "ยกเลิก" }]
                ),
                token
              );
              continue;
            }

            const { data } = await getAllDatabase();
            const prod = data.products.find((p) => p.id === currentSession.productId) || data.products[0];
            const pricePerKg = prod?.pricePerKg || prod?.price || currentSession.price || 220;
            const avgWeight = prod?.avgWeightKg || parseFloat(prod?.weight || "4.0") || 4.0;
            const qty = currentSession.qty || 1;
            const estimatedItemTotal = Math.round(pricePerKg * avgWeight * qty);
            const shipOpt = resolveShippingOption(currentSession.shippingMethod);
            const shippingCost = shipOpt.price;
            const grandTotal = estimatedItemTotal + shippingCost;
            const ripenessPref = currentSession.ripenessPref || "กรอบนอกนุ่มใน (ไก่ฉีก)";

            // Auto-save customer to Google Sheet Users table
            try {
              await upsertLineUser({
                lineUserId: userId || undefined,
                customerName: parsed.customerName,
                phone: parsed.phone,
                address: parsed.address,
                source: "line-chat",
                notes: `ขั้นตอนสั่งซื้อ ${prod?.name || currentSession.productName} (${qty} ลูก)`,
              });
            } catch (userErr) {
              console.warn("Auto-save user during contact step failed:", userErr);
            }

            // Create Order immediately with status "สั่งจอง"
            const orderRes = await submitNewOrder(
              {
                customerName: parsed.customerName,
                phone: parsed.phone,
                address: parsed.address,
                ripenessPref,
                shippingMethod: shipOpt.name,
                shippingCost,
                lineUserId: userId || undefined,
                channel: "LINE OA",
                orderStatus: "สั่งจอง",
                bookingKey: `BK_${userId}_${prod?.id || currentSession.productId || "WK-01"}_${qty}_${Date.now().toString(36)}`,
                notes: `สั่งจองผ่านแชท LINE OA (ราคา ฿${pricePerKg}/กก. นน.เฉลี่ย ~${avgWeight} กก./ลูก)`,
                items: [
                  {
                    productId: prod?.id || currentSession.productId || "WK-01",
                    qty,
                    ripenessPref,
                    weightPerItem: `${avgWeight} กก.`,
                  },
                ],
              },
              { skipCustomerNotify: true }
            );

            clearLineSession(userId);

            if (!orderRes.ok) {
              await replyLineMessage(
                replyToken,
                [{ type: "text", text: `ไม่สามารถบันทึกคำสั่งจองได้: ${orderRes.error}` }],
                token,
                userId
              );
              continue;
            }

            await replyLineMessage(
              replyToken,
              buildBookingReceiptFlex(orderRes.order),
              token,
              userId
            );
            continue;
          }

          if (currentSession.step === "await_slip") {
            if (msgType === "image" && ev.message.id) {
              const media = await downloadAndVerifyLineImage(
                ev.message.id,
                token,
                "slip"
              );

              if (!media.ok) {
                await replyLineMessage(
                  replyToken,
                  quickReplyMsg(
                    `ไม่สามารถตรวจสอบไฟล์รูปสลิปได้ (${media.reason}) รบกวนส่งเป็นรูปสลิป JPG/PNG อีกครั้งครับ`,
                    [
                      { label: "ยกเลิก", text: "ยกเลิก" },
                    ]
                  ),
                  token,
                  userId
                );
                continue;
              }

              let targetOrder: Order | undefined;
              if (currentSession.orderId) {
                const { data } = await getAllDatabase();
                targetOrder = findOrderById(data.orders, currentSession.orderId);
                if (targetOrder) {
                  await updateOrderRecord(targetOrder.id, {
                    slipUrl: media.apiPath,
                    paymentStatus: "slip_submitted",
                    slipSubmittedAt: new Date().toISOString(),
                    updatedBy: "customer-slip",
                  });
                  targetOrder.slipUrl = media.apiPath;
                  targetOrder.paymentStatus = "slip_submitted";
                }
              }

              if (!targetOrder) {
                const { data } = await getAllDatabase();
                const userOrders = data.orders.filter((o) => o.lineUserId === userId);
                targetOrder = userOrders.sort((a, b) => new Date(b.createDate || 0).getTime() - new Date(a.createDate || 0).getTime())[0];
                if (targetOrder) {
                  await updateOrderRecord(targetOrder.id, {
                    slipUrl: media.apiPath,
                    paymentStatus: "slip_submitted",
                    slipSubmittedAt: new Date().toISOString(),
                    updatedBy: "customer-slip",
                  });
                  targetOrder.slipUrl = media.apiPath;
                  targetOrder.paymentStatus = "slip_submitted";
                }
              }

              clearLineSession(userId);

              if (targetOrder) {
                // Notify admin group and admin user with slip preview and confirm/reject buttons
                const adminTargets = [cfg.lineAdminGroupId, cfg.lineAdminUserId].filter(
                  (id): id is string => Boolean(id && id.trim())
                );
                if (adminTargets.length > 0) {
                  const alertMsgs = buildSlipAlertForAdmin(targetOrder, media.apiPath, publicBaseUrl);
                  for (const tId of adminTargets) {
                    await pushLineMessage(tId, alertMsgs, token);
                  }
                }

                await replyLineMessage(
                  replyToken,
                  buildSlipSubmittedReceiptFlex(targetOrder),
                  token,
                  userId
                );
                continue;
              }
            }

            if (
              msgType === "text" &&
              (text.includes("ไม่แนบสลิป") ||
                text.includes("ส่งสลิปภายหลัง") ||
                text.includes("ออกเลข") ||
                text.includes("ยืนยัน"))
            ) {
              let existingOrder: Order | undefined;
              if (currentSession.orderId) {
                const { data } = await getAllDatabase();
                existingOrder = findOrderById(data.orders, currentSession.orderId);
              }
              clearLineSession(userId);
              if (existingOrder) {
                await replyLineMessage(
                  replyToken,
                  buildBookingReceiptFlex(existingOrder),
                  token,
                  userId
                );
                continue;
              }
            }

            await replyLineMessage(
              replyToken,
              [
                {
                  type: "text",
                  text: `🍈 ออเดอร์ #${currentSession.orderId || ""} บันทึกการสั่งจองเรียบร้อยแล้วครับ\n\n📌 สามารถส่ง "รูปภาพสลิปโอนเงิน" เข้ามาในแชทนี้ได้เลยครับ หรือเลือกเมนูด้านล่าง:`,
                  quickReply: {
                    items: [
                      {
                        type: "action",
                        action: {
                          type: "postback",
                          label: "📸 แนบสลิปโอนเงิน",
                          data: `action=attach_slip&orderId=${currentSession.orderId || ""}`,
                          displayText: "แนบสลิปโอนเงิน",
                        },
                      },
                      {
                        type: "action",
                        action: {
                          type: "postback",
                          label: "📦 เช็กสถานะการจอง",
                          data: `action=track_order&orderId=${currentSession.orderId || ""}`,
                          displayText: "เช็กสถานะการจอง",
                        },
                      },
                      {
                        type: "action",
                        action: {
                          type: "postback",
                          label: "💬 คุยกับแอดมิน",
                          data: `action=open_ticket&orderId=${currentSession.orderId || ""}`,
                          displayText: "คุยกับแอดมิน",
                        },
                      },
                      {
                        type: "action",
                        action: { type: "message", label: "ยกเลิก", text: "ยกเลิก" },
                      },
                    ],
                  },
                },
              ],
              token,
              userId
            );
            continue;
          }
        }

        // Claim Wizard Steps
        if (currentSession?.flow === "claim") {
          if (currentSession.step === "enter_order" && msgType === "text") {
            const cleanDigits = text.replace(/[^\d]/g, "");
            const { data } = await getAllDatabase();

            // กรณีลูกค้าพิมพ์เบอร์โทรศัพท์มา
            if (cleanDigits.length >= 9 && cleanDigits.startsWith("0")) {
              const ordersByPhone = data.orders.filter(
                (o) => (o.phone || "").replace(/[^\d]/g, "") === cleanDigits
              );
              if (ordersByPhone.length === 0) {
                await replyLineMessage(
                  replyToken,
                  quickReplyMsg(
                    `ไม่พบประวัติคำสั่งซื้อที่ใช้เบอร์โทร ${cleanDigits} ในระบบครับ กรุณาตรวจสอบเบอร์โทรหรือพิมพ์รหัสออเดอร์ (เช่น WK-9520)`,
                    [{ label: "ยกเลิก", text: "ยกเลิก" }]
                  ),
                  token
                );
                continue;
              }

              const eligible = ordersByPhone.filter(
                (o) => checkClaimEligibility(o, data.claims || []).eligible
              );

              if (eligible.length === 0) {
                const latest = ordersByPhone[0];
                const check = checkClaimEligibility(latest, data.claims || []);
                await replyLineMessage(
                  replyToken,
                  quickReplyMsg(
                    `พบออเดอร์ #${latest.id} ของเบอร์ ${cleanDigits} แต่ไม่สามารถแจ้งเคลมได้:\n\n${check.reason || "ไม่เข้าเงื่อนไขการรับประกัน"}`,
                    [{ label: "ยกเลิก", text: "ยกเลิก" }]
                  ),
                  token
                );
                continue;
              }

              const quickButtons = eligible.slice(0, 5).map((o) => ({
                label: `เคลม #${o.id}`.slice(0, 20),
                text: o.id,
              }));
              quickButtons.push({ label: "ยกเลิก", text: "ยกเลิก" });

              await replyLineMessage(
                replyToken,
                quickReplyMsg(
                  `พบ ${eligible.length} ออเดอร์ของเบอร์ ${cleanDigits} ที่อยู่ในระยะเวลารับประกัน กรุณากดเลือกออเดอร์ที่ต้องการเคลมด้านล่างครับ`,
                  quickButtons
                ),
                token
              );
              continue;
            }

            // กรณีพิมพ์รหัสออเดอร์
            const code = extractOrderId(text) || text.trim().toUpperCase();

            const targetOrder = findOrderById(data.orders, code);

            if (!targetOrder) {
              await replyLineMessage(
                replyToken,
                quickReplyMsg(
                  `❌ ไม่พบรหัสคำสั่งซื้อ "${code}" ในระบบครับ\n\nกรุณาตรวจสอบรหัสออเดอร์อีกครั้ง (เช่น WK-9520) หรือพิมพ์เบอร์โทรศัพท์ 10 หลักที่ใช้สั่งซื้อครับ`,
                  [{ label: "ยกเลิก", text: "ยกเลิก" }]
                ),
                token
              );
              continue;
            }

            // ตรวจสอบความเป็นเจ้าของออเดอร์ใน LINE (User ต้องตรงกับคำสั่งซื้อนั้น)
            const matchedUser = data.users?.find(
              (u) => (u.lineUserId && u.lineUserId === userId) || u.username === `line_${userId}` || u.id === userId
            );
            const userPhoneDigits = (matchedUser?.phone || "").replace(/[^\d]/g, "");
            const orderPhoneDigits = (targetOrder.phone || "").replace(/[^\d]/g, "");

            const isOrderOwner = Boolean(
              (targetOrder.lineUserId && targetOrder.lineUserId === userId) ||
              (matchedUser?.id && targetOrder.userId && targetOrder.userId === matchedUser.id) ||
              (userPhoneDigits && orderPhoneDigits && userPhoneDigits === orderPhoneDigits) ||
              !targetOrder.lineUserId
            );

            if (!isOrderOwner) {
              await replyLineMessage(
                replyToken,
                quickReplyMsg(
                  `⚠️ ออเดอร์ #${targetOrder.id} ไม่ตรงกับบัญชี LINE หรือเบอร์โทรศัพท์ของคุณครับ\n\nท่านสามารถเคลมได้เฉพาะออเดอร์ที่สั่งซื้อด้วยบัญชีนี้เท่านั้นครับ 🙏`,
                  [{ label: "ดูออเดอร์ของฉัน", text: "ออเดอร์ของฉัน" }, { label: "ยกเลิก", text: "ยกเลิก" }]
                ),
                token
              );
              continue;
            }

            // ตรวจสอบสิทธิ์เคลมและเงื่อนไขระยะเวลา (Master Data Claim Policy)
            const eligibility = checkClaimEligibility(targetOrder, data.claims || []);
            if (!eligibility.eligible) {
              await replyLineMessage(
                replyToken,
                quickReplyMsg(
                  eligibility.reason || "ไม่สามารถแจ้งเคลมออเดอร์นี้ได้ครับ",
                  [
                    { label: "เช็กสถานะพัสดุ", text: `สถานะ ${targetOrder.id}` },
                    { label: "ยกเลิก", text: "ยกเลิก" },
                  ]
                ),
                token
              );
              continue;
            }

            // ผ่านการตรวจสอบเงื่อนไขเคลมทั้งหมด -> ข้ามไปขั้นตอนเลือกปัญหาทันที!
            setLineSession(userId, {
              ...currentSession,
              step: "pick_reason",
              orderId: targetOrder.id,
              phone: targetOrder.phone,
            });

            const isRipen = eligibility.warrantyType === "ready_to_eat";
            const policyNote = isRipen
              ? "🛡️ ทุเรียนสุกพร้อมทาน (รับประกัน 24 ชม. หลังพัสดุส่งถึง)"
              : "🛡️ ทุเรียนแก่จัด/บ่มเอง (รับประกัน 3 วัน / 72 ชม. หลังพัสดุส่งถึง)";

            await replyLineMessage(
              replyToken,
              quickReplyMsg(
                `✅ ยืนยันสิทธิ์เคลมสำเร็จ!\n${policyNote}\nออเดอร์ #${targetOrder.id} — พบปัญหาด้านใดครับ?`,
                [
                  { label: "ยังไม่สุก / แข็ง", text: "ยังไม่สุก / แข็ง" },
                  { label: "สุกงอม / เน่าเสีย", text: "สุกงอม / เน่าเสีย" },
                  { label: "เนื้อเละ / ขึ้นรา", text: "เนื้อเละ / ขึ้นรา" },
                  { label: "น้ำหนักไม่ครบ", text: "น้ำหนักไม่ครบ" },
                  { label: "กล่องพัสดุเสียหาย", text: "กล่องพัสดุเสียหาย" },
                  { label: "ยกเลิก", text: "ยกเลิก" },
                ]
              ),
              token
            );
            continue;
          }

          if (currentSession.step === "enter_phone" && msgType === "text") {
            const digits = text.replace(/[^\d]/g, "");
            if (digits.length < 9) {
              await replyLineMessage(
                replyToken,
                quickReplyMsg("กรุณาพิมพ์เบอร์โทรให้ถูกต้อง (9-10 หลัก) ครับ", [
                  { label: "ยกเลิก", text: "ยกเลิก" },
                ]),
                token
              );
              continue;
            }
            setLineSession(userId, {
              ...currentSession,
              step: "pick_reason",
              phone: text.trim(),
            });
            await replyLineMessage(
              replyToken,
              quickReplyMsg("พบปัญหาทุเรียนลักษณะใดครับ?", [
                { label: "ยังไม่สุก / แข็ง", text: "unripe" },
                { label: "สุกงอม / เน่าเสีย", text: "spoiled" },
                { label: "น้ำหนักไม่ครบ", text: "underweight" },
                { label: "กล่องเสียหาย", text: "damaged" },
                { label: "ยกเลิก", text: "ยกเลิก" },
              ]),
              token
            );
            continue;
          }

          if (currentSession.step === "pick_reason" && msgType === "text") {
            setLineSession(userId, {
              ...currentSession,
              step: "enter_detail",
              reason: text,
            });
            await replyLineMessage(
              replyToken,
              quickReplyMsg(
                "พิมพ์อธิบายเพิ่มเติม หรือส่งรูปถ่ายทุเรียนเข้ามาในแชทนี้เพื่อยืนยันเคลมได้เลยครับ",
                [
                  { label: "ไม่มีรายละเอียดเพิ่ม", text: "ขอแจ้งเคลมตามอาการที่เลือก" },
                  { label: "ยกเลิก", text: "ยกเลิก" },
                ]
              ),
              token
            );
            continue;
          }

          if (currentSession.step === "enter_detail") {
            let evidenceName: string | undefined;
            if (msgType === "image" && ev.message.id) {
              const savedClaimImg = await downloadAndVerifyLineImage(
                ev.message.id,
                token,
                "claim"
              );
              evidenceName = savedClaimImg.ok
                ? savedClaimImg.apiPath
                : `line-photo-${ev.message.id}.jpg`;
            }

            const claimRes = await submitNewClaim({
              orderId: currentSession.orderId,
              phone: currentSession.phone,
              reason: currentSession.reason || "other",
              description:
                msgType === "image"
                  ? "ส่งภาพหลักฐานทางแชท LINE"
                  : text || "แจ้งเคลมทาง LINE",
              evidenceName,
            });

            clearLineSession(userId);

            if (!claimRes.ok) {
              await replyLineMessage(
                replyToken,
                [
                  {
                    type: "text",
                    text: `ส่งเคลมไม่สำเร็จ: ${claimRes.error}`,
                    quickReply: buildMainQuickReply(),
                  },
                ],
                token
              );
              continue;
            }

            await replyLineMessage(
              replyToken,
              buildClaimReceiptForCustomerFlex(claimRes.claim),
              token
            );
            continue;
          }
        }

        // Tracking Flow
        if (currentSession?.flow === "track" && msgType === "text") {
          clearLineSession(userId);
          const { data } = await getAllDatabase();
          const digits = text.replace(/[^\d]/g, "");
          const order =
            findOrderById(data.orders, extractOrderId(text) || text) ||
            (digits.length >= 9
              ? data.orders.find((o) => o.phone.replace(/[^\d]/g, "") === digits)
              : undefined);

          if (order) {
            const flex = buildCustomerStatusFlex(order);
            if (flex[0] && typeof flex[0] === "object") {
              (flex[0] as Record<string, unknown>).quickReply = buildMainQuickReply();
            }
            await replyLineMessage(replyToken, flex, token);
          } else {
            await replyLineMessage(
              replyToken,
              [
                {
                  type: "text",
                  text: `ไม่พบคำสั่งซื้อจาก "${text}" ครับ กรุณาตรวจสอบรหัส WK-xxxx หรือโทร ${shopInfo.phone}`,
                  quickReply: buildMainQuickReply(),
                },
              ],
              token
            );
          }
          continue;
        }

        // Photo sent outside wizard (e.g. Slip sent later!)
        if (msgType === "image" && ev.message.id) {
          const savedSlip = await downloadAndVerifyLineImage(
            ev.message.id,
            token,
            "slip"
          );
          const { data } = await getAllDatabase();
          const userOrders = data.orders.filter((o) => o.lineUserId === userId);
          const latestOrder = userOrders.sort((a, b) => new Date(b.createDate || 0).getTime() - new Date(a.createDate || 0).getTime())[0];

          if (latestOrder && savedSlip.ok) {
            await updateOrderRecord(latestOrder.id, {
              slipUrl: savedSlip.apiPath,
              paymentStatus: "slip_submitted",
              slipSubmittedAt: new Date().toISOString(),
              updatedBy: "customer-line-slip-photo",
            });
            latestOrder.slipUrl = savedSlip.apiPath;
            latestOrder.paymentStatus = "slip_submitted";
          }

          const adminTargets = [cfg.lineAdminGroupId, cfg.lineAdminUserId].filter(
            (id): id is string => Boolean(id && id.trim())
          );
          if (adminTargets.length > 0) {
            const alertMsgs = latestOrder
              ? buildSlipAlertForAdmin(latestOrder, savedSlip.ok ? savedSlip.apiPath : undefined, publicBaseUrl)
              : [
                  {
                    type: "text",
                    text: `🧾 แจ้งเตือน: ลูกค้าส่งรูปภาพ/สลิปทางแชท LINE\n👤 บัญชี: ${userId}${savedSlip.ok ? `\nไฟล์: ${savedSlip.filename}` : ""}`,
                  },
                ];
            for (const tId of adminTargets) {
              await pushLineMessage(tId, alertMsgs, token);
            }
          }

          if (latestOrder) {
            await replyLineMessage(
              replyToken,
              buildSlipSubmittedReceiptFlex(latestOrder),
              token,
              userId
            );
          } else {
            await replyLineMessage(
              replyToken,
              [
                {
                  type: "text",
                  text: "ได้รับรูปภาพ / สลิปโอนเงินแล้วครับ แอดมินกำลังตรวจสอบความถูกต้องให้ทันทีครับ 🙏\n\nหากต้องการสั่งจองหรือเช็กสถานะ สามารถกดเมนูด้านล่างได้เลยครับ",
                  quickReply: buildMainQuickReply(),
                },
              ],
              token,
              userId
            );
          }
          continue;
        }

        // Direct Address / Contact Capture from free-form LINE Chat ("บางทีเขากรอกที่ไลน์มาก็มี")
        if (msgType === "text") {
          const lowerText = (text || "").trim().toLowerCase();
          if (
            lowerText === "ที่อยู่" ||
            lowerText === "ที่อยู่ของฉัน" ||
            lowerText === "เช็คที่อยู่" ||
            lowerText === "เช็กที่อยู่" ||
            lowerText === "แก้ไขที่อยู่" ||
            lowerText === "เปลี่ยนที่อยู่" ||
            lowerText === "ข้อมูลจัดส่ง" ||
            lowerText === "ข้อมูลของฉัน"
          ) {
            const { data } = await getAllDatabase();
            const users = Array.isArray(data?.users) ? data.users : [];
            const matchedUser = userId
              ? users.find(
                  (u) =>
                    (u.lineUserId && u.lineUserId === userId) ||
                    u.username === `line_${userId}` ||
                    u.id === userId
                )
              : undefined;

            const formUrl = `${publicBaseUrl || "https://durianwinkin.vercel.app"}/address?userId=${encodeURIComponent(userId || "")}`;
            const fullName = matchedUser
              ? (`${matchedUser.firstName || ""} ${matchedUser.lastName || ""}`.trim() || matchedUser.displayName || matchedUser.username)
              : undefined;
            const fullAddr = matchedUser?.address
              ? `${matchedUser.address} ${matchedUser.postalCode || ""}`.trim()
              : undefined;

            await replyLineMessage(
              replyToken,
              buildAddressFormFlex(
                matchedUser && fullAddr
                  ? {
                      customerName: fullName || "คุณลูกค้า",
                      phone: matchedUser.phone,
                      address: fullAddr,
                      mapsUrl: matchedUser.mapsUrl,
                    }
                  : null,
                formUrl
              ),
              token
            );
            continue;
          }

          const directContact = parseContactInput(text);
          if (directContact) {
            try {
              await upsertLineUser({
                lineUserId: userId || undefined,
                customerName: directContact.customerName,
                phone: directContact.phone,
                address: directContact.address,
                source: "line-chat",
                notes: "แจ้งที่อยู่ผ่านแชท LINE OA โดยตรง",
              });
            } catch (userErr) {
              console.warn("Direct contact auto-save failed:", userErr);
            }

            await replyLineMessage(
              replyToken,
              [
                {
                  type: "text",
                  text: `🍈 บันทึกข้อมูลที่อยู่จัดส่งของคุณเรียบร้อยแล้วครับ!\n\n👤 ชื่อ: ${directContact.customerName}\n📞 โทร: ${directContact.phone}\n📍 ที่อยู่: ${directContact.address}\n\nต้องการสั่งซื้อทุเรียนเกรดพรีเมียมหรือเช็กสต็อก เลือกเมนูด้านล่างได้เลยครับ`,
                  quickReply: buildMainQuickReply(),
                },
              ],
              token
            );
            continue;
          }
        }

        // Greeting or fallback reply -> Interactive Welcome Card
        if (msgType === "text") {
          try {
            const { data } = await getAllDatabase();
            const rounds = Array.isArray(data?.rounds) ? data.rounds : [];
            const activeRound =
              rounds.find((r) => r.status === "open") || rounds[0];
            await replyLineMessage(replyToken, buildWelcomeFlex(activeRound), token);
          } catch (err) {
            console.error("[LINE Webhook] Welcome reply error:", err);
            await replyLineMessage(
              replyToken,
              [
                {
                  type: "text",
                  text: `🍈 สวัสดีครับ! ร้านทุเรียนวินคิน ยินดีต้อนรับครับ\nต้องการสั่งซื้อทุเรียนเกรดพรีเมียม เช็กสต็อก หรือติดตามพัสดุ สามารถกดเลือกเมนูด้านล่างได้เลยครับ`,
                  quickReply: buildMainQuickReply(),
                },
              ],
              token
            );
          }
        }
      }
    } finally {
      markWebhookEventFinished(ev);
    }
  }

  return NextResponse.json({ ok: true });
} catch (err) {
    console.error("[LINE Webhook Fatal Error]", err);
    return NextResponse.json(
      { ok: true, error: String(err) },
      { status: 200 }
    );
  }
}
