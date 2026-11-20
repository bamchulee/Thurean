// ข้อความถึงลูกค้าตามสถานะออเดอร์: รับจอง ยอดชำระ สลิป จัดส่ง ส่งถึง เคลม ยกเลิก
import { buildPaymentQrForCustomerFlex } from "./customer-cards";
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
