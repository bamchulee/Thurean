// ============================================================
// LINE OA Messaging API Helper for "ทุเรียนวินคิน"
// ============================================================
import type {
  Claim,
  Order,
  Product,
  Promotion,
  Round,
  RuntimeConfig,
} from "../types/durian";
import { shopInfo } from "../data/mock";
import { resolveCourierInfo } from "./courier";
import { formatProductStock } from "./stock";
import { checkClaimEligibility } from "./claim-policy";

const FALLBACK_FLEX_IMAGE =
  "https://images.unsplash.com/photo-1519544442-93857b48665e?auto=format&fit=crop&w=800&q=80";

function safeHttpsImage(url?: string): string {
  return url && url.startsWith("https://") ? url : FALLBACK_FLEX_IMAGE;
}

export function buildMainQuickReply() {
  return {
    items: [
      {
        type: "action",
        action: { type: "message", label: "สั่งซื้อทุเรียน", text: "สั่งซื้อ" },
      },
      {
        type: "action",
        action: { type: "message", label: "เช็กสต็อก (กก.)", text: "เช็กสต็อก" },
      },
      {
        type: "action",
        action: { type: "message", label: "💬 คุยกับแอดมิน", text: "คุยกับแอดมิน" },
      },
      {
        type: "action",
        action: { type: "message", label: "📍 ที่อยู่จัดส่ง", text: "ที่อยู่" },
      },
      {
        type: "action",
        action: { type: "location", label: "🗺️ ปักหมุดแผนที่" },
      },
      {
        type: "action",
        action: { type: "message", label: "เช็กโปรโมชั่น", text: "โปรโมชั่น" },
      },
      {
        type: "action",
        action: { type: "message", label: "ดูไลฟ์สด", text: "ดูไลฟ์สด" },
      },
      {
        type: "action",
        action: { type: "message", label: "แจ้งเคลม 100%", text: "แจ้งเคลม" },
      },
      {
        type: "action",
        action: { type: "message", label: "เพิ่มเติม", text: "เพิ่มเติม" },
      },
    ],
  };
}

export async function pushLineMessage(
  toUserId: string,
  messages: unknown[],
  channelAccessToken?: string
): Promise<{ sent: boolean; reason?: string }> {
  if (!channelAccessToken || !toUserId) {
    return { sent: false, reason: "Missing LINE token or target userId" };
  }

  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: toUserId,
        messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { sent: false, reason: `LINE API ${res.status}: ${errText}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: String(err) };
  }
}

export async function replyLineMessage(
  replyToken: string,
  messages: unknown[],
  channelAccessToken?: string,
  fallbackUserId?: string
): Promise<boolean> {
  if (!channelAccessToken) return false;
  let replySuccess = false;
  if (replyToken) {
    try {
      const res = await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${channelAccessToken}`,
        },
        body: JSON.stringify({ replyToken, messages }),
      });
      if (res.ok) {
        replySuccess = true;
      } else {
        const errText = await res.text();
        console.warn("[LINE Reply Error]", res.status, errText);
      }
    } catch (err) {
      console.warn("[LINE Reply Network Error]", err);
    }
  }

  // If reply failed (e.g. 400 Invalid reply token / timeout) and we have fallbackUserId: push instead!
  if (!replySuccess && fallbackUserId) {
    console.log(`[LINE Reply Fallback] Pushing directly to user ${fallbackUserId}`);
    const pushRes = await pushLineMessage(fallbackUserId, messages, channelAccessToken);
    return pushRes.sent;
  }

  return replySuccess;
}

/** แสดงสถานะ "กำลังพิมพ์..." (Loading Animation จุดสามจุดขยับได้) ให้ลูกค้าเห็นในหน้าแชททันที */
export async function showLineLoadingAnimation(
  chatId: string,
  channelAccessToken?: string,
  loadingSeconds = 15
): Promise<void> {
  if (!channelAccessToken || !chatId) return;
  try {
    const res = await fetch("https://api.line.me/v2/bot/chat/loading/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({ chatId, loadingSeconds }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn("[LINE Loading Error]", res.status, err);
    }
  } catch (err) {
    console.warn("[LINE Loading Exception]", err);
  }
}

