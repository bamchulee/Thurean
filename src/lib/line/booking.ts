// ขั้นตอนจองในแชท: เลือกจำนวน ความสุก สรุปก่อนยืนยัน ขอที่อยู่
import type { Product } from "../../types/durian";
import { pricePerKgOf } from "../stock";

export interface BookingReviewParams {
  product: Product;
  qty: number;
  ripenessLabel: string;
  shippingName: string;
  shippingCost: number;
  customer: { name: string; phone: string; address: string };
  /** postback data ของปุ่มยืนยัน (มี bookingKey แล้ว) */
  confirmData: string;
  /** postback data ของปุ่มเปลี่ยนวิธีส่ง (ไม่มี = มีวิธีเดียว) */
  changeShipData?: string;
  addressFormUrl: string;
}

const qrItem = (action: Record<string, unknown>) => ({ type: "action", action });

const cancelQuickItem = qrItem({ type: "message", label: "ยกเลิก", text: "ยกเลิก" });

export function buildQtyPickerMessage(product: Product, stockSummary?: string): unknown[] {
  const unit = product.unit || "ลูก";

  const items = [1, 2, 3, 4, 5].map((n) =>
    qrItem({
      type: "postback",
      label: `${n} ${unit}`,
      data: `action=order_step&step=ripeness&pid=${encodeURIComponent(product.id)}&qty=${n}`,
      displayText: `${n} ${unit}`,
    })
  );
  const lines = [
    `🍈 ${product.name}`,
    `💰 ฿${pricePerKgOf(product).toLocaleString()}/กก. — คิดตามน้ำหนักที่ชั่งจริง`,
    product.weight ? `⚖️ น้ำหนักประมาณ ${product.weight}` : "",
    stockSummary ? `📦 ${stockSummary}` : "",
  ].filter(Boolean);
  return [
    {
      type: "text",
      text: `${lines.join("\n")}\n\nต้องการกี่${unit}ครับ? (กดเลือก หรือพิมพ์ตัวเลขได้ถึง 10)`,
      quickReply: { items: [...items, cancelQuickItem] },
    },
  ];
}

export function buildRipenessPickerMessage(
  product: Product,
  qty: number,
  options: readonly { code: string; label: string; short: string }[]
): unknown[] {
  return [
    {
      type: "text",
      text: `🍈 ${product.name} จำนวน ${qty} ${product.unit || "ลูก"}\n\nชอบความสุกแบบไหนครับ?`,
      quickReply: {
        items: [
          ...options.map((o) =>
            qrItem({
              type: "postback",
              label: o.short,
              data: `action=order_step&step=review&pid=${encodeURIComponent(product.id)}&qty=${qty}&r=${o.code}`,
              displayText: o.label,
            })
          ),
          cancelQuickItem,
        ],
      },
    },
  ];
}

export function buildBookingReviewFlex(p: BookingReviewParams): unknown[] {
  const row = (label: string, value: string, bold = false) => ({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: label, size: "xs", color: "#6B7280", flex: 3 },
      {
        type: "text",
        text: value || "-",
        size: "xs",
        color: "#111827",
        flex: 6,
        wrap: true,
        align: "end",
        weight: bold ? "bold" : "regular",
      },
    ],
  });
  return [
    {
      type: "flex",
      altText: `ยืนยันการจอง ${p.product.name} x${p.qty} (฿${pricePerKgOf(p.product).toLocaleString()}/กก.)`.slice(0, 400),
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#1B4D31",
          paddingAll: "lg",
          contents: [
            { type: "text", text: "📝 ตรวจสอบก่อนยืนยันการจอง", color: "#FDE047", weight: "bold", size: "md" },
            {
              type: "text",
              text: "ยังไม่ต้องโอนเงิน — ชั่งจริงแล้วส่งยอดให้",
              color: "#FFFFFF",
              size: "xs",
              margin: "xs",
              wrap: true,
            },
          ],
        },
        body: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            row("สินค้า", `${p.product.name} x${p.qty}`, true),
            row("ความสุก", p.ripenessLabel),
            row("จัดส่ง", `${p.shippingName} (฿${p.shippingCost})`),
            { type: "separator", margin: "md" },
            row("ผู้รับ", p.customer.name, true),
            row("โทร", p.customer.phone),
            row("ที่อยู่", p.customer.address),
            { type: "separator", margin: "md" },
            row("ราคา", `฿${pricePerKgOf(p.product).toLocaleString()}/กก.`, true),
            {
              type: "text",
              text: "ยอดจริง = น้ำหนักที่ชั่ง × ราคาต่อกิโล + ค่าส่ง",
              size: "xxs",
              color: "#B45309",
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
              action: { type: "postback", label: "✅ ยืนยันการจอง", data: p.confirmData, displayText: "ยืนยันการจอง" },
            },
            ...(p.changeShipData
              ? [
                  {
                    type: "button",
                    style: "secondary",
                    height: "sm",
                    action: {
                      type: "postback",
                      label: "🚚 เปลี่ยนวิธีส่ง",
                      data: p.changeShipData,
                      displayText: "เปลี่ยนวิธีส่ง",
                    },
                  },
                ]
              : []),
            {
              type: "button",
              style: "link",
              height: "sm",
              action: { type: "uri", label: "✏️ แก้ชื่อ/ที่อยู่", uri: p.addressFormUrl },
            },
          ],
        },
      },
    },
  ];
}

/** ยังไม่มีชื่อ/เบอร์/ที่อยู่: ให้กรอกฟอร์ม (ฟอร์มส่งการ์ดยืนยันกลับมาให้เอง) หรือพิมพ์ในแชท */
export function buildNeedAddressMessage(summary: string, formUrl: string): unknown[] {
  return [
    {
      type: "text",
      text: `🍈 ${summary}\n\n📍 ขอชื่อผู้รับ เบอร์โทร และที่อยู่จัดส่งครับ\n• กดปุ่ม "กรอกที่อยู่" ด้านล่าง (แนะนำ)\n• หรือพิมพ์ในแชทนี้ เช่น\nสมชาย 0812345678 99/1 สุขุมวิท กทม. 10110\n\nบันทึกแล้วระบบจะส่งการ์ดยืนยันการจองให้ทันทีครับ`,
      quickReply: {
        items: [
          qrItem({ type: "uri", label: "📝 กรอกที่อยู่", uri: formUrl }),
          qrItem({ type: "location", label: "🗺️ ปักหมุดแผนที่" }),
          cancelQuickItem,
        ],
      },
    },
  ];
}
