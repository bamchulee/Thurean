// การ์ดแจ้งเตือนกลุ่มแอดมิน: ออเดอร์ใหม่ สลิป เคลม ตั๋ว
import type { Claim, Order } from "../../types/durian";
import { slipAccountText, slipAmountText, slipCheckText } from "../slip-check";
import { signedSlipUrl } from "../slip-link";

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

// ------------------------------------------------------------
// การ์ดออเดอร์ของกลุ่มแอดมิน — หน้าตาเดียวกันทุกเหตุการณ์
//   หัวสี (ตามเหตุการณ์)  →  หัวข้อใหญ่ + เลขออเดอร์ + เวลา
//   ตัวการ์ด              →  ลูกค้า / รายการ / ยอด / ข้อมูลเฉพาะเหตุการณ์
//   ท้ายการ์ด             →  ปุ่มเปิดออเดอร์ + แชทลูกค้า
// ------------------------------------------------------------

export type AdminOrderEvent =
  | "new"
  | "weighed"
  | "slip"
  | "paid"
  | "slip_rejected"
  | "shipped"
  | "delivered"
  | "cancelled";

const EVENT_STYLE: Record<AdminOrderEvent, { title: string; color: string; accent: string; button: string }> = {
  new: { title: "🍈 ออเดอร์ใหม่ — รอชั่ง", color: "#14532D", accent: "#FDE047", button: "⚖️ เปิดเพื่อชั่ง" },
  weighed: { title: "⚖️ ชั่งแล้ว — ส่งยอดให้ลูกค้า", color: "#92400E", accent: "#FEF3C7", button: "📋 เปิดออเดอร์" },
  slip: { title: "🧾 ลูกค้าส่งสลิป — รอตรวจ", color: "#1E3A8A", accent: "#FDE047", button: "🔍 เปิดตรวจสลิป" },
  paid: { title: "✅ ชำระเงินแล้ว — เตรียมส่ง", color: "#047857", accent: "#D1FAE5", button: "📦 เปิดเพื่อจัดส่ง" },
  slip_rejected: { title: "↩️ ตีกลับสลิป — รอโอนใหม่", color: "#9F1239", accent: "#FFE4E6", button: "📋 เปิดออเดอร์" },
  shipped: { title: "🚚 ออกจัดส่งแล้ว", color: "#3730A3", accent: "#E0E7FF", button: "📋 เปิดออเดอร์" },
  delivered: { title: "🎉 ส่งถึงลูกค้าแล้ว", color: "#0F766E", accent: "#CCFBF1", button: "📋 เปิดออเดอร์" },
  cancelled: { title: "⛔ ยกเลิกออเดอร์", color: "#991B1B", accent: "#FEE2E2", button: "📋 เปิดออเดอร์" },
};

const money = (n: number) => `฿${(Math.round((n || 0) * 100) / 100).toLocaleString()}`;

function bangkokTime(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** แถว "หัวข้อ ........ ค่า" */
function row(label: string, value: string, opts: { bold?: boolean; color?: string; size?: string } = {}) {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    contents: [
      { type: "text", text: label, size: "xs", color: "#6B7280", flex: 3 },
      { type: "text", text: value || "-", size: opts.size || "xs", color: opts.color || "#111827", weight: opts.bold ? "bold" : "regular", flex: 7, wrap: true, align: "end" },
    ],
  };
}

const sep = { type: "separator", margin: "md", color: "#E5E7EB" };

function itemsBlock(order: Order) {
  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    margin: "md",
    contents: order.items.map((it) => {
      const kgs = (it.fruitKgs || []).filter((k) => Number(k) > 0);
      const kg = kgs.length ? kgs.reduce((s, k) => s + Number(k), 0) : Number(it.actualWeightKg || 0);
      const perKg = it.pricePerKg || it.price || 0;
      // ราคา: เหมา / ชั่งแล้ว / ยังไม่ชั่ง
      const priceText = it.lineTotal ? money(it.lineTotal) : kg > 0 ? money(kg * perKg) : `${money(perKg)}/กก.`;
      const detail = it.lineTotal
        ? "ราคาเหมา"
        : kgs.length
          ? `${kgs.join(" + ")} = ${Math.round(kg * 100) / 100} กก.`
          : kg > 0
            ? `รวม ${Math.round(kg * 100) / 100} กก. × ${money(perKg)}`
            : "รอชั่งน้ำหนัก";
      return {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: `${it.productName} × ${it.qty}`, size: "sm", weight: "bold", color: "#111827", flex: 7, wrap: true },
              { type: "text", text: priceText, size: "sm", color: "#111827", flex: 4, align: "end" },
            ],
          },
          {
            type: "text",
            text: [detail, (it as { ripenessPref?: string }).ripenessPref].filter(Boolean).join(" · "),
            size: "xxs",
            color: "#6B7280",
            wrap: true,
          },
        ],
      };
    }),
  };
}