export function buildOrderAlertForAdmin(order: Order, publicBaseUrl?: string): unknown[] {
  const itemLines = order.items
    .map((it) => `• ${it.productName} x${it.qty}`)
    .join("\n");
  const grandTotal = order.totalPrice + order.shippingCost;
  const baseUrl = publicBaseUrl || "https://durianwinkin.vercel.app";

  return [
    {
      type: "flex",
      altText: `🍈 แจ้งเตือนออเดอร์ใหม่ #${order.id} (฿${grandTotal.toLocaleString()})`,
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#14532d",
          paddingAll: "lg",
          contents: [
            {
              type: "text",
              text: "🍈 แจ้งเตือนออเดอร์ใหม่! (ทีมงาน)",
              color: "#fde047",
              weight: "bold",
              size: "md",
            },
            {
              type: "text",
              text: `รหัสคำสั่งซื้อ: #${order.id}`,
              color: "#ffffff",
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
              text: `ลูกค้า: ${order.customerName}`,
              weight: "bold",
              size: "sm",
              color: "#111827",
            },
            {
              type: "text",
              text: `โทร: ${order.phone}`,
              size: "xs",
              color: "#4b5563",
            },
            ...(order.address
              ? [
                  {
                    type: "text",
                    text: `ที่อยู่: ${order.address}`,
                    size: "xs",
                    color: "#6b7280",
                    wrap: true,
                  },
                ]
              : []),
            {
              type: "text",
              text: `ความสุก: ${order.ripenessPref || "ตามมาตรฐานร้าน"}`,
              size: "xs",
              color: "#b45309",
              weight: "bold",
            },
            { type: "separator", margin: "sm" },
            {
              type: "text",
              text: itemLines,
              wrap: true,
              size: "xs",
              margin: "sm",
            },
            { type: "separator", margin: "sm" },
            {
              type: "box",
              layout: "horizontal",
              margin: "sm",
              contents: [
                { type: "text", text: "ยอดรวมสุทธิ", size: "sm", weight: "bold" },
                {
                  type: "text",
                  text: `฿${grandTotal.toLocaleString()}`,
                  size: "md",
                  weight: "bold",
                  color: "#15803d",
                  align: "end",
                },
              ],
            },
            {
              type: "text",
              text: `สถานะชำระ: ${order.paymentStatus === "confirmed" ? "ชำระเงินแล้ว ✅" : "รอตรวจสลิป ⚡"}`,
              size: "xs",
              color: order.paymentStatus === "confirmed" ? "#15803d" : "#b45309",
              weight: "bold",
            },
            {
              type: "box",
              layout: "vertical",
              backgroundColor: "#FEF3C7",
              borderColor: "#FDE68A",
              borderWidth: "1px",
              cornerRadius: "md",
              paddingAll: "sm",
              margin: "sm",
              contents: [
                {
                  type: "text",
                  text: `สถานะ: 🟡 ${order.orderStatus || "สั่งจอง (รอชั่งน้ำหนัก)"}`,
                  size: "xs",
                  weight: "bold",
                  color: "#92400E",
                },
                {
                  type: "text",
                  text: `💡 พิมพ์ในกลุ่มเพื่อบันทึกน้ำหนักจริง:\nชั่ง ${order.id} <กก.>\n(เช่น: ชั่ง ${order.id} 3.85)`,
                  size: "xxs",
                  color: "#B45309",
                  wrap: true,
                  margin: "xs",
                },
              ],
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
              color: "#1B4D31",
              height: "sm",
              action: {
                type: "uri",
                label: "📦 เปิดจัดการบนเว็บ Admin",
                uri: `${baseUrl}/admin`,
              },
            },
            ...(order.mapsUrl
              ? [
                  {
                    type: "button",
                    style: "secondary",
                    height: "sm",
                    action: {
                      type: "uri",
                      label: "🗺️ เปิดหมุดแผนที่จัดส่ง",
                      uri: order.mapsUrl,
                    },
                  },
                ]
              : order.address
              ? [
                  {
                    type: "button",
                    style: "secondary",
                    height: "sm",
                    action: {
                      type: "uri",
                      label: "🗺️ ค้นหาที่อยู่บน Google Maps",
                      uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        order.address
                      )}`,
                    },
                  },
                ]
              : []),
            {
              type: "button",
              style: "link",
              height: "sm",
              action: {
                type: "uri",
                label: `📞 โทรหาลูกค้า (${order.phone})`,
                uri: `tel:${order.phone}`,
              },
            },
          ],
        },
      },
    },
  ];
}

export function buildCustomerStatusFlex(order: Order): unknown[] {
  const statusMap: Record<string, string> = {
    received: "📥 รับออเดอร์แล้ว (รอตรวจยอด)",
    preparing: "🍈 กำลังวิ่งรถกระบะไปคัดทุเรียนที่สวน",
    packed: "📦 แพ็กกล่องเรียบร้อย รอจัดส่ง",
    shipped: "🚚 จัดส่งแล้ว! กำลังเดินทางไปหาคุณ",
    delivered: "🎉 จัดส่งสำเร็จแล้ว",
    claimed: "🛡️ อยู่ระหว่างดำเนินการเคลม",
    "รอชั่งน้ำหนัก/สรุปยอด": "⚖️ กำลังคัดผลและชั่งน้ำหนักจริง",
    "รอชำระเงิน": "💰 ชั่งน้ำหนักเรียบร้อยแล้ว (รอชำระเงิน)",
    "ชำระเงินแล้ว/เตรียมจัดส่ง": "✅ ได้รับยอดชำระแล้ว (เตรียมจัดส่ง)",
    "กำลังจัดส่ง": "🚚 กำลังจัดส่งถึงบ้านคุณ",
    "จัดส่งสำเร็จ": "🎉 จัดส่งสำเร็จเรียบร้อยแล้ว",
    "ยกเลิก": "❌ ยกเลิกคำสั่งซื้อ",
  };

  const courierInfo = resolveCourierInfo(
    order.trackingNo,
    order.courier,
    order.shippingMethod
  );

  const grandTotal = order.totalPrice + (order.shippingCost || 0);

  const bodyContents: unknown[] = [
    {
      type: "text",
      text: statusMap[order.orderStatus] || order.orderStatus,
      weight: "bold",
      size: "sm",
      wrap: true,
      color: "#14532d",
    },
    {
      type: "text",
      text: `บริษัทขนส่ง: ${courierInfo.name}`,
      size: "xs",
      weight: "bold",
      color: "#1B4D31",
      wrap: true,
    },
    {
      type: "text",
      text: `วิธีส่ง: ${order.shippingMethod}`,
      size: "xs",
      color: "#4b5563",
      wrap: true,
    },
  ];

  if (order.weightPerItem) {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "⚖️ น้ำหนักต่อลูก:", size: "xs", color: "#6B7280", flex: 4 },
        { type: "text", text: String(order.weightPerItem), size: "xs", weight: "bold", color: "#166534", flex: 6 },
      ],
    });
  }

  bodyContents.push({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: "💰 ยอดรวมสุทธิ:", size: "xs", color: "#6B7280", flex: 4 },
      { type: "text", text: `฿${grandTotal.toLocaleString()}`, size: "sm", weight: "bold", color: "#15803d", flex: 6 },
    ],
  });

  if (order.trackingNo) {
    bodyContents.push({
      type: "box",
      layout: "vertical",
      backgroundColor: "#fef9c3",
      cornerRadius: "md",
      paddingAll: "md",
      margin: "md",
      contents: [
        { type: "text", text: `เลขพัสดุ (${courierInfo.name})`, size: "xxs", color: "#854d0e" },
        {
          type: "text",
          text: order.trackingNo,
          weight: "bold",
          size: "md",
          color: "#14532d",
        },
      ],
    });
  } else {
    bodyContents.push({
      type: "text",
      text: "ยังไม่มีเลขพัสดุ (หากส่งด้วยรถกระบะร้าน เจ้าหน้าที่จะโทรนัดเวลาก่อนถึงครับ)",
      size: "xxs",
      color: "#78716c",
      wrap: true,
    });
  }

  const bubble: Record<string, unknown> = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#15803d",
      contents: [
        {
          type: "text",
          text: "อัปเดตสถานะคำสั่งซื้อ",
          color: "#fde047",
          weight: "bold",
          size: "sm",
        },
        {
          type: "text",
          text: `ออเดอร์ ${order.id} • ทุเรียนวินคิน`,
          color: "#ffffff",
          size: "xs",
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: bodyContents,
    },
  };

  if (courierInfo.trackingUrl && order.trackingNo) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#1B4D31",
          height: "sm",
          action: {
            type: "uri",
            label: "เช็กเลขพัสดุ",
            uri: courierInfo.trackingUrl,
          },
        },
      ],
    };
  }

  return [
    {
      type: "flex",
      altText: `อัปเดตสถานะทุเรียนวินคิน ${order.id} (${courierInfo.name})`,
      contents: bubble,
    },
  ];
}

export function buildClaimAlertForAdmin(claim: Claim, publicBaseUrl?: string): unknown[] {
  const baseUrl = publicBaseUrl || "https://durianwinkin.vercel.app";
  return [
    {
      type: "flex",
      altText: `🚨 แจ้งเตือนรายการเคลม #${claim.claimId} (ออเดอร์ #${claim.orderId})`,
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#991b1b",
          paddingAll: "lg",
          contents: [
            {
              type: "text",
              text: "🚨 แจ้งเตือนรายการเคลมทุเรียน! (ทีมงาน)",
              color: "#ffffff",
              weight: "bold",
              size: "sm",
            },
            {
              type: "text",
              text: `รหัสเคลม: #${claim.claimId} • ออเดอร์ #${claim.orderId}`,
              color: "#fecaca",
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
              text: `ลูกค้า: ${claim.customerName || "ไม่ระบุชื่อ"}`,
              weight: "bold",
              size: "sm",
            },
            {
              type: "text",
              text: `เบอร์โทร: ${claim.phone}`,
              size: "xs",
              color: "#4b5563",
            },
            {
              type: "text",
              text: `สาเหตุที่เคลม: ${claim.reason}`,
              size: "xs",
              color: "#b91c1c",
              weight: "bold",
            },
            ...(claim.description
              ? [
                  {
                    type: "text",
                    text: `รายละเอียด: ${claim.description}`,
                    size: "xs",
                    color: "#374151",
                    wrap: true,
                  },
                ]
              : []),
            ...(claim.evidenceName
              ? [
                  {
                    type: "text",
                    text: `หลักฐาน: ${claim.evidenceName}`,
                    size: "xs",
                    color: "#6b7280",
                  },
                ]
              : []),
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
              color: "#991b1b",
              height: "sm",
              action: {
                type: "uri",
                label: "🛡️ ตรวจสอบในศูนย์เคลมบนเว็บ",
                uri: `${baseUrl}/admin`,
              },
            },
            {
              type: "button",
              style: "link",
              height: "sm",
              action: {
                type: "uri",
                label: `📞 โทรหาลูกค้า (${claim.phone})`,
                uri: `tel:${claim.phone}`,
              },
            },
          ],
        },
      },
    },
  ];
}

export interface TicketInfo {
  ticketId: string;
  customerName: string;
  phone?: string;
  lineUserId?: string;
  orderId?: string;
  message: string;
  source?: string;
  createdAt?: string;
}

