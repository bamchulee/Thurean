import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getAllDatabase,
  getRuntimeConfig,
} from "../../../../lib/sheets-db";
import {
  buildClaimReceiptForCustomerFlex,
  buildCustomerStatusFlex,
  buildLiveStreamFlex,
  buildMainQuickReply,
  buildMoreMenuFlex,
  buildOrderSummaryForCustomerFlex,
  buildPromotionsCarouselFlex,
  buildPromptPayQrPaymentFlex,
  buildStockOverviewMessages,
  buildWelcomeFlex,
  pushLineMessage,
  replyLineMessage,
} from "../../../../lib/line-notify";
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
    const body = (await req.json()) as { events?: LineWebhookEvent[] };
    const cfg = getRuntimeConfig();
    const token = cfg.lineChannelAccessToken;
    const publicBaseUrl = resolvePublicBaseUrl(req, cfg.publicBaseUrl);
    const events = body.events || [];

    for (const ev of events) {
      const replyToken = ev.replyToken;
      const userId = ev.source?.userId || "";
      if (!replyToken || !token) continue;

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

        if (action === "stock" || action === "order") {
          clearLineSession(userId);
          const { data } = await getAllDatabase();
          const activeRound =
            data.rounds.find((r) => r.status === "open") || data.rounds[0];
          await replyLineMessage(
            replyToken,
            buildStockOverviewMessages(
              activeRound,
              data.products,
              action === "order" ? "order" : "stock"
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
          setLineSession(userId, {
            flow: "claim",
            step: "enter_order",
            updatedAt: Date.now(),
          });
          await replyLineMessage(
            replyToken,
            quickReplyMsg(
              "🛡️ ศูนย์รับประกัน & แจ้งเคลม 100%\n\nกรุณาพิมพ์รหัสคำสั่งซื้อของคุณ (เช่น WK-9520)",
              [{ label: "ยกเลิก", text: "ยกเลิก" }]
            ),
            token
          );
          continue;
        }

        if (action === "status") {
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

          if (isStockCmd || isOrderMenuCmd) {
            clearLineSession(userId);
            const { data } = await getAllDatabase();
            const activeRound =
              data.rounds.find((r) => r.status === "open") || data.rounds[0];
            await replyLineMessage(
              replyToken,
              buildStockOverviewMessages(
                activeRound,
                data.products,
                isOrderMenuCmd ? "order" : "stock"
              ),
              token
            );
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

          if (isClaimCmd) {
            setLineSession(userId, {
              flow: "claim",
              step: "enter_order",
              updatedAt: Date.now(),
            });
            await replyLineMessage(
              replyToken,
              quickReplyMsg(
                "🛡️ ศูนย์รับประกัน & แจ้งเคลม 100%\n\nกรุณาพิมพ์รหัสคำสั่งซื้อของคุณ (เช่น WK-9520)",
                [{ label: "ยกเลิก", text: "ยกเลิก" }]
              ),
              token
            );
            continue;
          }

          if (isTrackCmd) {
            setLineSession(userId, {
              flow: "track",
              step: "enter_query",
              updatedAt: Date.now(),
            });
            await replyLineMessage(
              replyToken,
              quickReplyMsg(
                "📦 พิมพ์รหัสออเดอร์ (เช่น WK-9521) หรือเบอร์โทรศัพท์ของคุณเพื่อเช็กบริษัทขนส่งและเลขพัสดุครับ",
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
            await replyLineMessage(
              replyToken,
              quickReplyMsg(
                "พิมพ์ ชื่อผู้รับ / เบอร์โทร / ที่อยู่จัดส่ง ในข้อความเดียวได้เลยครับ เดี๋ยวส่ง QR PromptPay ให้สแกนชำระครับ\n\nตัวอย่าง:\nคุณสมชาย ใจดี 0812345678 99/1 ถ.สุขุมวิท แขวงคลองตันเหนือ เขตวัฒนา กทม. 10110",
                [{ label: "ยกเลิก", text: "ยกเลิก" }]
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
            const code =
              text.match(/WK-\d+/i)?.[0]?.toUpperCase() || text.toUpperCase();
            if (!/^WK-\d+/.test(code)) {
              await replyLineMessage(
                replyToken,
                quickReplyMsg(
                  "กรุณาพิมพ์รหัสออเดอร์ที่ขึ้นต้นด้วย WK- เช่น WK-9520 ครับ",
                  [{ label: "ยกเลิก", text: "ยกเลิก" }]
                ),
                token
              );
              continue;
            }

            const phoneInline = text.match(/0\d{1,2}[-\s]?\d{3}[-\s]?\d{4}/)?.[0];
            if (phoneInline) {
              setLineSession(userId, {
                ...currentSession,
                step: "pick_reason",
                orderId: code,
                phone: phoneInline.replace(/\s+/g, ""),
              });
              await replyLineMessage(
                replyToken,
                quickReplyMsg(`ออเดอร์ ${code} — พบปัญหาแบบไหนครับ?`, [
                  { label: "ยังไม่สุก / แข็ง", text: "unripe" },
                  { label: "สุกงอม / เน่าเสีย", text: "spoiled" },
                  { label: "น้ำหนักไม่ครบ", text: "underweight" },
                  { label: "กล่องเสียหาย", text: "damaged" },
                  { label: "ยกเลิก", text: "ยกเลิก" },
                ]),
                token
              );
            } else {
              setLineSession(userId, {
                ...currentSession,
                step: "enter_phone",
                orderId: code,
              });
              await replyLineMessage(
                replyToken,
                quickReplyMsg(
                  `รับรหัสออเดอร์ ${code} แล้วครับ พิมพ์เบอร์โทรศัพท์ที่ใช้สั่งซื้อได้เลย`,
                  [{ label: "ยกเลิก", text: "ยกเลิก" }]
                ),
                token
              );
            }
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

          if (cfg.lineAdminUserId) {
            const alertMsgs: unknown[] = [
              {
                type: "text",
                text: `🧾 ลูกค้าส่งรูปสลิปทางแชท LINE\nLINE User ID: ${userId}${latestOrder ? `\nออเดอร์ล่าสุด: ${latestOrder.id} (${latestOrder.customerName})` : ""}${savedSlip.ok ? `\nไฟล์: ${savedSlip.filename}` : ""}`,
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
            await pushLineMessage(cfg.lineAdminUserId, alertMsgs, token);
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

        // Greeting or fallback reply -> Interactive Welcome Card
        if (msgType === "text") {
          const { data } = await getAllDatabase();
          const activeRound =
            data.rounds.find((r) => r.status === "open") || data.rounds[0];
          await replyLineMessage(replyToken, buildWelcomeFlex(activeRound), token);
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
