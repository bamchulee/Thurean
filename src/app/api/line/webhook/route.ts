import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getAllDatabase,
  getRuntimeConfig,
  saveRuntimeConfig,
  updateOrderRecord,
  upsertLineUser,
} from "../../../../lib/sheets-db";
import {
  buildAddressFormFlex,
  buildClaimReceiptForCustomerFlex,
  buildCustomerStatusFlex,
  buildLiveStreamFlex,
  buildMainQuickReply,
  buildMoreMenuFlex,
  buildOrderSummaryForCustomerFlex,
  buildOrderCatalogMessages,
  buildUserOrdersFlex,
  buildPromotionsCarouselFlex,
  buildPromptPayQrPaymentFlex,
  buildStockOverviewMessages,
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
import { shopInfo } from "../../../../data/mock";

export const dynamic = "force-dynamic";

interface LineWebhookEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  postback?: { data?: string };
  message?: { id?: string; type: string; text?: string };
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
      const replyToken = ev.replyToken;
      const userId = ev.source?.userId || "";
      if (!replyToken || !token) continue;

      // แสดง Animation จุดสามจุด (...) ขยับได้ "กำลังพิมพ์..." ให้ลูกค้าเห็นทันทีทุกครั้งที่กดริชเมนูหรือส่งข้อความ
      if (userId) {
        await showLineLoadingAnimation(userId, token, 15);
      }

      // 0. Bot Joined a Group Event -> Auto-register Admin Group
      if (ev.type === "join") {
        const source = ev.source as any;
        const groupId = source?.groupId || source?.roomId;
        if (groupId) {
          saveRuntimeConfig({ lineAdminGroupId: groupId });
          await replyLineMessage(
            replyToken,
            [
              {
                type: "text",
                text: `🎉 สวัสดีครับทีมงานทุเรียนวิ่นขิ่น!\nบอทได้เข้าร่วมกลุ่มเรียบร้อยแล้วครับ 🍈\n\n📌 Group ID: ${groupId}\n✅ ระบบได้บันทึกกลุ่มนี้เป็น "กลุ่มแจ้งเตือนทีมงาน (Admin Alert Group)" อัตโนมัติแล้วครับ!\n\nเมื่อมีออเดอร์ใหม่ สลิป หรือรายการเคลม บอทจะส่งการ์ดแจ้งเตือนพร้อมปุ่มจัดการเข้ากลุ่มนี้ทันทีครับ 📦🚚`,
              },
            ],
            token
          );
        }
        continue;
      }

      // Group message special handling (Check Group ID or ignore non-command chatter)
      const evSource = ev.source as any;
      if (evSource?.type === "group" || evSource?.type === "room") {
        const groupId = evSource?.groupId || evSource?.roomId;
        const msgText = ev.message?.type === "text" ? (ev.message.text || "").trim().toLowerCase() : "";
        if (
          msgText.includes("รหัสกลุ่ม") ||
          msgText.includes("group id") ||
          msgText.includes("groupid") ||
          msgText.includes("สถานะกลุ่ม") ||
          msgText === "/group" ||
          msgText === "group"
        ) {
          if (groupId) {
            saveRuntimeConfig({ lineAdminGroupId: groupId });
            await replyLineMessage(
              replyToken,
              [
                {
                  type: "text",
                  text: `🍈 กลุ่มแจ้งเตือนทีมงานทุเรียนวิ่นขิ่น\n\n📌 Group ID: ${groupId}\n✅ สถานะ: ผูกระบบแจ้งเตือนเรียบร้อยแล้ว\n\nออเดอร์ใหม่ สลิป และแจ้งเคลมจะส่งเข้ามาที่นี่ครับ! 📦🚚`,
                },
              ],
              token
            );
          }
          continue;
        }

        // Admin quick weigh command in group: ชั่ง <OrderID> <WeightKg>
        const weighMatchGroup = (ev.message?.type === "text" ? (ev.message.text || "").trim() : "").match(/^(?:ชั่ง|นน|weight)\s+([a-zA-Z0-9_-]+)\s+([0-9.]+)/i);
        if (weighMatchGroup) {
          let orderTargetId = weighMatchGroup[1].trim().toUpperCase();
          if (/^\d+$/.test(orderTargetId)) {
            orderTargetId = `OD${orderTargetId.padStart(6, "0")}`;
          }
          const weightNum = parseFloat(weighMatchGroup[2]);
          const { data } = await getAllDatabase();
          const foundOrder = data.orders.find((o) => o.id.toUpperCase() === orderTargetId);
          if (!foundOrder) {
            await replyLineMessage(
              replyToken,
              [{ type: "text", text: `❌ ไม่พบคำสั่งซื้อ "${orderTargetId}" ในระบบครับ` }],
              token
            );
            continue;
          }

          const prod = data.products.find((p) => p.id === foundOrder.productId || p.name === foundOrder.productName) || data.products[0];
          const pricePerKg = prod?.pricePerKg || prod?.price || foundOrder.pricePerItem || 220;
          const qty = foundOrder.quantity || 1;
          const calculatedTotal = Math.round(weightNum * pricePerKg * qty);

          const updated = await updateOrderRecord(foundOrder.id, {
            weightPerItem: `${weightNum} กก.`,
            totalPrice: calculatedTotal,
            grandTotal: calculatedTotal + (foundOrder.shippingCost || 0),
            orderStatus: "รอชำระเงิน",
            updatedBy: "Admin (LINE)",
            updatedAt: new Date().toISOString(),
          });

          await replyLineMessage(
            replyToken,
            [
              {
                type: "text",
                text: `✅ บันทึกน้ำหนักออเดอร์ #${foundOrder.id} สำเร็จ!\n\n📦 สินค้า: ${foundOrder.productName || foundOrder.id}\n⚖️ น้ำหนักจริง: ${weightNum} กก.\n💰 ราคารวม: ฿${calculatedTotal.toLocaleString()} (จาก ฿${pricePerKg}/กก.)\n📌 สถานะ: รอชำระเงิน\n\n📲 ระบบส่งการ์ดยอดชำระเงินและแจ้งลูกค้าทาง LINE เรียบร้อยแล้วครับ! 🍈✨`,
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

        // In group, ignore customer ordering flow so team conversation isn't interrupted
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
            const totalPrice = (currentSession.price || 0) * qty;
            const shipOpt =
              shopInfo.shippingMethods.find(
                (s) => s.name.toLowerCase() === (currentSession.shippingMethod || "").toLowerCase()
              ) || shopInfo.shippingMethods[0];
            const shippingCost = shipOpt.price;
            const grandTotal = totalPrice + shippingCost;
            const customerName =
              `${userObj.firstName || ""} ${userObj.lastName || ""}`.trim() ||
              userObj.displayName ||
              userObj.username ||
              "ลูกค้า";
            const phone = userObj.phone || "";
            const address = userObj.address || "";

            setLineSession(userId, {
              ...currentSession,
              step: "await_slip",
              customerName,
              phone,
              address,
              grandTotal,
              updatedAt: Date.now(),
            });

            await replyLineMessage(
              replyToken,
              buildPromptPayQrPaymentFlex({
                grandTotal,
                totalPrice,
                shippingCost,
                shippingMethod: currentSession.shippingMethod || shipOpt.name,
                productName: currentSession.productName || "ทุเรียนวินคิน",
                qty,
                customerName,
                phone,
                ripenessPref: currentSession.ripenessPref || "ปกติ (พร้อมทาน)",
              }),
              token
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

        if (action === "confirm_without_slip") {
          const session = getLineSession(userId);
          if (
            !session ||
            session.flow !== "order" ||
            session.step !== "await_slip" ||
            !session.customerName ||
            !session.phone ||
            !session.address
          ) {
            await replyLineMessage(
              replyToken,
              [
                {
                  type: "text",
                  text: "ยังไม่มีข้อมูลคำสั่งซื้อที่รอแนบสลิปครับ กด \"สั่งซื้อ\" เพื่อเริ่มสั่งใหม่ได้เลย",
                  quickReply: buildMainQuickReply(),
                },
              ],
              token
            );
            continue;
          }

          const res = await submitNewOrder({
            customerName: session.customerName,
            phone: session.phone,
            address: session.address,
            ripenessPref: session.ripenessPref,
            shippingMethod: session.shippingMethod,
            lineUserId: userId || undefined,
            notes: "สั่งซื้อผ่านแชท LINE OA (แจ้งโอน/ส่งสลิปภายหลัง)",
            items: [
              {
                productId: session.productId,
                qty: session.qty || 1,
                ripenessPref: session.ripenessPref,
              },
            ],
          });

          clearLineSession(userId);

          if (!res.ok) {
            await replyLineMessage(
              replyToken,
              [{ type: "text", text: `สร้างออเดอร์ไม่สำเร็จ: ${res.error}`, quickReply: buildMainQuickReply() }],
              token
            );
            continue;
          }

          await replyLineMessage(
            replyToken,
            buildOrderSummaryForCustomerFlex(res.order),
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
          let orderTargetId = weighMatchDm[1].trim().toUpperCase();
          if (/^\d+$/.test(orderTargetId)) {
            orderTargetId = `OD${orderTargetId.padStart(6, "0")}`;
          }
          const weightNum = parseFloat(weighMatchDm[2]);
          const { data } = await getAllDatabase();
          const foundOrder = data.orders.find((o) => o.id.toUpperCase() === orderTargetId);
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
            lower === "จองทุเรียน";

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

          const directOrderCode = text.match(/WK-\d+/i)?.[0]?.toUpperCase();
          if (
            directOrderCode &&
            !(currentSession?.flow === "claim" && currentSession.step === "enter_order")
          ) {
            const { data } = await getAllDatabase();
            const order = data.orders.find(
              (o) => o.id.toUpperCase() === directOrderCode
            );
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

            const qty = currentSession.qty || 1;
            const totalPrice = currentSession.price * qty;
            const shipOpt = resolveShippingOption(currentSession.shippingMethod);
            const shippingCost = shipOpt.price;
            const grandTotal = totalPrice + shippingCost;

            // Auto-save customer to Google Sheet Users table
            try {
              await upsertLineUser({
                lineUserId: userId || undefined,
                customerName: parsed.customerName,
                phone: parsed.phone,
                address: parsed.address,
                source: "line-chat",
                notes: `ขั้นตอนสั่งซื้อ ${currentSession.productName} (${currentSession.qty || 1} รายการ)`,
              });
            } catch (userErr) {
              console.warn("Auto-save user during contact step failed:", userErr);
            }

            setLineSession(userId, {
              ...currentSession,
              step: "await_slip",
              shippingMethod: shipOpt.name,
              shippingCost,
              totalPrice,
              grandTotal,
              customerName: parsed.customerName,
              phone: parsed.phone,
              address: parsed.address,
            });

            await replyLineMessage(
              replyToken,
              buildPromptPayQrPaymentFlex({
                productName: currentSession.productName,
                qty,
                ripenessPref: currentSession.ripenessPref || "ตามมาตรฐานร้าน",
                shippingMethod: shipOpt.name,
                customerName: parsed.customerName,
                phone: parsed.phone,
                totalPrice,
                shippingCost,
                grandTotal,
                publicBaseUrl,
              }),
              token
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
                      { label: "ออกเลข Order ก่อน", text: "ขอยังไม่แนบสลิป" },
                      { label: "ยกเลิก", text: "ยกเลิก" },
                    ]
                  ),
                  token
                );
                continue;
              }

              const result = await submitNewOrder({
                customerName: currentSession.customerName,
                phone: currentSession.phone,
                address: currentSession.address,
                ripenessPref: currentSession.ripenessPref,
                shippingMethod: currentSession.shippingMethod,
                lineUserId: userId || undefined,
                slipUrl: media.apiPath,
                notes: "สั่งซื้อพร้อมแนบสลิปผ่านแชท LINE OA",
                items: [
                  {
                    productId: currentSession.productId,
                    qty: currentSession.qty || 1,
                    ripenessPref: currentSession.ripenessPref,
                  },
                ],
              });

              clearLineSession(userId);

              if (!result.ok) {
                await replyLineMessage(
                  replyToken,
                  [
                    {
                      type: "text",
                      text: `สร้างออเดอร์ไม่สำเร็จ: ${result.error}`,
                      quickReply: buildMainQuickReply(),
                    },
                  ],
                  token
                );
                continue;
              }

              await replyLineMessage(
                replyToken,
                buildOrderSummaryForCustomerFlex(result.order),
                token
              );
              continue;
            }

            if (msgType === "text" && text.includes("ไม่แนบสลิป")) {
              const res = await submitNewOrder({
                customerName: currentSession.customerName,
                phone: currentSession.phone,
                address: currentSession.address,
                ripenessPref: currentSession.ripenessPref,
                shippingMethod: currentSession.shippingMethod,
                lineUserId: userId || undefined,
                notes: "สั่งซื้อผ่านแชท LINE OA (แจ้งส่งสลิปภายหลัง)",
                items: [
                  {
                    productId: currentSession.productId,
                    qty: currentSession.qty || 1,
                    ripenessPref: currentSession.ripenessPref,
                  },
                ],
              });
              clearLineSession(userId);
              if (res.ok) {
                await replyLineMessage(
                  replyToken,
                  buildOrderSummaryForCustomerFlex(res.order),
                  token
                );
              }
              continue;
            }

            await replyLineMessage(
              replyToken,
              quickReplyMsg(
                `ระบบกำลังรอรับ "รูปสลิปโอนเงิน" ยอด ฿${(currentSession.grandTotal || 0).toLocaleString()} ครับ 📸\n\nโอนเสร็จแล้วส่งรูปสลิปเข้ามาในแชทนี้เพื่อออกเลข Order WK-xxxx ได้เลยครับ`,
                [{ label: "ยกเลิก", text: "ยกเลิก" }]
              ),
              token
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
            const code =
              text.match(/WK-\d+/i)?.[0]?.toUpperCase() || text.trim().toUpperCase();

            const targetOrder = data.orders.find(
              (o) => o.id.toUpperCase() === code
            );

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
            data.orders.find((o) => o.id.toUpperCase() === text.toUpperCase()) ||
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
          const latestOrder = userId
            ? data.orders.find((o) => o.lineUserId === userId)
            : undefined;

          const adminTargets = [cfg.lineAdminGroupId, cfg.lineAdminUserId].filter(
            (id): id is string => Boolean(id && id.trim())
          );
          if (adminTargets.length > 0) {
            const alertMsgs: unknown[] = [
              {
                type: "text",
                text: `🧾 แจ้งเตือน: ลูกค้าส่งสลิปทางแชท LINE\n👤 ลูกค้า: ${latestOrder ? `${latestOrder.customerName} (ออเดอร์ #${latestOrder.id})` : userId}${savedSlip.ok ? `\nไฟล์: ${savedSlip.filename}` : ""}`,
              },
            ];
            if (savedSlip.ok && publicBaseUrl) {
              const url = `${publicBaseUrl}${savedSlip.apiPath}`;
              alertMsgs.push({
                type: "image",
                originalContentUrl: url,
                previewImageUrl: url,
              });
            }
            for (const tId of adminTargets) {
              await pushLineMessage(tId, alertMsgs, token);
            }
          }

          await replyLineMessage(
            replyToken,
            [
              {
                type: "text",
                text: "ได้รับรูปภาพ / สลิปโอนเงินแล้วครับ แอดมินกำลังตรวจสอบยอดให้ทันที 🙏\n\nหากต้องการสั่งเพิ่มหรือเช็กสถานะ กดเมนูด้านล่างได้เลยครับ",
                quickReply: buildMainQuickReply(),
              },
            ],
            token
          );
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
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