export function buildTicketAlertForAdmin(
  ticket: TicketInfo,
  publicBaseUrl?: string
): unknown[] {
  const baseUrl = publicBaseUrl || "https://durianwinkin.vercel.app";
  return [
    {
      type: "flex",
      altText: `💬 [Ticket #${ticket.ticketId}] ลูกค้า ${ticket.customerName} สอบถาม: ${ticket.message.slice(0, 40)}`,
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#0369A1",
          paddingAll: "lg",
          contents: [
            {
              type: "text",
              text: "💬 มีลูกค้าเปิด Ticket สอบถาม! (ทีมงาน)",
              color: "#ffffff",
              weight: "bold",
              size: "sm",
            },
            {
              type: "text",
              text: `รหัส Ticket: #${ticket.ticketId}${ticket.orderId ? ` • ออเดอร์ #${ticket.orderId}` : ""}`,
              color: "#bae6fd",
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
              text: `ลูกค้า: ${ticket.customerName}`,
              weight: "bold",
              size: "sm",
              color: "#111827",
            },
            ...(ticket.phone
              ? [
                  {
                    type: "text",
                    text: `เบอร์โทร: ${ticket.phone}`,
                    size: "xs",
                    color: "#4b5563",
                  },
                ]
              : []),
            ...(ticket.orderId
              ? [
                  {
                    type: "text",
                    text: `รหัสคำสั่งซื้อ: #${ticket.orderId}`,
                    size: "xs",
                    color: "#0284c7",
                    weight: "bold",
                  },
                ]
              : []),
            {
              type: "box",
              layout: "vertical",
              backgroundColor: "#f0f9ff",
              borderColor: "#bae6fd",
              borderWidth: "1px",
              cornerRadius: "md",
              paddingAll: "md",
              margin: "sm",
              contents: [
                {
                  type: "text",
                  text: "ข้อความจากลูกค้า:",
                  size: "xxs",
                  color: "#0369a1",
                  weight: "bold",
                },
                {
                  type: "text",
                  text: ticket.message,
                  size: "xs",
                  color: "#0f172a",
                  wrap: true,
                  margin: "xs",
                },
              ],
            },
            {
              type: "text",
              text: `🕒 เวลา: ${ticket.createdAt || new Date().toLocaleString("th-TH")}`,
              size: "xxs",
              color: "#9ca3af",
              margin: "xs",
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
              color: "#06C755",
              height: "sm",
              action: {
                type: "uri",
                label: "💬 เปิดแชทตอบลูกค้าทันที (LINE Chat)",
                uri: "https://chat.line.biz/",
              },
            },
            ...(ticket.orderId
              ? [
                  {
                    type: "button",
                    style: "secondary",
                    height: "sm",
                    action: {
                      type: "uri",
                      label: `📦 ดูออเดอร์ #${ticket.orderId} ในระบบ`,
                      uri: `${baseUrl}/tracking?q=${encodeURIComponent(ticket.orderId)}`,
                    },
                  },
                ]
              : []),
            ...(ticket.phone
              ? [
                  {
                    type: "button",
                    style: "link",
                    height: "sm",
                    action: {
                      type: "uri",
                      label: `📞 โทรหาลูกค้า (${ticket.phone})`,
                      uri: `tel:${ticket.phone}`,
                    },
                  },
                ]
              : []),
          ],
        },
      },
    },
  ];
}

export function buildWelcomeFlex(round?: Round): unknown[] {
  const quotaText = round
    ? `โควตารอบนี้เหลือ ${round.quotaRemaining}/${round.totalQuota} กล่อง • ส่ง ${round.deliveryDate}`
    : "เปิดรับออเดอร์รอบล่าสุดแล้ว";

  return [
    {
      type: "flex",
      altText: `ยินดีต้อนรับสู่ร้าน ${shopInfo.name} (${shopInfo.lineOA})`,
      quickReply: buildMainQuickReply(),
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#1B4D31",
          paddingAll: "lg",
          contents: [
            {
              type: "text",
              text: `${shopInfo.name} • ${shopInfo.lineOA}`,
              color: "#FDE047",
              weight: "bold",
              size: "md",
            },
            {
              type: "text",
              text: shopInfo.tagline,
              color: "#E7E5E4",
              size: "xs",
              wrap: true,
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
              text: round?.name || "รอบรถกระบะรับตรงจากสวน",
              weight: "bold",
              size: "sm",
              color: "#1B4D31",
              wrap: true,
            },
            {
              type: "text",
              text: quotaText,
              size: "xs",
              color: "#57534E",
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
              color: "#1B4D31",
              height: "sm",
              action: {
                type: "postback",
                label: "เช็กสต็อก & สั่งซื้อ",
                data: "action=stock",
                displayText: "เช็กสต็อกรอบนี้",
              },
            },
            {
              type: "box",
              layout: "horizontal",
              spacing: "sm",
              contents: [
                {
                  type: "button",
                  style: "secondary",
                  height: "sm",
                  action: {
                    type: "postback",
                    label: "เช็กสถานะ",
                    data: "action=status",
                    displayText: "เช็กสถานะออเดอร์",
                  },
                },
                {
                  type: "button",
                  style: "secondary",
                  height: "sm",
                  action: {
                    type: "postback",
                    label: "แจ้งเคลม 100%",
                    data: "action=claim",
                    displayText: "แจ้งเคลมสินค้า",
                  },
                },
              ],
            },
          ],
        },
      },
    },
  ];
}

