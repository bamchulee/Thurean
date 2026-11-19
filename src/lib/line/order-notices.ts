// ข้อความถึงลูกค้าตามสถานะออเดอร์: รับจอง ยอดชำระ สลิป จัดส่ง ส่งถึง เคลม ยกเลิก
import type { Claim, Order } from "../../types/durian";
import { shopInfo } from "../../data/shop";
import { getBankAccount } from "../sheets-db";
import { resolveCourierInfo } from "../courier";
import { ORDER_STATUS_META, PAYMENT_STATUS_LABEL, normalizePaymentStatus, orderStatusOf } from "../order-status";
import { buildMainQuickReply } from "./shared";

export function buildCustomerStatusFlex(order: Order): unknown[] {

  const courierInfo = resolveCourierInfo(
    order.trackingNo,
    order.courier,
    order.shippingMethod
  );

  const grandTotal = order.totalPrice + (order.shippingCost || 0);

  const bodyContents: unknown[] = [
    {
      type: "text",
      text: `${ORDER_STATUS_META[orderStatusOf(order)].emoji} ${orderStatusOf(order)} • ${PAYMENT_STATUS_LABEL[normalizePaymentStatus(order.paymentStatus)]}
${ORDER_STATUS_META[orderStatusOf(order)].customerHint}`,
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
      { type: "text", text: orderStatusOf(order) === "สั่งจอง" ? "💰 ยอดเงิน:" : "💰 ยอดรวมสุทธิ:", size: "xs", color: "#6B7280", flex: 4 },
      { type: "text", text: orderStatusOf(order) === "สั่งจอง" ? "รอชั่งน้ำหนัก" : `฿${grandTotal.toLocaleString()}`, size: "sm", weight: "bold", color: "#15803d", flex: 6 },
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

  if (order.orderStatus === "รอชำระเงิน") {
    const qrUrl = `https://durianwinkin.vercel.app/api/promptpay-qr?amount=${encodeURIComponent(String(grandTotal))}`;
    bodyContents.push(
      {
        type: "image",
        url: qrUrl,
        size: "md",
        aspectRatio: "1:1",
        aspectMode: "cover",
        margin: "sm",
        align: "center",
      },
      {
        type: "box",
        layout: "vertical",
        backgroundColor: "#FFFBEB",
        cornerRadius: "md",
        paddingAll: "sm",
        margin: "xs",
        contents: [
          {
            type: "text",
            text: `PromptPay: ${getBankAccount().promptPay}`,
            size: "xs",
            weight: "bold",
            color: "#78350F",
          },
          {
            type: "text",
            text: `${getBankAccount().bank}: ${getBankAccount().number}`,
            size: "xs",
            color: "#78350F",
          },
          {
            type: "text",
            text: "โอนเสร็จแล้วกดปุ่ม 'แนบสลิปโอนเงิน' ด้านล่างได้เลยครับ",
            size: "xxs",
            color: "#92400E",
            margin: "xs",
          },
        ],
      }
    );
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
          text: `ออเดอร์ #${order.id} • ทุเรียนวินคิน`,
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

  const footerButtons: unknown[] = [];
  if (order.orderStatus === "รอชำระเงิน") {
    footerButtons.push({
      type: "button",
      style: "primary",
      color: "#15803D",
      height: "sm",
      action: {
        type: "postback",
        label: "📸 แนบสลิปโอนเงิน",
        data: `action=attach_slip&orderId=${order.id}`,
        displayText: `แนบสลิป #${order.id}`,
      },
    });
  }
  if (courierInfo.trackingUrl && order.trackingNo) {
    footerButtons.push({
      type: "button",
      style: "primary",
      color: "#1B4D31",
      height: "sm",
      action: {
        type: "uri",
        label: "📦 เช็กเลขพัสดุ",
        uri: courierInfo.trackingUrl,
      },
    });
  }
  if (order.orderStatus === "จัดส่งสำเร็จ") {
    footerButtons.push({
      type: "button",
      style: "secondary",
      height: "sm",
      action: {
        type: "postback",
        label: "🍈 แจ้งเคลมทุเรียน",
        data: `action=claim&orderId=${order.id}`,
        displayText: `แจ้งเคลม #${order.id}`,
      },
    });
  }

  if (footerButtons.length > 0) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      contents: footerButtons,
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

export function buildBookingReceiptFlex(order: Order): unknown[] {
  const itemText = order.items
    .map((it) => `• ${it.productName} x${it.qty}\n   ฿${(it.pricePerKg || it.price).toLocaleString()}/กก.`)
    .join("\n");

  return [
    {
      type: "flex",
      altText: `🍈 บันทึกการสั่งจอง #${order.id} สำเร็จ (รอชั่งน้ำหนักจริง)`,
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
              text: "✅ รับจองแล้ว",
              color: "#FDE047",
              weight: "bold",
              size: "md",
            },
            {
              type: "text",
              text: `เลขออเดอร์ ${order.id}`,
              color: "#FFFFFF",
              size: "xs",
              margin: "xs",
            },
            {
              type: "text",
              text: `สถานะ: 🟡 ${order.orderStatus || "สั่งจอง"}`,
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
            ...(order.ripenessPref ? [{ type: "text", text: `ความสุก: ${order.ripenessPref}`, size: "xs", color: "#B45309", wrap: true }] : []),
            { type: "text", text: `ขนส่ง: ${order.shippingMethod} (฿${order.shippingCost})`, size: "xs", color: "#57534E", wrap: true },
            { type: "separator", margin: "sm" },
            {
              type: "box",
              layout: "vertical",
              backgroundColor: "#FFFBEB",
              borderColor: "#FDE68A",
              borderWidth: "1px",
              cornerRadius: "md",
              paddingAll: "sm",
              margin: "sm",
              contents: [
                {
                  type: "text",
                  text: "📌 ยังไม่ต้องโอนเงินครับ",
                  size: "xs",
                  weight: "bold",
                  color: "#92400E",
                },
                {
                  type: "text",
                  text: "แอดมินจะคัดผลและชั่งน้ำหนักจริง แล้วส่งยอดพร้อม QR PromptPay มาในแชทนี้ครับ",
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
          spacing: "xs",
          contents: [
            {
              type: "button",
              style: "primary",
              color: "#15803D",
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
                label: "💬 คุยกับแอดมิน",
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

export const buildOrderSummaryForCustomerFlex = buildBookingReceiptFlex;

export function buildPaymentQrForCustomerFlex(order: Order, publicBaseUrl?: string): unknown[] {
  const grandTotal = order.totalPrice + (order.shippingCost || 0);
  const baseUrl =
    publicBaseUrl && publicBaseUrl.startsWith("https://")
      ? publicBaseUrl.replace(/\/+$/, "")
      : "https://durianwinkin.vercel.app";
  const qrUrl = `${baseUrl}/api/promptpay-qr?amount=${encodeURIComponent(String(grandTotal))}`;
  const itemText = order.items
    .map((it) =>
      it.actualWeightKg && it.pricePerKg
        ? `• ${it.productName} ${it.qty} ลูก${it.fruitKgs?.length ? ` (${it.fruitKgs.join(" + ")} กก.)` : ""}\n   รวม ${it.actualWeightKg} กก. × ฿${it.pricePerKg.toLocaleString()} = ฿${Math.round(it.actualWeightKg * it.pricePerKg).toLocaleString()}`
        : it.lineTotal
          ? `• ${it.productName} ${it.qty} ลูก\n   ราคาเหมา ฿${it.lineTotal.toLocaleString()}`
          : `• ${it.productName} x${it.qty}`
    )
    .join("\n");

  return [
    {
      type: "flex",
      altText: `💰 ยอดที่ต้องโอน ${order.id} ฿${grandTotal.toLocaleString()}`,
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
              text: "💰 ชั่งแล้ว — ยอดที่ต้องโอน",
              color: "#FDE047",
              weight: "bold",
              size: "md",
            },
            {
              type: "text",
              text: `เลขออเดอร์ ${order.id}`,
              color: "#FFFFFF",
              size: "xs",
              margin: "xs",
            },
            {
              type: "text",
              text: "สถานะ: 🟠 รอชำระเงิน",
              color: "#FCD34D",
              size: "xs",
              weight: "bold",
              margin: "xs",
            },
          ],
        },
        body: {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            { type: "text", text: `ผู้รับ: ${order.customerName} (${order.phone})`, size: "xs", color: "#374151", wrap: true },
            { type: "text", text: itemText, size: "xs", weight: "bold", wrap: true },
            ...(order.weightPerItem
              ? [
                  {
                    type: "box",
                    layout: "horizontal",
                    margin: "xs",
                    contents: [
                      { type: "text", text: "⚖️ น้ำหนักจริงที่ชั่งได้:", size: "xs", color: "#166534", weight: "bold", flex: 6 },
                      { type: "text", text: String(order.weightPerItem), size: "xs", weight: "bold", color: "#15803D", align: "end", flex: 4 },
                    ],
                  },
                ]
              : []),
            { type: "separator", margin: "xs" },
            {
              type: "box",
              layout: "horizontal",
              margin: "xs",
              contents: [
                { type: "text", text: "ยอดที่ต้องโอน", size: "sm", weight: "bold" },
                {
                  type: "text",
                  text: `฿${grandTotal.toLocaleString()}`,
                  size: "lg",
                  weight: "bold",
                  color: "#15803D",
                  align: "end",
                },
              ],
            },
            {
              type: "image",
              url: qrUrl,
              size: "md",
              aspectRatio: "1:1",
              aspectMode: "cover",
              margin: "sm",
              align: "center",
            },
            {
              type: "box",
              layout: "vertical",
              backgroundColor: "#FFFBEB",
              cornerRadius: "md",
              paddingAll: "sm",
              margin: "xs",
              contents: [
                {
                  type: "text",
                  text: `PromptPay: ${getBankAccount().promptPay}`,
                  size: "xs",
                  weight: "bold",
                  color: "#78350F",
                },
                {
                  type: "text",
                  text: `${getBankAccount().bank}: ${getBankAccount().number}`,
                  size: "xs",
                  color: "#78350F",
                },
                {
                  type: "text",
                  text: "โอนเสร็จแล้วกดปุ่ม 'แนบสลิปโอนเงิน' ด้านล่างได้เลยครับ",
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
                label: "📸 แนบสลิปโอนเงิน",
                data: `action=attach_slip&orderId=${order.id}`,
                displayText: `แนบสลิป #${order.id}`,
              },
            },
            {
              type: "button",
              style: "link",
              height: "sm",
              action: {
                type: "postback",
                label: "💬 คุยกับแอดมิน",
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

export function buildSlipSubmittedReceiptFlex(order: Order): unknown[] {
  return [
    {
      type: "flex",
      altText: `🧾 ได้รับสลิปออเดอร์ #${order.id} แล้ว`,
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
              text: "🧾 ได้รับสลิปโอนเงินแล้ว",
              color: "#FDE047",
              weight: "bold",
              size: "md",
            },
            {
              type: "text",
              text: `เลขออเดอร์ ${order.id}`,
              color: "#FFFFFF",
              size: "xs",
              margin: "xs",
            },
            {
              type: "text",
              text: "สถานะ: 🟡 รอแอดมินตรวจสลิป",
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
            {
              type: "text",
              text: `ได้รับสลิปโอนเงินสำหรับออเดอร์ #${order.id} เรียบร้อยแล้วครับ 🙏`,
              size: "xs",
              weight: "bold",
              wrap: true,
            },
            {
              type: "text",
              text: "แอดมินกำลังตรวจสอบความถูกต้องของยอดเงิน และจะแจ้งยืนยันการจัดส่งให้ทราบทางแชทนี้ครับ",
              size: "xs",
              color: "#4B5563",
              wrap: true,
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
                label: "💬 คุยกับแอดมิน",
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

export function buildPaymentConfirmedFlex(order: Order): unknown[] {
  return [
    {
      type: "flex",
      altText: `✅ ยืนยันยอดชำระออเดอร์ #${order.id} แล้ว`,
      quickReply: buildMainQuickReply(),
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#15803D",
          contents: [
            {
              type: "text",
              text: "✅ ยืนยันการชำระเงินสำเร็จ",
              color: "#FFFFFF",
              weight: "bold",
              size: "md",
            },
            {
              type: "text",
              text: `เลขออเดอร์ ${order.id}`,
              color: "#DCFCE7",
              size: "xs",
              margin: "xs",
            },
            {
              type: "text",
              text: "สถานะ: 🟢 ชำระเงินแล้ว / เตรียมจัดส่ง",
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
            {
              type: "text",
              text: `แอดมินตรวจสอบยอดเงินเรียบร้อยแล้วครับ 🍈✨`,
              size: "xs",
              weight: "bold",
              wrap: true,
            },
            {
              type: "text",
              text: "ทีมงานกำลังเตรียมคัดและบรรจุทุเรียนคุณภาพพิเศษเพื่อส่งมอบให้คุณ เมื่อพัสดุออกเดินทางจะแจ้งเลขพัสดุให้ทราบทันทีครับ",
              size: "xs",
              color: "#4B5563",
              wrap: true,
            },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: {
                type: "postback",
                label: "📦 เช็กสถานะออเดอร์",
                data: `action=track_order&orderId=${order.id}`,
                displayText: `เช็กสถานะ #${order.id}`,
              },
            },
          ],
        },
      },
    },
  ];
}

export function buildShippedNoticeFlex(order: Order): unknown[] {
  return [
    {
      type: "flex",
      altText: `🚚 สินค้าออเดอร์ #${order.id} กำลังจัดส่ง`,
      quickReply: buildMainQuickReply(),
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#1D4ED8",
          contents: [
            {
              type: "text",
              text: "🚚 สินค้ากำลังจัดส่ง",
              color: "#FFFFFF",
              weight: "bold",
              size: "md",
            },
            {
              type: "text",
              text: `เลขออเดอร์ ${order.id}`,
              color: "#DBEAFE",
              size: "xs",
              margin: "xs",
            },
            {
              type: "text",
              text: "สถานะ: 🔵 กำลังจัดส่ง",
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
            {
              type: "text",
              text: `ทุเรียนของคุณกำลังเดินทางไปหาคุณแล้วครับ 🍈📦`,
              size: "xs",
              weight: "bold",
              wrap: true,
            },
            {
              type: "text",
              text: `ขนส่ง: ${order.courier || order.shippingMethod || "รถควบคุมอุณหภูมิ"}`,
              size: "xs",
              color: "#374151",
            },
            ...(order.trackingNo
              ? [
                  {
                    type: "text",
                    text: `เลขพัสดุ: ${order.trackingNo}`,
                    size: "sm",
                    weight: "bold",
                    color: "#1D4ED8",
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
              color: "#1D4ED8",
              height: "sm",
              action: {
                type: "postback",
                label: "📦 เช็กสถานะพัสดุ",
                data: `action=track_order&orderId=${order.id}`,
                displayText: `เช็กสถานะ #${order.id}`,
              },
            },
            {
              type: "button",
              style: "secondary",
              height: "sm",
              margin: "sm",
              action: {
                type: "postback",
                label: "✅ ได้รับของแล้ว",
                data: `action=received&orderId=${order.id}`,
                displayText: "ได้รับของแล้ว",
              },
            },
          ],
        },
      },
    },
  ];
}

export function buildDeliveredNoticeFlex(order: Order): unknown[] {
  return [
    {
      type: "flex",
      altText: `🎉 พัสดุออเดอร์ #${order.id} จัดส่งสำเร็จแล้ว`,
      quickReply: buildMainQuickReply(),
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#15803D",
          contents: [
            {
              type: "text",
              text: "🎉 พัสดุจัดส่งสำเร็จแล้ว",
              color: "#FFFFFF",
              weight: "bold",
              size: "md",
            },
            {
              type: "text",
              text: `เลขออเดอร์ ${order.id}`,
              color: "#DCFCE7",
              size: "xs",
              margin: "xs",
            },
            {
              type: "text",
              text: "สถานะ: 🟢 จัดส่งสำเร็จ",
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
            {
              type: "text",
              text: `${shopInfo.name}ส่งถึงมือคุณเรียบร้อยแล้วครับ 🍈🙏`,
              size: "xs",
              weight: "bold",
              wrap: true,
            },
            {
              type: "text",
              text: "กรุณาเปิดกล่องและตรวจสอบเนื้อทุเรียน หากพบปัญหา สามารถกดปุ่มแจ้งเคลมได้ภายใน 24 ชม. ครับ",
              size: "xs",
              color: "#4B5563",
              wrap: true,
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
              style: "secondary",
              height: "sm",
              action: {
                type: "postback",
                label: "🍈 แจ้งเคลมทุเรียน",
                data: `action=claim&orderId=${order.id}`,
                displayText: `แจ้งเคลม #${order.id}`,
              },
            },
            {
              type: "button",
              style: "link",
              height: "sm",
              action: {
                type: "postback",
                label: "💬 คุยกับแอดมิน",
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

export function buildCancelledNoticeFlex(order: Order): unknown[] {
  const refundNote =
    order.paymentStatus === "refunded"
      ? "\n💸 ยอดที่ชำระแล้ว ร้านจะโอนคืนให้ภายใน 1-2 วันทำการครับ"
      : "";
  return [
    {
      type: "text",
      text: `❌ ออเดอร์ #${order.id} ถูกยกเลิกแล้วครับ${order.cancelReason ? `\nเหตุผล: ${order.cancelReason}` : ""}${refundNote}\n\nสอบถามเพิ่มเติม โทร ${shopInfo.phone} หรือกด "คุยกับแอดมิน" ได้เลยครับ 🙏`,
      quickReply: buildMainQuickReply(),
    },
  ];
}

export function buildSlipRejectedNotice(order: Order, publicBaseUrl?: string, reason?: string): unknown[] {
  const qr = buildPaymentQrForCustomerFlex(order, publicBaseUrl).map((m) => {
    const copy = { ...(m as Record<string, unknown>) };
    delete copy.quickReply;
    return copy;
  });
  return [
    {
      type: "text",
      text: `⚠️ สลิปของออเดอร์ #${order.id} ยังตรวจไม่ผ่านครับ${reason ? `\nเหตุผล: ${reason}` : ""}\n\nยอดที่ต้องโอน: ฿${(order.totalPrice + (order.shippingCost || 0)).toLocaleString()}\nรบกวนส่งรูปสลิปที่ถูกต้องเข้ามาในแชทนี้อีกครั้ง หรือกด "คุยกับแอดมิน" ครับ 🙏`,
    },
    ...qr,
  ];
}
