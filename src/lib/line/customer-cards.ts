// ============================================================
// การ์ดถึงลูกค้าตามขั้นของออเดอร์ — หน้าตาเดียวกันทุกใบ
//   หัวเขียวร้าน: หัวข้อ + เลขออเดอร์
//   แถบความคืบหน้า: จอง → ชั่ง/โอน → ชำระแล้ว → จัดส่ง → ได้รับ (ลูกค้ารู้ทันทีว่าอยู่ขั้นไหน)
//   ตัวการ์ด: รายการ / ยอด / กล่อง "ต้องทำอะไรต่อ"
//   ปุ่มท้ายการ์ด
// ============================================================
import type { Order } from "../../types/durian";
import { shopInfo } from "../../data/shop";
import { getBankAccount } from "../sheets-db";
import { buildMainQuickReply } from "./shared";

const GREEN = "#1B4D31";
const GOLD = "#FDE047";
const money = (n: number) => `฿${(Math.round((n || 0) * 100) / 100).toLocaleString()}`;

const STEPS = ["จอง", "ชั่ง/โอน", "ชำระแล้ว", "จัดส่ง", "ได้รับ"];

/** แถบความคืบหน้า 5 ขั้น — step เริ่มที่ 1 */
function progress(step: number) {
  return {
    type: "box",
    layout: "horizontal",
    margin: "md",
    contents: STEPS.map((label, i) => {
      const n = i + 1;
      const done = n < step;
      const now = n === step;
      return {
        type: "box",
        layout: "vertical",
        flex: 1,
        spacing: "xs",
        contents: [
          {
            type: "box",
            layout: "vertical",
            width: "14px",
            height: "14px",
            cornerRadius: "7px",
            offsetStart: "0px",
            backgroundColor: now ? GOLD : done ? "#86EFAC" : "#4B7A5E",
            borderColor: now ? "#FFFFFF" : GREEN,
            borderWidth: now ? "2px" : "0px",
            contents: [],
          },
          { type: "text", text: label, size: "xxs", color: now ? GOLD : done ? "#D1FAE5" : "#A7C4B5", weight: now ? "bold" : "regular" },
        ],
      };
    }),
  };
}

function header(title: string, order: Order, step: number) {
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: GREEN,
    paddingAll: "lg",
    contents: [
      { type: "text", text: title, color: GOLD, weight: "bold", size: "lg", wrap: true },
      { type: "text", text: `ออเดอร์ #${order.id}`, color: "#FFFFFF", size: "xs", margin: "xs" },
      progress(step),
    ],
  };
}

const sep = { type: "separator", margin: "md", color: "#E5E7EB" };

function row(label: string, value: string, opts: { bold?: boolean; color?: string; size?: string } = {}) {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    contents: [
      { type: "text", text: label, size: "sm", color: "#6B7280", flex: 4, wrap: true },
      { type: "text", text: value, size: opts.size || "sm", color: opts.color || "#111827", weight: opts.bold ? "bold" : "regular", flex: 6, align: "end", wrap: true },
    ],
  };
}

/** รายการสินค้า: ก่อนชั่งบอกราคา/กก. หลังชั่งบอกน้ำหนักและยอดของแต่ละรายการ */
function itemsBox(order: Order) {
  return {
    type: "box",
    layout: "vertical",
    spacing: "sm",
    margin: "md",
    contents: order.items.map((it) => {
      const perKg = it.pricePerKg || it.price || 0;
      const kgs = (it.fruitKgs || []).filter((k) => Number(k) > 0);
      const kg = kgs.length ? kgs.reduce((s, k) => s + Number(k), 0) : Number(it.actualWeightKg || 0);
      const right = it.lineTotal ? money(it.lineTotal) : kg > 0 ? money(Math.round(kg * perKg)) : `${money(perKg)}/กก.`;
      const detail = it.lineTotal
        ? "ราคาเหมา"
        : kgs.length
          ? `${kgs.join(" + ")} = ${Math.round(kg * 100) / 100} กก. × ${money(perKg)}`
          : kg > 0
            ? `${Math.round(kg * 100) / 100} กก. × ${money(perKg)}`
            : "คิดเงินตามน้ำหนักจริงหลังชั่ง";
      return {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: `${it.productName} × ${it.qty}`, size: "sm", weight: "bold", color: "#111827", flex: 7, wrap: true },
              { type: "text", text: right, size: "sm", weight: "bold", color: "#111827", flex: 4, align: "end" },
            ],
          },
          { type: "text", text: detail, size: "xs", color: "#6B7280", wrap: true },
        ],
      };
    }),
  };
}

/** กล่อง "ต้องทำอะไรต่อ" */
function nextStep(title: string, text: string, tone: "wait" | "ok" | "warn" = "wait") {
  const c = { wait: ["#FFFBEB", "#92400E"], ok: ["#F0FDF4", "#166534"], warn: ["#FEF2F2", "#991B1B"] }[tone];
  return {
    type: "box",
    layout: "vertical",
    margin: "md",
    backgroundColor: c[0],
    cornerRadius: "md",
    paddingAll: "md",
    contents: [
      { type: "text", text: title, size: "sm", weight: "bold", color: c[1], wrap: true },
      { type: "text", text, size: "xs", color: c[1], wrap: true, margin: "xs" },
    ],
  };
}

