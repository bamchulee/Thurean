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

  const courierInfo = resolveCourierInfo(
    order.trackingNo,
    order.courier,
    order.shippingMethod
  );

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
            label: `เช็กเลขกับ ${courierInfo.name.split(" ")[0]}`,
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

export function buildClaimAlertForAdmin(claim: Claim): unknown[] {
  return [
    {
      type: "text",
      text: `🛡️ แจ้งเคลมใหม่ ${claim.claimId}\nออเดอร์: ${claim.orderId}\nเบอร์: ${claim.phone}\nสาเหตุ: ${claim.reason}\nรายละเอียด: ${claim.description || "-"}${claim.evidenceName ? `\nหลักฐาน: ${claim.evidenceName}` : ""}`,
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
                label: "เช็กสต็อก & เลือกสั่งซื้อ",
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
  mode: "stock" | "order" = "stock"
): unknown[] {
  const availableProducts = products.filter((p) => {
    const info = formatProductStock(p);
    return p.isAvailable && !info.isOutOfStock;
  });
  const totalKg = products.reduce(
    (sum, p) => sum + (p.stockUnit === "kg" && typeof p.stockKg === "number" ? p.stockKg : 0),
    0
  );
  const isClosed = round?.status === "closed" || (round?.quotaRemaining ?? 1) <= 0;

  const stockLines = products.map((p) => {
    const st = formatProductStock(p);
    return `• ${p.variety} (${p.badge || p.weight}): ${st.summary} | ฿${p.price.toLocaleString()}/${p.unit}`;
  });

  const summaryText = [
    `📦 สต็อกทุเรียนจริงหน้าสวน — ${shopInfo.name}`,
    round
      ? `🚚 รอบส่ง: ${round.name}\n📅 ตัดสด: ${round.harvestDate} | ถึงบ้าน: ${round.deliveryDate}\n⚖️ ทุเรียนทั้งลูกรวม: ${totalKg.toFixed(1)} กก. • โควต้าจัดส่ง: ${round.quotaRemaining}/${round.totalQuota} กล่อง`
      : `⚖️ สต็อกรวมพร้อมขาย: ${availableProducts.length} รายการ`,
    stockLines.join("\n"),
    mode === "order"
      ? "👇 เลือกรายการที่ต้องการ แล้วกดปุ่ม \"สั่งรายการนี้\" ได้เลย (ระบบจะส่ง QR พร้อมเพย์ให้สแกนครับ)"
      : "👇 กดปุ่ม \"สั่งรายการนี้\" ในการ์ดเพื่อสั่งจองทันทีครับ",
  ].join("\n\n");

  const sorted = [...products]
    .sort((a, b) => Number(b.isAvailable) - Number(a.isAvailable))
    .slice(0, 10);

  const bubbles = sorted.map((p) => {
    const stockInfo = formatProductStock(p);
    const canBuy = p.isAvailable && !stockInfo.isOutOfStock && !isClosed;

    return {
      type: "bubble",
      size: "kilo",
      hero: {
        type: "image",
        url: safeHttpsImage(p.image),
        size: "full",
        aspectRatio: "16:10",
        aspectMode: "cover",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "xs",
        contents: [
          {
            type: "text",
            text: canBuy ? `${p.variety} • ${stockInfo.summary}` : `${p.variety} • หมดชั่วคราว`,
            size: "xxs",
            weight: "bold",
            color: canBuy ? (stockInfo.isLowStock ? "#B45309" : "#15803D") : "#B91C1C",
            wrap: true,
          },
          {
            type: "text",
            text: p.name,
            weight: "bold",
            size: "sm",
            wrap: true,
            maxLines: 2,
            color: "#1C1917",
          },
          {
            type: "text",
            text: `฿${p.price.toLocaleString()} / ${p.unit} • ${p.weight}`,
            weight: "bold",
            size: "sm",
            color: "#B45309",
          },
          {
            type: "text",
            text: `${p.specs?.maturity || ""} • ${p.brix}`.replace(/^ • /, ""),
            size: "xs",
            color: "#57534E",
            wrap: true,
            maxLines: 2,
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          canBuy
            ? {
                type: "button",
                style: "primary",
                color: "#1B4D31",
                height: "sm",
                action: {
                  type: "postback",
                  label: `สั่งรายการนี้ (฿${p.price})`,
                  data: `action=order_pick&productId=${encodeURIComponent(p.id)}`,
                  displayText: `เลือกสั่ง ${p.name}`,
                },
              }
            : {
                type: "button",
                style: "secondary",
                height: "sm",
                action: {
                  type: "postback",
                  label: "หมดชั่วคราว (เช็กตัวอื่น)",
                  data: "action=stock",
                },
              },
        ],
      },
    };
  });

  return [
    { type: "text", text: summaryText },
    {
      type: "flex",
      altText: `เมนูและสต็อกทุเรียน ${shopInfo.name}`,
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
              text: "บันทึกคำสั่งจองสำเร็จ",
              color: "#FDE047",
              weight: "bold",
              size: "md",
            },
            {
              type: "text",
              text: `รหัสออเดอร์: ${order.id}`,
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
          contents: [
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: {
                type: "message",
                label: `เช็กสถานะ ${order.id}`,
                text: order.id,
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
}): unknown[] {
  const qrUrl =
    params.publicBaseUrl && params.publicBaseUrl.startsWith("https://")
      ? `${params.publicBaseUrl}/api/promptpay-qr?amount=${encodeURIComponent(String(params.grandTotal))}`
      : "";

  const bubble: Record<string, unknown> = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#1B4D31",
      contents: [
        {
          type: "text",
          text: "สแกน QR ชำระเงิน & แนบสลิป",
          color: "#FDE047",
          weight: "bold",
          size: "md",
        },
        {
          type: "text",
          text: `ยอดโอนสุทธิ ฿${params.grandTotal.toLocaleString()} (PromptPay)`,
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
          text: `${params.productName} x${params.qty}`,
          weight: "bold",
          size: "sm",
          wrap: true,
        },
        {
          type: "text",
          text: `ผู้รับ: ${params.customerName} (${params.phone})`,
          size: "xs",
          color: "#57534E",
          wrap: true,
        },
        {
          type: "text",
          text: `ความสุก: ${params.ripenessPref} • ${params.shippingMethod} (+฿${params.shippingCost})`,
          size: "xs",
          color: "#57534E",
          wrap: true,
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
          text: "📸 โอนเสร็จแล้วส่งรูปสลิปเข้ามาในแชทนี้ได้เลย ระบบจะตรวจและออกเลข Order WK-xxxx ให้อัตโนมัติครับ",
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
          style: "secondary",
          height: "sm",
          action: {
            type: "postback",
            label: "ยังไม่มีสลิป (ออกเลข Order ก่อน)",
            data: "action=confirm_without_slip",
            displayText: "ขอยืนยันจองและส่งสลิปภายหลัง",
          },
        },
        {
          type: "button",
          style: "secondary",
          height: "sm",
          action: {
            type: "message",
            label: "ยกเลิกคำสั่งซื้อ",
            text: "ยกเลิก",
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
      altText: `สแกน QR PromptPay ฿${params.grandTotal.toLocaleString()} แล้วส่งสลิปในแชทเพื่อออกเลข Order`,
      quickReply: {
        items: [
          {
            type: "action",
            action: {
              type: "postback",
              label: "ออกเลข Order ก่อน",
              data: "action=confirm_without_slip",
              displayText: "ออกเลข Order ก่อน (ส่งสลิปทีหลัง)",
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
        label: cfg.isLiveNow ? "🔴 เข้าชมไลฟ์สดตอนนี้เลย" : "เปิดช่องไลฟ์สดของร้าน",
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
      label: "เช็กสต็อกทุเรียนระหว่างรอ",
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
        label: "📦 เช็กสถานะจัดส่ง & ขนส่ง",
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
          label: "🌐 เข้าชมหน้าเว็บไซต์ร้านค้า",
          uri: `${baseUrl}/`,
        },
      },
      {
        type: "button",
        style: "secondary",
        height: "sm",
        action: {
          type: "uri",
          label: "🚚 เช็กเลขพัสดุบนหน้าเว็บ",
          uri: `${baseUrl}/tracking`,
        },
      },
      {
        type: "button",
        style: "secondary",
        height: "sm",
        action: {
          type: "uri",
          label: "🛡️ หน้าแจ้งเคลมสินค้า 100%",
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
      label: `📞 โทรสอบถามร้าน ${shopInfo.phone}`,
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
