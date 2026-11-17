// การ์ดชำระเงินพร้อมเพย์ (QR)
import { getBankAccount } from "../sheets-db";

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
          text: "✅ รับจองแล้ว",
          color: "#FDE047",
          weight: "bold",
          size: "md",
        },
        {
          type: "text",
          text: params.orderId
            ? `เลขออเดอร์ ${params.orderId} • 🟡 รอชั่ง`
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
          text: `พร้อมเพย์: ${getBankAccount().promptPay}`,
          size: "xs",
          weight: "bold",
          color: "#1B4D31",
          margin: "sm",
        },
        {
          type: "text",
          text: `${getBankAccount().bank}: ${getBankAccount().number} (${getBankAccount().name})`,
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