type Button = { label: string; data?: string; uri?: string; display?: string; primary?: boolean };

function footer(buttons: Button[]) {
  return {
    type: "box",
    layout: "vertical",
    spacing: "sm",
    contents: buttons.map((b) => ({
      type: "button",
      style: b.primary ? "primary" : "secondary",
      color: b.primary ? "#15803D" : undefined,
      height: "sm",
      action: b.uri
        ? { type: "uri", label: b.label, uri: b.uri }
        : { type: "postback", label: b.label, data: b.data, ...(b.display ? { displayText: b.display } : {}) },
    })),
  };
}

function card(altText: string, head: unknown, body: unknown[], buttons: Button[]): unknown[] {
  return [
    {
      type: "flex",
      altText,
      quickReply: buildMainQuickReply(),
      contents: {
        type: "bubble",
        header: head,
        body: { type: "box", layout: "vertical", paddingAll: "lg", contents: body },
        footer: footer(buttons),
      },
    },
  ];
}

const trackBtn = (o: Order): Button => ({ label: "📦 เช็กสถานะ", data: `action=track_order&orderId=${o.id}`, display: `เช็กสถานะ #${o.id}` });
const askBtn = (o: Order): Button => ({ label: "💬 คุยกับแอดมิน", data: `action=open_ticket&orderId=${o.id}`, display: "คุยกับแอดมิน" });

// ------------------------------------------------------------
// 1) รับจองแล้ว (ยังไม่ชั่ง ยังไม่ต้องโอน)
// ------------------------------------------------------------
export function buildBookingReceiptFlex(order: Order): unknown[] {
  return card(
    `✅ รับจองแล้ว #${order.id} — รอชั่งน้ำหนัก ยังไม่ต้องโอน`,
    header("✅ รับจองแล้ว", order, 1),
    [
      { type: "text", text: `👤 ${order.customerName} · ${order.phone}`, size: "sm", color: "#374151", wrap: true },
      sep,
      itemsBox(order),
      ...(order.ripenessPref ? [{ type: "text", text: `ความสุก: ${order.ripenessPref}`, size: "xs", color: "#B45309", wrap: true, margin: "sm" }] : []),
      sep,
      { type: "box", layout: "vertical", margin: "md", spacing: "xs", contents: [row("ค่าส่ง", `${money(order.shippingCost || 0)}`), row("จัดส่งโดย", order.shippingMethod || "-")] },
      nextStep("📌 ยังไม่ต้องโอนเงิน", "แอดมินจะคัดผลและชั่งน้ำหนักจริง แล้วส่งยอดพร้อม QR มาในแชทนี้"),
    ],
    [trackBtn(order), askBtn(order)]
  );
}

/** ชื่อเดิมที่โค้ดส่วนอื่นยังเรียกอยู่ */
export const buildOrderSummaryForCustomerFlex = buildBookingReceiptFlex;

// ------------------------------------------------------------
// 2) ชั่งแล้ว — ยอดที่ต้องโอน + QR พร้อมเพย์
// ------------------------------------------------------------
export function buildPaymentQrForCustomerFlex(order: Order, publicBaseUrl?: string): unknown[] {
  const grandTotal = (order.totalPrice || 0) + (order.shippingCost || 0);
  const baseUrl = publicBaseUrl && publicBaseUrl.startsWith("https://") ? publicBaseUrl.replace(/\/+$/, "") : "https://durianwinkin.vercel.app";
  const qrUrl = `${baseUrl}/api/promptpay-qr?amount=${encodeURIComponent(String(grandTotal))}`;
  const bank = getBankAccount();
  return card(
    `💰 ยอดที่ต้องโอน #${order.id} ${money(grandTotal)}`,
    header("💰 ชั่งแล้ว — โอนได้เลย", order, 2),
    [
      itemsBox(order),
      sep,
      { type: "box", layout: "vertical", margin: "md", spacing: "xs", contents: [row("ค่าสินค้า", money(order.totalPrice || 0)), row("ค่าส่ง", money(order.shippingCost || 0))] },
      {
        type: "box",
        layout: "horizontal",
        margin: "md",
        backgroundColor: "#F0FDF4",
        cornerRadius: "md",
        paddingAll: "md",
        contents: [
          { type: "text", text: "ยอดที่ต้องโอน", size: "md", weight: "bold", color: "#166534", gravity: "center" },
          { type: "text", text: money(grandTotal), size: "xxl", weight: "bold", color: "#166534", align: "end" },
        ],
      },
      { type: "image", url: qrUrl, size: "lg", aspectRatio: "1:1", aspectMode: "fit", margin: "md" },
      { type: "text", text: "สแกนจ่ายด้วยแอปธนาคารได้ทุกธนาคาร", size: "xxs", color: "#6B7280", align: "center" },
      {
        type: "box",
        layout: "vertical",
        margin: "md",
        spacing: "xs",
        contents: [
          row("พร้อมเพย์", bank.promptPay || "-", { bold: true }),
          row(bank.bank || "บัญชี", bank.number || "-", { bold: true }),
          row("ชื่อบัญชี", bank.name || "-"),
        ],
      },
      nextStep("📸 โอนแล้วส่งรูปสลิปมาในแชทนี้", "ระบบตรวจยอดและบัญชีให้อัตโนมัติ แล้วแจ้งผลในแชทนี้"),
    ],
    [{ label: "📸 แนบสลิปโอนเงิน", data: `action=attach_slip&orderId=${order.id}`, display: `แนบสลิป #${order.id}`, primary: true }, askBtn(order)]
  );
}