export function buildStockOverviewMessages(
  round: Round | undefined,
  products: Product[],
  mode: "stock" | "order" = "stock",
  publicBaseUrl?: string
): unknown[] {
  // กรองเฉพาะรายการที่เปิดใช้งาน (isActive !== 0)
  const activeProducts = products.filter(
    (p) => p.isActive !== 0 && (p.isActive as any) !== "0" && p.isActive !== false
  );

  const availableProducts = activeProducts.filter((p) => {
    const info = formatProductStock(p);
    return p.isAvailable && !info.isOutOfStock;
  });

  const totalKg = activeProducts.reduce(
    (sum, p) => sum + (p.stockUnit === "kg" && typeof p.stockKg === "number" ? p.stockKg : 0),
    0
  );
  const isClosed = round?.status === "closed" || (round?.quotaRemaining ?? 1) <= 0;
  const isLowQuota = !isClosed && (round?.quotaRemaining ?? 0) <= 5 && (round?.quotaRemaining ?? 0) > 0;
  const statusColor = isClosed ? "#DC2626" : isLowQuota ? "#D97706" : "#15803D";
  const statusText = isClosed ? "🔴 ปิดรับรอบส่งแล้ว" : isLowQuota ? "🟠 โควต้าใกล้เต็ม" : "🟢 กำลังเปิดรับออเดอร์";

  // สร้างแถวรายการสต็อกย่อสำหรับใส่ในการ์ด Dashboard (ตัวหนังสือใหญ่ อ่านง่าย ไม่ตัดคำ)
  const miniStockRows = activeProducts.slice(0, 6).map((p) => {
    const st = formatProductStock(p);
    const isOut = p.isAvailable === false || st.isOutOfStock;
    return {
      type: "box",
      layout: "horizontal",
      margin: "sm",
      contents: [
        {
          type: "text",
          text: isOut ? "⚪" : st.isLowStock ? "🟠" : "🟢",
          size: "sm",
          flex: 1,
        },
        {
          type: "text",
          text: p.name,
          size: "sm",
          color: isOut ? "#9CA3AF" : "#1F2937",
          weight: "bold",
          flex: 6,
          wrap: true,
        },
        {
          type: "text",
          text: isOut ? "หมดรอบนี้" : st.summary,
          size: "sm",
          color: isOut ? "#EF4444" : st.isLowStock ? "#D97706" : "#059669",
          weight: "bold",
          align: "end",
          flex: 4,
        },
      ],
    };
  });

  // การ์ดที่ 1: สรุปสต็อกและรอบจัดส่งแบบ Dashboard กราฟิกหรูหรา (แทน Plain Text เดิม)
  const overviewBubble = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#11301F",
      paddingAll: "lg",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: "🍈 สต็อกสดหน้าสวน",
              color: "#FDE047",
              weight: "bold",
              size: "md",
              flex: 5,
            },
            {
              type: "text",
              text: statusText,
              color: "#FFFFFF",
              size: "xs",
              weight: "bold",
              align: "end",
              flex: 4,
            },
          ],
        },
        {
          type: "text",
          text: `${shopInfo.name} — คัดแก่จัด 85%+ วิ่งตรงถึงบ้านคุณ`,
          color: "#E7E5E4",
          size: "xs",
          margin: "xs",
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      paddingAll: "lg",
      contents: [
        // Round info banner
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#F0FDF4",
          cornerRadius: "md",
          paddingAll: "md",
          borderColor: "#BBF7D0",
          borderWidth: "1px",
          contents: [
            {
              type: "text",
              text: `🚚 รอบส่ง: ${round?.name || "รอบจัดส่งปัจจุบัน"}`,
              weight: "bold",
              size: "sm",
              color: "#166534",
            },
            {
              type: "box",
              layout: "horizontal",
              margin: "sm",
              contents: [
                {
                  type: "text",
                  text: `✂️ ตัดสด: ${round?.harvestDate || "ตามคิว"}`,
                  size: "xs",
                  color: "#374151",
                  weight: "bold",
                  flex: 1,
                },
                {
                  type: "text",
                  text: `🏡 ส่งถึงบ้าน: ${round?.deliveryDate || "1-2 วัน"}`,
                  size: "xs",
                  color: "#374151",
                  weight: "bold",
                  align: "end",
                  flex: 1,
                },
              ],
            },
          ],
        },
        // 3-column stats metrics
        {
          type: "box",
          layout: "horizontal",
          spacing: "xs",
          contents: [
            {
              type: "box",
              layout: "vertical",
              backgroundColor: "#FEF3C7",
              cornerRadius: "md",
              paddingAll: "sm",
              flex: 1,
              contents: [
                { type: "text", text: "สต็อกรวม", size: "xs", color: "#92400E", align: "center" },
                {
                  type: "text",
                  text: `${totalKg.toFixed(1)} กก.`,
                  size: "sm",
                  weight: "bold",
                  color: "#78350F",
                  margin: "xs",
                  align: "center",
                },
              ],
            },
            {
              type: "box",
              layout: "vertical",
              backgroundColor: "#ECFDF5",
              cornerRadius: "md",
              paddingAll: "sm",
              flex: 1,
              contents: [
                { type: "text", text: "โควต้ากล่อง", size: "xs", color: "#065F46", align: "center" },
                {
                  type: "text",
                  text: `${round?.quotaRemaining ?? 0}/${round?.totalQuota ?? 0}`,
                  size: "sm",
                  weight: "bold",
                  color: "#047857",
                  margin: "xs",
                  align: "center",
                },
              ],
            },
            {
              type: "box",
              layout: "vertical",
              backgroundColor: "#EFF6FF",
              cornerRadius: "md",
              paddingAll: "sm",
              flex: 1,
              contents: [
                { type: "text", text: "พร้อมส่ง", size: "xs", color: "#1E40AF", align: "center" },
                {
                  type: "text",
                  text: `${availableProducts.length} ชนิด`,
                  size: "sm",
                  weight: "bold",
                  color: "#1D4ED8",
                  margin: "xs",
                  align: "center",
                },
              ],
            },
          ],
        },
        // Mini checklist
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            {
              type: "text",
              text: "📋 รายการสต็อกคงเหลือแต่ละสายพันธุ์:",
              weight: "bold",
              size: "sm",
              color: "#1C1917",
            },
            ...miniStockRows,
          ],
        },
        {
          type: "text",
          text: "👉 เลื่อนดูข้อมูลสเปกและความสุกทุเรียนแต่ละสายพันธุ์ด้านข้างได้เลยครับ",
          size: "xs",
          weight: "bold",
          color: "#065F46",
          align: "center",
          margin: "xs",
        },
      ],
    },
    footer: {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#166534",
          height: "sm",
          flex: 1,
          action: {
            type: "postback",
            label: "🔄 อัปเดตสต็อกสด",
            data: "action=stock",
            displayText: "เช็คสต็อก",
          },
        },
        ...(publicBaseUrl
          ? [
              {
                type: "button",
                style: "secondary",
                height: "sm",
                flex: 1,
                action: {
                  type: "uri",
                  label: "🌐 ดูหน้าร้านเว็บ",
                  uri: publicBaseUrl,
                },
              },
            ]
          : []),
      ],
    },
  };

  // การ์ดสินค้าแต่ละตัวใน Carousel (เฉพาะข้อมูลสต็อก ไม่มีปุ่มสั่งซื้อปน)
  const sorted = [...activeProducts]
    .sort((a, b) => Number(b.isAvailable) - Number(a.isAvailable))
    .slice(0, 10);

  const bubbles = sorted.map((p) => {
    const stockInfo = formatProductStock(p);
    const isLow = stockInfo.isLowStock;
    const isOut = p.isAvailable === false || stockInfo.isOutOfStock;

    return {
      type: "bubble",
      size: "mega",
      hero: {
        type: "image",
        url: safeHttpsImage(p.image),
        size: "full",
        aspectRatio: "16:9",
        aspectMode: "cover",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "lg",
        contents: [
          // 1. ชื่อ
          {
            type: "text",
            text: p.name,
            weight: "bold",
            size: "md",
            wrap: true,
            maxLines: 2,
            color: "#111827",
          },
          // 2. ราคาต่อโล
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "ราคาต่อโล:",
                size: "xs",
                color: "#6B7280",
                flex: 4,
              },
              {
                type: "text",
                text: `฿${(p.pricePerKg || p.price).toLocaleString()} / กก.`,
                weight: "bold",
                size: "lg",
                color: "#B45309",
                align: "end",
                flex: 6,
              },
            ],
          },
          { type: "separator", margin: "xs" },
          // 3. น้ำหนัก
          {
            type: "box",
            layout: "horizontal",
            margin: "xs",
            contents: [
              { type: "text", text: "⚖️ น้ำหนัก:", size: "xs", color: "#4B5563", flex: 4 },
              { type: "text", text: p.weight || "-", size: "xs", weight: "bold", color: "#1F2937", flex: 6 },
            ],
          },
          // 4. เกรด
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "🏷️ เกรด:", size: "xs", color: "#4B5563", flex: 4 },
              { type: "text", text: p.grade || "เกรด A+ พรีเมียม", size: "xs", weight: "bold", color: "#15803D", flex: 6 },
            ],
          },
          // 5. Texture
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "✨ Texture:", size: "xs", color: "#4B5563", flex: 4 },
              { type: "text", text: p.texture || p.specs?.texture || "กรอบนอกนุ่มใน", size: "xs", weight: "bold", color: "#0D9488", flex: 6 },
            ],
          },
          // 6. รายละเอียด
          {
            type: "box",
            layout: "vertical",
            margin: "sm",
            backgroundColor: "#F9FAFB",
            cornerRadius: "md",
            paddingAll: "sm",
            contents: [
              { type: "text", text: "📝 รายละเอียด:", size: "xxs", color: "#6B7280", weight: "bold" },
              {
                type: "text",
                text: p.description || "ทุเรียนคัดคุณภาพพิเศษ หวานมันกลมกล่อม",
                size: "xs",
                color: "#374151",
                wrap: true,
                margin: "xs",
              },
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "sm",
        spacing: "xs",
        contents: [
          {
            type: "text",
            text: isOut ? "⚪ สินค้าหมดรอบจัดส่งนี้" : isLow ? "🟠 สินค้าเหลือน้อยใกล้หมด" : "🟢 มีสินค้าพร้อมจัดส่ง",
            size: "xs",
            align: "center",
            weight: "bold",
            color: isOut ? "#9CA3AF" : isLow ? "#D97706" : "#166534",
          },
          ...(!isOut && !isClosed
            ? [
                {
                  type: "button",
                  style: "primary",
                  color: "#15803D",
                  height: "sm",
                  action: {
                    type: "postback",
                    label: "🛒 สั่งจองพันธุ์นี้",
                    data: `action=order_step&step=qty&pid=${encodeURIComponent(p.id)}`,
                    displayText: `สั่งจอง ${p.name}`,
                  },
                },
              ]
            : []),
        ],
      },
    };
  });

  return [
    {
      type: "flex",
      altText: `📦 รายงานสต็อกทุเรียนสดหน้าสวน — ${shopInfo.name}`,
      contents: overviewBubble,
    },
    {
      type: "flex",
      altText: `🍈 รายการทุเรียนพร้อมส่ง — ${shopInfo.name}`,
      quickReply: buildMainQuickReply(),
      contents: {
        type: "carousel",
        contents: bubbles,
      },
    },
  ];
}

/**
 * แคตตาล็อกสินค้าสำหรับสั่งซื้อโดยเฉพาะ (มีปุ่มสั่งซื้อพันธุ์นี้ชัดเจน ไม่แสดงการ์ดสรุปสต็อกปน)
 */
