// ฟอร์มที่อยู่ และรายการออเดอร์ของฉัน
import type { Claim, Order } from "../../types/durian";
import { shopInfo } from "../../data/shop";
import { checkClaimEligibility } from "../claim-policy";
import { ORDER_STATUS_META, normalizePaymentStatus, orderStatusOf } from "../order-status";
import { buildMainQuickReply } from "./shared";

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

    const status = orderStatusOf(o);
    const isPaid = normalizePaymentStatus(o.paymentStatus) === "confirmed" || ORDER_STATUS_META[status].step >= 3;
    const isDelivered = status === "จัดส่งสำเร็จ";
    const statusBadgeText =
      status === "รอชำระเงิน" && normalizePaymentStatus(o.paymentStatus) === "slip_submitted"
        ? "🧾 ส่งสลิปแล้ว รอตรวจ"
        : `${ORDER_STATUS_META[status].emoji} ${status}`;
    const statusBadgeColor = ORDER_STATUS_META[status].color;

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
                text: status === "สั่งจอง" ? "ยอดเงิน:" : "ยอดสุทธิ:",
                size: "sm",
                color: "#4B5563",
              },
              {
                type: "text",
                text: status === "สั่งจอง" ? "รอชั่งน้ำหนัก" : `฿${grandTotal.toLocaleString()}`,
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