// ------------------------------------------------------------
// 2.5) ได้รับสลิปแล้ว — รอตรวจ
// ------------------------------------------------------------
export function buildSlipSubmittedReceiptFlex(order: Order): unknown[] {
  const grandTotal = (order.totalPrice || 0) + (order.shippingCost || 0);
  return card(
    `🧾 ได้รับสลิปแล้ว #${order.id} — กำลังตรวจ`,
    header("🧾 ได้รับสลิปแล้ว", order, 2),
    [
      row("ยอดของออเดอร์นี้", money(grandTotal), { bold: true }),
      nextStep("⏳ กำลังตรวจสลิป", "แอดมินตรวจยอดเงินเข้าแล้วจะแจ้งยืนยันในแชทนี้ ไม่ต้องส่งซ้ำนะครับ"),
    ],
    [trackBtn(order), askBtn(order)]
  );
}

// ------------------------------------------------------------
// 3) ชำระเงินแล้ว — เตรียมจัดส่ง
// ------------------------------------------------------------
export function buildPaymentConfirmedFlex(order: Order): unknown[] {
  const grandTotal = (order.totalPrice || 0) + (order.shippingCost || 0);
  return card(
    `✅ ชำระเงินแล้ว #${order.id} — กำลังเตรียมจัดส่ง`,
    header("✅ ชำระเงินเรียบร้อย", order, 3),
    [
      row("ยอดที่ชำระ", money(grandTotal), { bold: true, color: "#166534" }),
      row("จัดส่งโดย", order.shippingMethod || "-"),
      nextStep("📦 กำลังแพ็กของ", "ทีมงานกำลังคัดและแพ็กทุเรียนให้ ออกจัดส่งแล้วจะแจ้งเลขพัสดุในแชทนี้", "ok"),
    ],
    [trackBtn(order)]
  );
}

// ------------------------------------------------------------
// 4) ออกจัดส่งแล้ว
// ------------------------------------------------------------
export function buildShippedNoticeFlex(order: Order): unknown[] {
  return card(
    `🚚 ออกจัดส่งแล้ว #${order.id}${order.trackingNo ? ` เลขพัสดุ ${order.trackingNo}` : ""}`,
    header("🚚 ออกจัดส่งแล้ว", order, 4),
    [
      { type: "text", text: "ทุเรียนกำลังเดินทางไปหาคุณ 🍈", size: "sm", color: "#374151", wrap: true },
      { type: "box", layout: "vertical", margin: "md", spacing: "xs", contents: [
        row("ขนส่ง", order.courier || order.shippingMethod || "รถควบคุมอุณหภูมิ"),
        ...(order.trackingNo ? [row("เลขพัสดุ", order.trackingNo, { bold: true })] : []),
        row("ส่งถึง", order.address || "-"),
      ] },
      nextStep("✅ ได้ของแล้วกดปุ่มด้านล่าง", "เปิดกล่องเช็กเนื้อทุเรียน — มีปัญหาแจ้งเคลมได้ภายใน 24 ชม.", "ok"),
    ],
    [{ label: "✅ ได้รับของแล้ว", data: `action=received&orderId=${order.id}`, display: "ได้รับของแล้ว", primary: true }, trackBtn(order)]
  );
}

// ------------------------------------------------------------
// 5) ได้รับของแล้ว
// ------------------------------------------------------------
export function buildDeliveredNoticeFlex(order: Order): unknown[] {
  return card(
    `🎉 ส่งถึงแล้ว #${order.id} — ขอบคุณที่อุดหนุน`,
    header("🎉 ส่งถึงมือแล้ว", order, 5),
    [
      { type: "text", text: `${shopInfo.name}ส่งถึงมือคุณเรียบร้อยแล้วครับ ขอบคุณที่อุดหนุน 🙏`, size: "sm", color: "#374151", wrap: true },
      nextStep("🛡️ มีปัญหาเคลมได้ภายใน 24 ชม.", "อ่อน เนื้อขาว เละ หนอน — ถ่ายรูปแล้วกดแจ้งเคลมได้เลย เปลี่ยนลูกใหม่หรือคืนเงิน", "ok"),
    ],
    [{ label: "🛡️ แจ้งเคลม", data: `action=claim&orderId=${order.id}`, display: "แจ้งเคลม" }, askBtn(order)]
  );
}