export function buildOrderCatalogMessages(
  products: Product[],
  round: Round | undefined,
  publicBaseUrl?: string
): unknown[] {
  const activeProducts = products.filter(
    (p) => p.isActive !== 0 && (p.isActive as any) !== "0" && p.isActive !== false
  );
  const isClosed = round?.status === "closed" || (round?.quotaRemaining ?? 1) <= 0;

  const bubbles = activeProducts.map((p) => {
    const stockInfo = formatProductStock(p);
    const canBuy = p.isAvailable && !stockInfo.isOutOfStock && !isClosed;
    const isLow = stockInfo.isLowStock;
    const isOut = p.isAvailable === false || stockInfo.isOutOfStock;

    return {
      type: "bubble",
      size: "mega",
      hero: {
        type: "image",
        url: safeHttpsImage(p.image),
        size: "full",
        aspectRatio: "16:9",
        aspectMode: "cover",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "lg",
        contents: [
          // 1. ชื่อ
          {
            type: "text",
            text: p.name,
            weight: "bold",
            size: "md",
            wrap: true,
            maxLines: 2,
            color: "#111827",
          },
          // 2. ราคาต่อโล
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "ราคาต่อโล:",
                size: "xs",
                color: "#6B7280",
                flex: 4,
              },
              {
                type: "text",
                text: `฿${(p.pricePerKg || p.price).toLocaleString()} / กก.`,
                weight: "bold",
                size: "lg",
                color: "#B45309",
                align: "end",
                flex: 6,
              },
            ],
          },
          { type: "separator", margin: "xs" },
          // 3. น้ำหนัก
          {
            type: "box",
            layout: "horizontal",
            margin: "xs",
            contents: [
              { type: "text", text: "⚖️ น้ำหนัก:", size: "xs", color: "#4B5563", flex: 4 },
              { type: "text", text: p.weight || "-", size: "xs", weight: "bold", color: "#1F2937", flex: 6 },
            ],
          },
          // 4. เกรด
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "🏷️ เกรด:", size: "xs", color: "#4B5563", flex: 4 },
              { type: "text", text: p.grade || "เกรด A+ พรีเมียม", size: "xs", weight: "bold", color: "#15803D", flex: 6 },
            ],
          },
          // 5. Texture
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "✨ Texture:", size: "xs", color: "#4B5563", flex: 4 },
              { type: "text", text: p.texture || p.specs?.texture || "กรอบนอกนุ่มใน", size: "xs", weight: "bold", color: "#0D9488", flex: 6 },
            ],
          },
          // 6. รายละเอียด
          {
            type: "box",
            layout: "vertical",
            margin: "sm",
            backgroundColor: "#F9FAFB",
            cornerRadius: "md",
            paddingAll: "sm",
            contents: [
              { type: "text", text: "📝 รายละเอียด:", size: "xxs", color: "#6B7280", weight: "bold" },
              {
                type: "text",
                text: p.description || "ทุเรียนคัดคุณภาพพิเศษ หวานมันกลมกล่อม",
                size: "xs",
                color: "#374151",
                wrap: true,
                margin: "xs",
              },
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "md",
        contents: [
          canBuy
            ? {
                type: "button",
                style: "primary",
                color: "#15803D",
                height: "sm",
                action: {
                  type: "postback",
                  label: "🛒 สั่งจองพันธุ์นี้",
                  data: `action=order_step&step=qty&pid=${encodeURIComponent(p.id)}`,
                  displayText: `สั่งจอง ${p.name}`,
                },
              }
            : {
                type: "button",
                style: "secondary",
                height: "sm",
                action: {
                  type: "postback",
                  label: "หมดรอบนี้ (ดูพันธุ์อื่น)",
                  data: "action=order",
                },
              },
        ],
      },
    };
  });

  return [
    {
      type: "flex",
      altText: `🛒 เลือกสั่งซื้อทุเรียน — ${shopInfo.name}`,
      quickReply: buildMainQuickReply(),
      contents: {
        type: "carousel",
        contents: bubbles,
      },
    },
  ];
}

/**
 * แสดงการ์ดฟอร์มที่อยู่จัดส่ง (เปิดฟอร์มเว็บ หรือใช้ที่อยู่เดิมที่มีในระบบ)
 */
export function buildAddressFormFlex(
  userAddress?: {
    customerName?: string;
    phone?: string;
    address?: string;
    mapsUrl?: string;
  } | null,
  formUrl?: string
): unknown[] {
  const hasSaved = Boolean(userAddress?.customerName && userAddress?.address);

  const bodyContents: unknown[] = [];

  if (hasSaved) {
    const infoContents: unknown[] = [
      {
        type: "text",
        text: `👤 ชื่อผู้รับ: ${userAddress?.customerName || "-"}`,
        size: "sm",
        weight: "bold",
        color: "#1F2937",
      },
      {
        type: "text",
        text: `📞 เบอร์โทร: ${userAddress?.phone || "-"}`,
        size: "xs",
        color: "#4B5563",
      },
      {
        type: "text",
        text: `📍 ที่อยู่: ${userAddress?.address || "-"}`,
        size: "xs",
        color: "#374151",
        wrap: true,
      },
    ];

    if (userAddress?.mapsUrl) {
      infoContents.push({
        type: "box",
        layout: "horizontal",
        spacing: "xs",
        contents: [
          {
            type: "text",
            text: "🗺️ หมุดแผนที่:",
            size: "xs",
            color: "#166534",
            weight: "bold",
            flex: 0,
          },
          {
            type: "text",
            text: "มีพิกัด Google Maps บันทึกไว้แล้ว",
            size: "xs",
            color: "#15803D",
            weight: "bold",
          },
        ],
      });
    }

    bodyContents.push(
      {
        type: "text",
        text: "📍 ข้อมูลที่อยู่จัดส่งที่บันทึกไว้ในระบบ:",
        size: "xs",
        weight: "bold",
        color: "#166534",
      },
      {
        type: "box",
        layout: "vertical",
        backgroundColor: "#F0FDF4",
        cornerRadius: "md",
        borderColor: "#BBF7D0",
        borderWidth: "1px",
        paddingAll: "md",
        spacing: "xs",
        margin: "sm",
        contents: infoContents,
      }
    );
  } else {
    bodyContents.push(
      {
        type: "text",
        text: "คุณยังไม่มีข้อมูลที่อยู่จัดส่งในระบบครับ",
        size: "sm",
        weight: "bold",
        color: "#1F2937",
      },
      {
        type: "text",
        text: "กรุณากดปุ่มด้านล่างเพื่อเปิดฟอร์มกรอกที่อยู่ หรือกด '🗺️ ปักหมุดใน LINE' เพื่อแชร์พิกัด GPS ได้ทันทีครับ",
        size: "xs",
        color: "#6B7280",
        wrap: true,
        margin: "sm",
      }
    );
  }

  const buttons: unknown[] = [];

  if (hasSaved) {
    buttons.push({
      type: "button",
      style: "primary",
      color: "#15803D",
      height: "sm",
      action: {
        type: "postback",
        label: "📍 ใช้ที่อยู่นี้จัดส่ง",
        data: "action=confirm_saved_address",
        displayText: "ใช้ที่อยู่นี้จัดส่ง",
      },
    });
  }

  if (formUrl) {
    buttons.push({
      type: "button",
      style: hasSaved ? "secondary" : "primary",
      color: hasSaved ? undefined : "#1B4D31",
      height: "sm",
      action: {
        type: "uri",
        label: hasSaved ? "📝 แก้ไขที่อยู่ / ปักหมุด" : "📝 เปิดฟอร์มกรอกที่อยู่",
        uri: formUrl,
      },
    });
  }

  if (userAddress?.mapsUrl) {
    buttons.push({
      type: "button",
      style: "link",
      height: "sm",
      action: {
        type: "uri",
        label: "🗺️ ดูบน Google Maps",
        uri: userAddress.mapsUrl,
      },
    });
  }

  return [
    {
      type: "flex",
      altText: `📍 ข้อมูลที่อยู่จัดส่ง — ${shopInfo.name}`,
      quickReply: buildMainQuickReply(),
      contents: {
        type: "bubble",
        size: "mega",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#11301F",
          paddingAll: "lg",
          contents: [
            {
              type: "text",
              text: "📍 จัดการข้อมูลที่อยู่จัดส่ง",
              color: "#FDE047",
              weight: "bold",
              size: "md",
            },
            {
              type: "text",
              text: `${shopInfo.name} — คัดตัดสดส่งตรงถึงหน้าบ้าน`,
              color: "#E7E5E4",
              size: "xs",
              margin: "xs",
            },
          ],
        },
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "lg",
          contents: bodyContents,
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          paddingAll: "md",
          contents: buttons,
        },
      },
    },
  ];
}