/** สรุปยอด: ก่อนชั่งบอกราคา/กก. หลังชั่งบอกยอดสุทธิ */
function totalBlock(order: Order) {
  const weighed = (order.totalPrice || 0) > 0;
  const grand = (order.totalPrice || 0) + (order.shippingCost || 0);
  return {
    type: "box",
    layout: "vertical",
    margin: "md",
    spacing: "xs",
    contents: [
      row("ค่าส่ง", `${money(order.shippingCost || 0)} · ${order.shippingMethod || "-"}`),
      weighed
        ? row("ยอดสุทธิ", money(grand), { bold: true, color: "#B91C1C", size: "md" })
        : row("ยอดสุทธิ", "รอชั่งน้ำหนัก", { bold: true, color: "#B45309" }),
    ],
  };
}

function actorText(actor?: string): string {
  if (!actor) return "";
  if (actor === "customer-line") return "ลูกค้ากดยืนยันใน LINE";
  if (actor === "line-webhook" || actor === "customer") return "ลูกค้า";
  return actor;
}

export interface AdminOrderCardExtra {
  /** ใครทำ (ชื่อแอดมิน / ลูกค้า) */
  actor?: string;
  /** แถวเพิ่มเติมเฉพาะเหตุการณ์ */
  rows?: [string, string][];
  /** ข้อความเตือนสีแดง/เขียว ใต้หัวการ์ด */
  note?: { text: string; tone: "ok" | "warn" | "bad" };
  /** รูปสลิป (เต็ม URL) */
  slipUrl?: string;
}

export function buildAdminOrderCard(event: AdminOrderEvent, order: Order, links: AdminAlertLinks, extra: AdminOrderCardExtra = {}): unknown[] {
  const st = EVENT_STYLE[event];
  const noteColor = { ok: "#15803D", warn: "#B45309", bad: "#B91C1C" };
  const body: unknown[] = [
    ...(extra.note
      ? [
          {
            type: "box",
            layout: "vertical",
            backgroundColor: extra.note.tone === "ok" ? "#F0FDF4" : extra.note.tone === "bad" ? "#FEF2F2" : "#FFFBEB",
            cornerRadius: "md",
            paddingAll: "sm",
            contents: [{ type: "text", text: extra.note.text, size: "xs", wrap: true, color: noteColor[extra.note.tone], weight: "bold" }],
          },
        ]
      : []),
    {
      type: "box",
      layout: "vertical",
      margin: extra.note ? "md" : "none",
      spacing: "xs",
      contents: [
        { type: "text", text: `👤 ${order.customerName || "ลูกค้า"}`, size: "md", weight: "bold", color: "#111827", wrap: true },
        { type: "text", text: `📞 ${order.phone || "-"}`, size: "xs", color: "#4B5563" },
        ...(order.address && (event === "new" || event === "paid" || event === "shipped")
          ? [{ type: "text", text: `📍 ${order.address}`, size: "xs", color: "#6B7280", wrap: true, maxLines: 3 }]
          : []),
      ],
    },
    sep,
    itemsBlock(order),
    sep,
    totalBlock(order),
    ...((extra.rows || []).length ? [sep, { type: "box", layout: "vertical", margin: "md", spacing: "xs", contents: extra.rows!.map(([k, v]) => row(k, v)) }] : []),
    ...(extra.actor ? [{ type: "text", text: `โดย ${actorText(extra.actor)}`, size: "xxs", color: "#9CA3AF", margin: "md", align: "end" }] : []),
  ];

  const grand = (order.totalPrice || 0) + (order.shippingCost || 0);
  const altAmount = grand > 0 && order.totalPrice > 0 ? ` ${money(grand)}` : "";
  return [
    {
      type: "flex",
      altText: `${st.title} #${order.id} — ${order.customerName || "ลูกค้า"}${altAmount}`,
      contents: {
        type: "bubble",
        size: "kilo",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: st.color,
          paddingAll: "lg",
          contents: [
            { type: "text", text: st.title, color: st.accent, weight: "bold", size: "md", wrap: true },
            {
              type: "box",
              layout: "horizontal",
              margin: "sm",
              contents: [
                { type: "text", text: `#${order.id}`, color: "#FFFFFF", weight: "bold", size: "lg", flex: 6 },
                { type: "text", text: bangkokTime(), color: "#D1FAE5", size: "xxs", align: "end", gravity: "center", flex: 4 },
              ],
            },
          ],
        },
        ...(extra.slipUrl
          ? { hero: { type: "image", url: extra.slipUrl, size: "full", aspectRatio: "3:4", aspectMode: "cover", action: { type: "uri", label: "ดูสลิป", uri: extra.slipUrl } } }
          : {}),
        body: { type: "box", layout: "vertical", paddingAll: "lg", contents: body },
        footer: adminAlertFooter(links, st.button),
        styles: { footer: { separator: true } },
      },
    },
  ];
}

