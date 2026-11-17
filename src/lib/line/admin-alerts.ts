// การ์ดแจ้งเตือนกลุ่มแอดมิน: ออเดอร์ใหม่ สลิป เคลม ตั๋ว
import type { Claim, Order } from "../../types/durian";
import { slipAccountText, slipAmountText, slipCheckText } from "../slip-check";

/** ลิงก์ในการ์ดแจ้งเตือนกลุ่มแอดมิน — กลุ่มมีแค่การแจ้งเตือน งานทุกอย่างทำในหน้าออเดอร์บนเว็บ */
export interface AdminAlertLinks {
  /** หน้าออเดอร์เดี่ยวในหลังบ้าน (ต้องล็อกอินแอดมิน) */
  orderUrl: string;
  /** ห้องแชทลูกค้าใน LINE OA Manager (มีเฉพาะลูกค้าที่สั่งผ่าน LINE) */
  chatUrl?: string;
}

export function adminOrderUrl(orderId: string, publicBaseUrl?: string): string {
  const base = (publicBaseUrl || "https://durianwinkin.vercel.app").replace(/\/+$/, "");
  return `${base}/admin/orders/${encodeURIComponent(orderId)}`;
}

function adminAlertFooter(links: AdminAlertLinks, primaryLabel: string): Record<string, unknown> {
  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    contents: [
      {
        type: "button",
        style: "primary",
        color: "#15803D",
        height: "sm",
        action: { type: "uri", label: primaryLabel, uri: links.orderUrl },
      },
      ...(links.chatUrl
        ? [
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "uri", label: "💬 แชทลูกค้า", uri: links.chatUrl },
            },
          ]
        : []),
    ],
  };
}

export function buildOrderAlertForAdmin(order: Order, links: AdminAlertLinks): unknown[] {
  const itemLines = order.items
    .map((it) => `• ${it.productName} x${it.qty} — ฿${(it.pricePerKg || it.price).toLocaleString()}/กก.`)
    .join("\n");

  return [
    {
      type: "flex",
      altText: `🍈 ออเดอร์ใหม่ #${order.id} — ${order.customerName} (รอชั่ง)`,
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#14532d",
          paddingAll: "lg",
          contents: [
            { type: "text", text: "🍈 ออเดอร์ใหม่ รอชั่งน้ำหนัก", color: "#fde047", weight: "bold", size: "md" },
            { type: "text", text: `#${order.id}`, color: "#ffffff", size: "sm", margin: "xs", weight: "bold" },
          ],
        },
        body: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "text", text: `👤 ${order.customerName}`, weight: "bold", size: "sm", color: "#111827", wrap: true },
            { type: "text", text: `📞 ${order.phone}`, size: "xs", color: "#4b5563" },
            ...(order.address
              ? [{ type: "text", text: `📍 ${order.address}`, size: "xs", color: "#6b7280", wrap: true }]
              : []),
            { type: "separator", margin: "sm" },
            { type: "text", text: itemLines, wrap: true, size: "xs", margin: "sm" },
            {
              type: "text",
              text: `ความสุก: ${order.ripenessPref || "ตามมาตรฐานร้าน"}`,
              size: "xs",
              color: "#b45309",
              wrap: true,
            },
            { type: "text", text: `🚚 ${order.shippingMethod} (฿${order.shippingCost})`, size: "xs", color: "#4b5563", wrap: true },
          ],
        },
        footer: adminAlertFooter(links, "⚖️ เปิดออเดอร์"),
      },
    },
  ];
}

export function buildSlipAlertForAdmin(order: Order, links: AdminAlertLinks, slipUrl?: string): unknown[] {
  const base = links.orderUrl.replace(/\/admin\/orders\/.*$/, "");
  const grandTotal = order.totalPrice + (order.shippingCost || 0);
  const fullSlipUrl = slipUrl ? (slipUrl.startsWith("http") ? slipUrl : `${base}${slipUrl}`) : undefined;

  return [
    {
      type: "flex",
      altText: `🧾 สลิปโอนเงิน #${order.id} (฿${grandTotal.toLocaleString()}) รอตรวจ`,
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#1E3A8A",
          contents: [
            { type: "text", text: "🧾 ลูกค้าส่งสลิปแล้ว รอตรวจ", color: "#FDE047", weight: "bold", size: "sm" },
            { type: "text", text: `#${order.id}`, color: "#FFFFFF", size: "xs", margin: "xs" },
          ],
        },
        body: {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            { type: "text", text: `👤 ${order.customerName} (${order.phone})`, size: "xs", weight: "bold", wrap: true },
            {
              type: "text",
              text: [
                slipCheckText(order.slipCheck).label,
                slipAmountText(order),
                slipAccountText(order.slipAccountCheck),
                order.slipBank ? `โอนจาก: ${order.slipBank}${order.slipRef ? " · เลขรายการ " + order.slipRef : ""}` : "",
              ]
                .filter(Boolean)
                .join("\n"),
              size: "xs",
              wrap: true,
              color: slipCheckText(order.slipCheck).tone === "ok" ? "#15803D" : slipCheckText(order.slipCheck).tone === "bad" ? "#B91C1C" : "#B45309",
            },
            {
              type: "box",
              layout: "horizontal",
              margin: "xs",
              contents: [
                { type: "text", text: "💰 ยอดที่ต้องได้รับ", size: "xs", color: "#4B5563", flex: 6 },
                {
                  type: "text",
                  text: `฿${grandTotal.toLocaleString()}`,
                  size: "sm",
                  weight: "bold",
                  color: "#15803D",
                  align: "end",
                  flex: 4,
                },
              ],
            },
            ...(fullSlipUrl
              ? [
                  {
                    type: "image",
                    url: fullSlipUrl,
                    size: "full",
                    aspectRatio: "3:4",
                    aspectMode: "fit",
                    margin: "sm",
                  },
                ]
              : []),
          ],
        },
        footer: adminAlertFooter(links, "✅ ตรวจสลิป"),
      },
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
                    text: `เลขออเดอร์ ${ticket.orderId}`,
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
