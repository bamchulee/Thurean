// ============================================================
// LINE OA Messaging API Helper for "ทุเรียนวินคิน"
// ============================================================
import type { Order, Claim } from "../types/durian";

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
  channelAccessToken?: string
): Promise<boolean> {
  if (!channelAccessToken || !replyToken) return false;
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({ replyToken, messages }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function buildOrderAlertForAdmin(order: Order): unknown[] {
  const itemLines = order.items
    .map((it) => `• ${it.productName} x${it.qty}`)
    .join("\n");
  const grandTotal = order.totalPrice + order.shippingCost;

  return [
    {
      type: "flex",
      altText: `🍈 มีออเดอร์ใหม่ ${order.id} (฿${grandTotal.toLocaleString()})`,
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#14532d",
          contents: [
            {
              type: "text",
              text: "🍈 ออเดอร์ใหม่! ทุเรียนวินคิน",
              color: "#fde047",
              weight: "bold",
              size: "md",
            },
            {
              type: "text",
              text: `รหัส: ${order.id}`,
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
            },
            {
              type: "text",
              text: `โทร: ${order.phone}`,
              size: "xs",
              color: "#4b5563",
            },
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
  };

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
      text: `ขนส่ง: ${order.shippingMethod}`,
      size: "xs",
      color: "#4b5563",
      wrap: true,
    },
  ];

  if (order.trackingNo) {
    bodyContents.push({
      type: "box",
      layout: "vertical",
      backgroundColor: "#fef9c3",
      cornerRadius: "md",
      paddingAll: "md",
      margin: "md",
      contents: [
        { type: "text", text: "เลขพัสดุ (Tracking No.)", size: "xxs", color: "#854d0e" },
        {
          type: "text",
          text: order.trackingNo,
          weight: "bold",
          size: "md",
          color: "#14532d",
        },
      ],
    });
  }

  return [
    {
      type: "flex",
      altText: `อัปเดตสถานะทุเรียนวินคิน ${order.id}`,
      contents: {
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
      },
    },
  ];
}

export function buildClaimAlertForAdmin(claim: Claim): unknown[] {
  return [
    {
      type: "text",
      text: `🛡️ แจ้งเคลมใหม่ ${claim.claimId}\nออเดอร์: ${claim.orderId}\nเบอร์: ${claim.phone}\nสาเหตุ: ${claim.reason}\nรายละเอียด: ${claim.description || "-"}`,
    },
  ];
}