export function buildOrderAlertForAdmin(order: Order, links: AdminAlertLinks): unknown[] {
  return buildAdminOrderCard("new", order, links, {
    rows: [
      ["ช่องทาง", order.channel || "-"],
      ...(order.notes ? ([["หมายเหตุ", order.notes]] as [string, string][]) : []),
    ],
  });
}

export function buildSlipAlertForAdmin(order: Order, links: AdminAlertLinks, slipUrl?: string, aiNote?: string): unknown[] {
  const base = links.orderUrl.replace(/\/admin\/orders\/.*$/, "");
  // รูปสลิปเปิดได้เฉพาะลิงก์ที่มีลายเซ็น (LINE ดึงรูปไปแสดงในการ์ด)
  const fullSlipUrl = slipUrl ? signedSlipUrl(slipUrl.startsWith("http") ? slipUrl : `${base}${slipUrl}`) : undefined;
  const qr = slipCheckText(order.slipCheck);
  const checks = [qr.label, slipAmountText(order), slipAccountText(order.slipAccountCheck)].filter(Boolean);
  const bad = qr.tone === "bad" || order.slipAmountCheck === "mismatch" || order.slipAccountCheck === "mismatch";
  const ok = qr.tone === "ok" && order.slipAmountCheck === "match" && order.slipAccountCheck !== "mismatch";
  return buildAdminOrderCard("slip", order, links, {
    note: {
      text: [...checks, ...(aiNote ? [aiNote] : [])].join("\n"),
      tone: bad || (aiNote && /⚠️/.test(aiNote)) ? "bad" : ok ? "ok" : "warn",
    },
    rows: [
      ...(order.slipBank ? ([["โอนจาก", order.slipBank]] as [string, string][]) : []),
      ...(order.slipRef ? ([["เลขรายการ", order.slipRef]] as [string, string][]) : []),
    ],
    slipUrl: fullSlipUrl && /^https:\/\//.test(fullSlipUrl) ? fullSlipUrl : undefined,
  });
}