export function buildUserOrdersFlex(
  orders: Order[],
  claims: Claim[] = [],
  publicBaseUrl?: string
): unknown[] {
  if (orders.length === 0) {
    return [
      {
        type: "flex",
        altText: `ประวัติคำสั่งซื้อของคุณ — ${shopInfo.name}`,
        quickReply: buildMainQuickReply(),
        contents: {
          type: "bubble",
          size: "mega",
          header: {
            type: "box",
            layout: "vertical",
            backgroundColor: "#11301F",
            paddingAll: "lg",
            contents: [
              {
                type: "text",
                text: "📋 ประวัติคำสั่งซื้อของคุณ",
                color: "#FDE047",
                weight: "bold",
                size: "md",
              },
              {
                type: "text",
                text: `${shopInfo.name} — ไม่พบคำสั่งซื้อในบัญชีนี้`,
                color: "#E7E5E4",
                size: "xs",
                margin: "xs",
              },
            ],
          },
          body: {
            type: "box",
            layout: "vertical",
            spacing: "md",
            paddingAll: "lg",
            contents: [
              {
                type: "text",
                text: "ยังไม่พบรายการสั่งซื้อที่เชื่อมโยงกับบัญชี LINE นี้ครับ",
                size: "sm",
                color: "#374151",
                wrap: true,
              },
              {
                type: "text",
                text: "💡 หากคุณเคยสั่งซื้อผ่านเบอร์โทรศัพท์ สามารถพิมพ์เบอร์โทร 10 หลักเพื่อค้นหาประวัติคำสั่งซื้อได้เลยครับ",
                size: "xs",
                color: "#6B7280",
                wrap: true,
              },
            ],
          },
          footer: {
            type: "box",
            layout: "vertical",
            paddingAll: "md",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#166534",
                height: "sm",
                action: {
                  type: "message",
                  label: "🛒 สั่งซื้อทุเรียนรอบนี้",
                  text: "สั่งซื้อ",
                },
              },
            ],
          },
        },
      },
    ];
  }

  const sorted = [...orders]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 10);

  const bubbles = sorted.map((o) => {
    const grandTotal = o.totalPrice + o.shippingCost;
    const dateStr = o.createdAt
      ? new Date(o.createdAt).toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "-";

    const isPaid = o.paymentStatus === "confirmed" || o.orderStatus === "ชำระเงินแล้ว/เตรียมจัดส่ง" || o.orderStatus === "กำลังจัดส่ง" || o.orderStatus === "จัดส่งสำเร็จ";
    const isDelivered = o.orderStatus === "จัดส่งสำเร็จ" || o.orderStatus === "delivered";

    const statusBadgeText = isDelivered
      ? "✅ จัดส่งสำเร็จ (ถึงมือแล้ว)"
      : o.orderStatus === "กำลังจัดส่ง" || o.orderStatus === "shipped"
      ? "🚚 กำลังจัดส่ง"
      : o.orderStatus === "ชำระเงินแล้ว/เตรียมจัดส่ง" || o.orderStatus === "packed" || o.orderStatus === "preparing"
      ? "📦 ชำระแล้ว/เตรียมส่ง"
      : o.orderStatus === "รอชำระเงิน"
      ? "💳 รอชำระเงิน"
      : "⏳ รอชั่งน้ำหนัก/สรุปยอด";

    const statusBadgeColor = isDelivered
      ? "#15803D"
      : o.orderStatus === "กำลังจัดส่ง" || o.orderStatus === "shipped"
      ? "#2563EB"
      : o.orderStatus === "รอชำระเงิน"
      ? "#D97706"
      : "#059669";

    const eligibility = checkClaimEligibility(o, claims);

    const itemsSummary = o.items
      .map((it) => `• ${it.productName} x${it.qty}${it.weightPerItem ? ` (${it.weightPerItem})` : ""}`)
      .join("\n");

    const footerButtons: unknown[] = [
      {
        type: "button",
        style: "primary",
        color: "#1B4D31",
        height: "sm",
        action: {
          type: "postback",
          label: "🔍 เช็กสถานะพัสดุ",
          data: `action=track_order&orderId=${encodeURIComponent(o.id)}`,
          displayText: `เช็กสถานะ ${o.id}`,
        },
      },
    ];

    if (eligibility.eligible) {
      footerButtons.push({
        type: "button",
        style: "secondary",
        height: "sm",
        action: {
          type: "uri",
          label: `🛡️ แจ้งเคลม (เหลือ ${eligibility.hoursLeft ?? 24} ชม.)`,
          uri: `${publicBaseUrl || "https://durianwinkin.vercel.app"}/claim?orderId=${encodeURIComponent(o.id)}`,
        },
      });
    }

    return {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#11301F",
        paddingAll: "lg",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: `📦 ออเดอร์ #${o.id}`,
                color: "#FDE047",
                weight: "bold",
                size: "md",
                flex: 6,
              },
              {
                type: "text",
                text: isPaid ? "✅ ชำระแล้ว" : "⏳ รอชำระ",
                color: isPaid ? "#86EFAC" : "#FDE047",
                weight: "bold",
                size: "xs",
                align: "end",
                flex: 4,
              },
            ],
          },
          {
            type: "text",
            text: `วันที่สั่งซื้อ: ${dateStr}`,
            color: "#E7E5E4",
            size: "xs",
            margin: "xs",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "lg",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            backgroundColor: isDelivered ? "#DCFCE7" : "#EFF6FF",
            cornerRadius: "md",
            paddingStart: "md",
            paddingEnd: "md",
            paddingTop: "sm",
            paddingBottom: "sm",
            contents: [
              {
                type: "text",
                text: statusBadgeText,
                size: "xs",
                weight: "bold",
                color: statusBadgeColor,
              },
            ],
          },
          {
            type: "text",
            text: "รายการสินค้า:",
            size: "xs",
            weight: "bold",
            color: "#6B7280",
            margin: "sm",
          },
          {
            type: "text",
            text: itemsSummary,
            size: "sm",
            color: "#1F2937",
            wrap: true,
          },
          {
            type: "separator",
            margin: "sm",
          },
          {
            type: "box",
            layout: "horizontal",
            margin: "sm",
            contents: [
              {
                type: "text",
                text: "ยอดสุทธิ:",
                size: "sm",
                color: "#4B5563",
              },
              {
                type: "text",
                text: `฿${grandTotal.toLocaleString()}`,
                size: "md",
                weight: "bold",
                color: "#B45309",
                align: "end",
              },
            ],
          },
          ...(o.trackingNo
            ? [
                {
                  type: "text",
                  text: `🚚 ขนส่ง: ${o.courier || "พัสดุ"} (${o.trackingNo})`,
                  size: "xs",
                  color: "#2563EB",
                  wrap: true,
                  margin: "xs",
                },
              ]
            : []),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "md",
        contents: footerButtons,
      },
    };
  });

  return [
    {
      type: "flex",
      altText: `ประวัติคำสั่งซื้อของคุณ (${orders.length} รายการ) — ${shopInfo.name}`,
      quickReply: buildMainQuickReply(),
      contents: {
        type: "carousel",
        contents: bubbles,
      },
    },
  ];
}

export function buildOrderSummaryForCustomerFlex(order: Order): unknown[] {
  const grandTotal = order.totalPrice + order.shippingCost;
  const itemText = order.items
    .map((it) => `• ${it.productName} x${it.qty}`)
    .join("\n");

  return [
    {
      type: "flex",
      altText: `บันทึกออเดอร์ ${order.id} สำเร็จ (฿${grandTotal.toLocaleString()})`,
      quickReply: buildMainQuickReply(),
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#1B4D31",
          contents: [
            {
              type: "text",
              text: "🍈 บันทึกคำสั่งจองสำเร็จ (Pre-order)",
              color: "#FDE047",
              weight: "bold",
              size: "md",
            },
            {
              type: "text",
              text: `รหัสออเดอร์: #${order.id}`,
              color: "#FFFFFF",
              size: "xs",
              margin: "xs",
            },
            {
              type: "text",
              text: `สถานะ: 🟡 ${order.orderStatus || "สั่งจอง (รอชั่งน้ำหนัก)"}`,
              color: "#FEF08A",
              size: "xs",
              weight: "bold",
              margin: "xs",
            },
          ],
        },
        body: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "text", text: `ผู้รับ: ${order.customerName} (${order.phone})`, size: "xs", wrap: true },
            { type: "text", text: itemText, size: "xs", weight: "bold", wrap: true },
            { type: "text", text: `ความสุก: ${order.ripenessPref || "-"}`, size: "xs", color: "#B45309", wrap: true },
            { type: "text", text: `ขนส่ง: ${order.shippingMethod} (฿${order.shippingCost})`, size: "xs", color: "#57534E", wrap: true },
            { type: "separator", margin: "sm" },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "ยอดโอนสุทธิ", size: "sm", weight: "bold" },
                {
                  type: "text",
                  text: `฿${grandTotal.toLocaleString()}`,
                  size: "md",
                  weight: "bold",
                  color: "#15803D",
                  align: "end",
                },
              ],
            },
            {
              type: "box",
              layout: "vertical",
              backgroundColor: "#FFFBEB",
              cornerRadius: "md",
              paddingAll: "md",
              margin: "sm",
              contents: [
                {
                  type: "text",
                  text: `PromptPay: ${shopInfo.bankAccount.promptPay}`,
                  size: "xs",
                  weight: "bold",
                  color: "#78350F",
                },
                {
                  type: "text",
                  text: `${shopInfo.bankAccount.bank}: ${shopInfo.bankAccount.number}`,
                  size: "xs",
                  color: "#78350F",
                  wrap: true,
                },
                {
                  type: "text",
                  text: "โอนแล้วส่งรูปสลิปในแชทนี้ได้เลยครับ",
                  size: "xxs",
                  color: "#92400E",
                  margin: "xs",
                },
              ],
            },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            {
              type: "button",
              style: "primary",
              color: "#15803D",
              height: "sm",
              action: {
                type: "postback",
                label: "📸 แนบสลิปโอนเงิน (แจ้งชำระ)",
                data: `action=attach_slip&orderId=${order.id}`,
                displayText: `แนบสลิปออเดอร์ #${order.id}`,
              },
            },
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: {
                type: "postback",
                label: "📦 เช็กสถานะการจอง",
                data: `action=track_order&orderId=${order.id}`,
                displayText: `เช็กสถานะ #${order.id}`,
              },
            },
            {
              type: "button",
              style: "link",
              height: "sm",
              action: {
                type: "postback",
                label: "💬 สอบถาม / คุยกับแอดมิน",
                data: `action=open_ticket&orderId=${order.id}`,
                displayText: "คุยกับแอดมิน",
              },
            },
          ],
        },
      },
    },
  ];
}

export function buildClaimReceiptForCustomerFlex(claim: Claim): unknown[] {
  return [
    {
      type: "flex",
      altText: `รับแจ้งเคลม ${claim.claimId} เรียบร้อย`,
      quickReply: buildMainQuickReply(),
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#991B1B",
          contents: [
            {
              type: "text",
              text: "รับคำร้องแจ้งเคลมแล้ว",
              color: "#FEF08A",
              weight: "bold",
              size: "md",
            },
            {
              type: "text",
              text: `รหัสเคลม: ${claim.claimId}`,
              color: "#FFFFFF",
              size: "xs",
            },
          ],
        },
        body: {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            { type: "text", text: `ออเดอร์อ้างอิง: ${claim.orderId}`, size: "xs", weight: "bold" },
            { type: "text", text: `สาเหตุ: ${claim.reason}`, size: "xs", wrap: true },
            { type: "text", text: `รายละเอียด: ${claim.description || "-"}`, size: "xs", color: "#57534E", wrap: true },
            {
              type: "text",
              text: "ทีมงานจะตรวจสอบและติดต่อกลับภายใน 2 ชม. ครับ (โทร 082-282-4238)",
              size: "xs",
              color: "#1B4D31",
              wrap: true,
              margin: "sm",
            },
          ],
        },
      },
    },
  ];
}

export function buildPromptPayQrPaymentFlex(params: {
  productName: string;
  qty: number;
  ripenessPref: string;
  shippingMethod: string;
  customerName: string;
  phone: string;
  totalPrice: number;
  shippingCost: number;
  grandTotal: number;
  publicBaseUrl?: string;
  orderId?: string;
  pricePerKg?: number;
  approxWeight?: string;
}): unknown[] {
  const baseUrl =
    params.publicBaseUrl && params.publicBaseUrl.startsWith("https://")
      ? params.publicBaseUrl.replace(/\/+$/, "")
      : "https://durianwinkin.vercel.app";
  const qrUrl = `${baseUrl}/api/promptpay-qr?amount=${encodeURIComponent(String(params.grandTotal))}`;

  const bubble: Record<string, unknown> = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#1B4D31",
      contents: [
        {
          type: "text",
          text: "🍈 สั่งจองทุเรียนสำเร็จ! (Pre-order)",
          color: "#FDE047",
          weight: "bold",
          size: "md",
        },
        {
          type: "text",
          text: params.orderId
            ? `รหัสคำสั่งซื้อ: #${params.orderId} • สถานะ: 🟡 สั่งจอง`
            : `ยอดโอนสุทธิ ฿${params.grandTotal.toLocaleString()} (PromptPay)`,
          color: "#FFFFFF",
          size: "xs",
          margin: "xs",
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      contents: [
        {
          type: "text",
          text: `${params.productName} x${params.qty} ลูก`,
          weight: "bold",
          size: "sm",
          wrap: true,
          color: "#111827",
        },
        {
          type: "text",
          text: `ผู้รับ: ${params.customerName} (${params.phone})`,
          size: "xs",
          color: "#4B5563",
          wrap: true,
        },
        {
          type: "text",
          text: `ความสุก: ${params.ripenessPref} • ${params.shippingMethod}`,
          size: "xs",
          color: "#059669",
          weight: "bold",
          wrap: true,
        },
        ...(params.pricePerKg
          ? [
              {
                type: "box",
                layout: "vertical",
                margin: "xs",
                contents: [
                  {
                    type: "text",
                    text: `💰 ราคา: ฿${params.pricePerKg.toLocaleString()} / กก. (นน.ประมาณ ${params.approxWeight || "4.0 กก."}/ลูก)`,
                    size: "xs",
                    color: "#B45309",
                    weight: "bold",
                  },
                ],
              },
            ]
          : []),
        { type: "separator", margin: "sm" },
        {
          type: "box",
          layout: "horizontal",
          margin: "xs",
          contents: [
            { type: "text", text: "ค่าสินค้าประมาณการ:", size: "xs", color: "#6B7280", flex: 6 },
            { type: "text", text: `฿${params.totalPrice.toLocaleString()}`, size: "xs", color: "#111827", align: "end", flex: 4 },
          ],
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "ค่าจัดส่ง:", size: "xs", color: "#6B7280", flex: 6 },
            { type: "text", text: params.shippingCost === 0 ? "ฟรี" : `฿${params.shippingCost.toLocaleString()}`, size: "xs", color: "#111827", align: "end", flex: 4 },
          ],
        },
        {
          type: "box",
          layout: "horizontal",
          margin: "xs",
          contents: [
            { type: "text", text: "ยอดประมาณการสุทธิ:", size: "sm", weight: "bold", color: "#166534", flex: 6 },
            { type: "text", text: `฿${params.grandTotal.toLocaleString()}`, size: "md", weight: "bold", color: "#B45309", align: "end", flex: 4 },
          ],
        },
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#FEF3C7",
          borderColor: "#FDE68A",
          borderWidth: "1px",
          cornerRadius: "md",
          paddingAll: "sm",
          margin: "sm",
          contents: [
            {
              type: "text",
              text: "📌 สถานะ: 🟡 สั่งจองสำเร็จ (รอชั่งน้ำหนักจริง)",
              size: "xs",
              color: "#92400E",
              weight: "bold",
            },
            {
              type: "text",
              text: "*แอดมินจะคัดทุเรียนแก่จัด ชั่งน้ำหนักจริง และส่งบิลยอดชำระที่แน่นอนให้คุณทางแชทนี้ครับ (หรือสามารถสแกน QR โอนยอดประมาณการล่วงหน้าได้เลยครับ)",
              size: "xxs",
              color: "#B45309",
              wrap: true,
              margin: "xs",
            },
          ],
        },
        { type: "separator", margin: "sm" },
        {
          type: "text",
          text: `พร้อมเพย์: ${shopInfo.bankAccount.promptPay}`,
          size: "xs",
          weight: "bold",
          color: "#1B4D31",
          margin: "sm",
        },
        {
          type: "text",
          text: `${shopInfo.bankAccount.bank}: ${shopInfo.bankAccount.number} (${shopInfo.bankAccount.name})`,
          size: "xs",
          color: "#44403C",
          wrap: true,
        },
        {
          type: "text",
          text: "📸 สแกน QR แล้วส่งรูปสลิปเข้ามาในแชทนี้ได้เลยครับ ระบบจะออกใบสรุปยอดให้ทันที 🍈✨",
          size: "xs",
          weight: "bold",
          color: "#B45309",
          wrap: true,
          margin: "sm",
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#15803D",
          height: "sm",
          action: {
            type: "postback",
            label: "📸 แนบสลิปโอนเงิน (แจ้งชำระ)",
            data: `action=attach_slip&orderId=${params.orderId || ""}`,
            displayText: params.orderId ? `แนบสลิปออเดอร์ #${params.orderId}` : "ส่งรูปสลิปโอนเงิน",
          },
        },
        {
          type: "button",
          style: "secondary",
          height: "sm",
          action: {
            type: "postback",
            label: "📦 เช็กสถานะการจอง",
            data: `action=track_order&orderId=${params.orderId || ""}`,
            displayText: params.orderId ? `เช็กสถานะ #${params.orderId}` : "เช็กสถานะออเดอร์",
          },
        },
        {
          type: "button",
          style: "link",
          height: "sm",
          action: {
            type: "postback",
            label: "💬 สอบถาม / คุยกับแอดมิน (เปิด Ticket)",
            data: `action=open_ticket&orderId=${params.orderId || ""}`,
            displayText: "คุยกับแอดมิน",
          },
        },
      ],
    },
  };

  if (qrUrl) {
    bubble.hero = {
      type: "image",
      url: qrUrl,
      size: "lg",
      aspectRatio: "1:1",
      aspectMode: "fit",
      backgroundColor: "#FFFFFF",
    };
  }

  return [
    {
      type: "flex",
      altText: `🍈 สั่งจองทุเรียนสำเร็จ #${params.orderId || ""} (฿${params.grandTotal.toLocaleString()})`,
      quickReply: {
        items: [
          {
            type: "action",
            action: {
              type: "postback",
              label: "📸 แนบสลิปโอนเงิน",
              data: `action=attach_slip&orderId=${params.orderId || ""}`,
              displayText: "แนบสลิปโอนเงิน",
            },
          },
          {
            type: "action",
            action: {
              type: "postback",
              label: "📦 เช็กสถานะการจอง",
              data: `action=track_order&orderId=${params.orderId || ""}`,
              displayText: "เช็กสถานะออเดอร์",
            },
          },
          {
            type: "action",
            action: {
              type: "postback",
              label: "💬 คุยกับแอดมิน",
              data: `action=open_ticket&orderId=${params.orderId || ""}`,
              displayText: "คุยกับแอดมิน",
            },
          },
          {
            type: "action",
            action: { type: "message", label: "ยกเลิก", text: "ยกเลิก" },
          },
        ],
      },
      contents: bubble,
    },
  ];
}