/** อัปเดตสถานะออเดอร์ → แจ้งกลุ่มแอดมิน */
export function buildOrderUpdateAlertForAdmin(
  event: Exclude<AdminOrderEvent, "new" | "slip">,
  order: Order,
  links: AdminAlertLinks,
  opts: { actor?: string; reason?: string } = {}
): unknown[] {
  const rows: [string, string][] = [];
  let note: AdminOrderCardExtra["note"];
  if (event === "shipped") {
    rows.push(["ขนส่ง", order.courier || "-"]);
    if (order.trackingNo) rows.push(["เลขพัสดุ", order.trackingNo]);
  }
  if (event === "cancelled") {
    note = { text: `เหตุผล: ${order.cancelReason || opts.reason || "-"}${order.paymentStatus === "refunded" ? "\n💸 ลูกค้าโอนแล้ว — ต้องโอนเงินคืน" : ""}`, tone: "bad" };
  }
  if (event === "slip_rejected") note = { text: `เหตุผล: ${opts.reason || "สลิปไม่ถูกต้อง"}\nแจ้งลูกค้าให้โอน/ส่งสลิปใหม่แล้ว`, tone: "bad" };
  if (event === "weighed") note = { text: "ส่งยอดพร้อม QR ให้ลูกค้าทาง LINE แล้ว — รอลูกค้าโอน", tone: "warn" };
  if (event === "paid") note = { text: "ยืนยันยอดแล้ว — แพ็กของแล้วกด \"จัดส่ง\" ในหน้าออเดอร์", tone: "ok" };
  if (event === "delivered") {
    note = {
      text: opts.actor === "customer-line" ? "📦 ลูกค้ากดยืนยันได้รับของแล้ว — ปิดงาน 🙏" : "ส่งถึงลูกค้าแล้ว — ปิดงาน 🙏",
      tone: "ok",
    };
  }
  return buildAdminOrderCard(event, order, links, { actor: opts.actor, rows, note });
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
                label: "📞 โทรหาลูกค้า",
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
                label: "💬 แชทตอบลูกค้า",
                uri: "https://chat.line.biz/",
              },
            },
            // ลูกค้าคุยสั่งของในแชท → แอดมินกดสร้างออเดอร์ให้ (เติมชื่อ/ที่อยู่ลูกค้าคนนี้ให้เอง)
            ...(ticket.lineUserId
              ? [
                  {
                    type: "button",
                    style: "primary",
                    color: "#B45309",
                    height: "sm",
                    action: {
                      type: "uri",
                      label: "🧾 สร้างออเดอร์ให้",
                      uri: `${baseUrl.replace(/\/+$/, "")}/admin?tab=orders&chatOrder=${encodeURIComponent(ticket.lineUserId)}`,
                    },
                  },
                ]
              : []),
            ...(ticket.orderId
              ? [
                  {
                    type: "button",
                    style: "secondary",
                    height: "sm",
                    action: {
                      type: "uri",
                      label: "📦 เปิดออเดอร์",
                      uri: adminOrderUrl(ticket.orderId, baseUrl),
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
                      label: "📞 โทรหาลูกค้า",
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

/** ลูกค้าพิมพ์คุยต่อในแชท (หลังส่งเรื่องให้แอดมินแล้ว) — การ์ดเล็ก มีปุ่มสร้างออเดอร์ให้ลูกค้าคนนี้ */
export function buildChatMessageAlertForAdmin(
  msg: { customerName: string; phone?: string; lineUserId: string; message: string },
  publicBaseUrl?: string
): unknown[] {
  const base = (publicBaseUrl || "https://durianwinkin.vercel.app").replace(/\/+$/, "");
  return [
    {
      type: "flex",
      altText: `💬 ${msg.customerName}: ${msg.message.slice(0, 60)}`,
      contents: {
        type: "bubble",
        size: "kilo",
        body: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          paddingAll: "lg",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: `💬 ${msg.customerName}`, weight: "bold", size: "sm", color: "#111827", flex: 7, wrap: true },
                { type: "text", text: "พิมพ์เพิ่ม", size: "xxs", color: "#0369A1", align: "end", gravity: "center", flex: 3 },
              ],
            },
            ...(msg.phone ? [{ type: "text", text: `📞 ${msg.phone}`, size: "xxs", color: "#6B7280" }] : []),
            {
              type: "box",
              layout: "vertical",
              backgroundColor: "#F0F9FF",
              cornerRadius: "md",
              paddingAll: "md",
              contents: [{ type: "text", text: msg.message, size: "sm", color: "#0F172A", wrap: true }],
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
              color: "#B45309",
              height: "sm",
              action: { type: "uri", label: "🧾 สร้างออเดอร์ให้", uri: `${base}/admin?tab=orders&chatOrder=${encodeURIComponent(msg.lineUserId)}` },
            },
            { type: "button", style: "secondary", height: "sm", action: { type: "uri", label: "💬 แชทตอบ", uri: "https://chat.line.biz/" } },
          ],
        },
      },
    },
  ];
}