export function buildPromotionsCarouselFlex(promotions: Promotion[]): unknown[] {
  const active = promotions.filter((p) => p.isActive).slice(0, 10);
  if (active.length === 0) {
    return [
      {
        type: "text",
        text: "ขณะนี้ยังไม่มีโปรโมชั่นเพิ่มเติม กดดูสต็อกและสั่งซื้อรอบนี้ได้เลยครับ!",
        quickReply: buildMainQuickReply(),
      },
    ];
  }

  const bubbles = active.map((pr) => ({
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#B45309",
      contents: [
        {
          type: "text",
          text: pr.badge || "โปรโมชั่นพิเศษ",
          color: "#FEF08A",
          size: "xxs",
          weight: "bold",
        },
        {
          type: "text",
          text: pr.title,
          color: "#FFFFFF",
          size: "sm",
          weight: "bold",
          wrap: true,
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
          text: pr.discountText,
          size: "sm",
          weight: "bold",
          color: "#1B4D31",
          wrap: true,
        },
        {
          type: "text",
          text: pr.conditionText,
          size: "xs",
          color: "#57534E",
          wrap: true,
        },
        ...(pr.promoCode
          ? [
              {
                type: "text",
                text: `รหัสโปร: ${pr.promoCode}`,
                size: "xs",
                weight: "bold",
                color: "#B45309",
              },
            ]
          : []),
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#1B4D31",
          height: "sm",
          action: {
            type: "message",
            label: "สั่งซื้อใช้สิทธิ์เลย",
            text: "สั่งซื้อ",
          },
        },
      ],
    },
  }));

  return [
    {
      type: "flex",
      altText: `โปรโมชั่นร้าน ${shopInfo.name}`,
      quickReply: buildMainQuickReply(),
      contents: {
        type: "carousel",
        contents: bubbles,
      },
    },
  ];
}

export function buildLiveStreamFlex(cfg: RuntimeConfig): unknown[] {
  const hasUrl = Boolean(cfg.liveStreamUrl && cfg.liveStreamUrl.startsWith("https://"));
  const platform = cfg.liveStreamPlatform || "กำลังเลือกแพลตฟอร์มไลฟ์สด";
  const note =
    cfg.liveStreamNote ||
    "กำลังเตรียมไลฟ์สดคัดทุเรียนหน้าสวน ตัดสด-แกะเนื้อให้ชมกันแบบเรียลไทม์ครับ";

  const footerContents: unknown[] = [];
  if (hasUrl && cfg.liveStreamUrl) {
    footerContents.push({
      type: "button",
      style: "primary",
      color: "#DC2626",
      height: "sm",
      action: {
        type: "uri",
        label: cfg.isLiveNow ? "🔴 ชมไลฟ์สดตอนนี้" : "เปิดชมช่องไลฟ์สด",
        uri: cfg.liveStreamUrl,
      },
    });
  }
  footerContents.push({
    type: "button",
    style: hasUrl ? "secondary" : "primary",
    color: hasUrl ? undefined : "#1B4D31",
    height: "sm",
    action: {
      type: "message",
      label: "เช็กสต็อกทุเรียน",
      text: "เช็กสต็อก",
    },
  });

  return [
    {
      type: "flex",
      altText: `ไลฟ์สดร้าน ${shopInfo.name}`,
      quickReply: buildMainQuickReply(),
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: cfg.isLiveNow ? "#991B1B" : "#11301F",
          contents: [
            {
              type: "text",
              text: cfg.isLiveNow ? "🔴 LIVE NOW — กำลังไลฟ์สด!" : "📺 ช่องทางไลฟ์สดทุเรียนวินคิน",
              color: "#FDE047",
              weight: "bold",
              size: "sm",
            },
            {
              type: "text",
              text: platform,
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
              text: note,
              size: "xs",
              color: "#44403C",
              wrap: true,
            },
            ...(!hasUrl
              ? [
                  {
                    type: "text",
                    text: "แอดมินกำลังเตรียมช่องทางไลฟ์สด (TikTok / Facebook Live) เมื่อเริ่มไลฟ์จะส่งลิงก์แจ้งเตือนเข้าแชทให้ทันทีครับ",
                    size: "xxs",
                    color: "#78716C",
                    wrap: true,
                  },
                ]
              : []),
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: footerContents,
        },
      },
    },
  ];
}

export function buildMoreMenuFlex(
  publicBaseUrl?: string,
  round?: Round
): unknown[] {
  const baseUrl =
    publicBaseUrl && publicBaseUrl.startsWith("https://")
      ? publicBaseUrl.replace(/\/+$/, "")
      : "";

  const buttons: unknown[] = [
    {
      type: "button",
      style: "primary",
      color: "#1B4D31",
      height: "sm",
      action: {
        type: "postback",
        label: "📋 ประวัติคำสั่งซื้อของฉัน",
        data: "action=my_orders",
        displayText: "ประวัติคำสั่งซื้อ",
      },
    },
    {
      type: "button",
      style: "secondary",
      height: "sm",
      action: {
        type: "postback",
        label: "📦 เช็กสถานะพัสดุ",
        data: "action=status",
        displayText: "เช็กสถานะพัสดุ",
      },
    },
  ];

  if (baseUrl) {
    buttons.push(
      {
        type: "button",
        style: "secondary",
        height: "sm",
        action: {
          type: "uri",
          label: "🌐 เข้าชมหน้าร้าน",
          uri: `${baseUrl}/`,
        },
      },
      {
        type: "button",
        style: "secondary",
        height: "sm",
        action: {
          type: "uri",
          label: "🚚 เช็กเลขพัสดุ",
          uri: `${baseUrl}/tracking`,
        },
      },
      {
        type: "button",
        style: "secondary",
        height: "sm",
        action: {
          type: "uri",
          label: "🛡️ แจ้งเคลมสินค้า",
          uri: `${baseUrl}/claim`,
        },
      }
    );
  }

  buttons.push({
    type: "button",
    style: "secondary",
    height: "sm",
    action: {
      type: "uri",
      label: "📞 โทรติดต่อร้าน",
      uri: `tel:${shopInfo.phone.replace(/-/g, "")}`,
    },
  });

  return [
    {
      type: "flex",
      altText: `เมนูเพิ่มเติม — ${shopInfo.name}`,
      quickReply: buildMainQuickReply(),
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#11301F",
          contents: [
            {
              type: "text",
              text: `บริการทั้งหมด • ${shopInfo.name}`,
              color: "#FDE047",
              weight: "bold",
              size: "md",
            },
            {
              type: "text",
              text: round
                ? `รอบส่ง: ${round.deliveryDate}`
                : "คัดสดจากสวน ส่งตรงถึงบ้านคุณ",
              color: "#D6D3D1",
              size: "xs",
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
              text: "เลือกรายการที่ต้องการด้านล่าง (เช็กพัสดุ Flash / SCG / KEX / J&T / ไปรษณีย์ไทย หรือเปิดหน้าเว็บไซต์):",
              size: "xs",
              color: "#57534E",
              wrap: true,
            },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: buttons,
        },
      },
    },
  ];
}
