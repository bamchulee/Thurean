// เมนูและหน้าร้านในแชท: ต้อนรับ สต็อก แคตตาล็อก โปรโมชัน ไลฟ์ เมนูเพิ่มเติม
import type { Product, Promotion, Round, RuntimeConfig } from "../../types/durian";
import { shopInfo } from "../../data/shop";
import { formatProductStock } from "../stock";
import { buildMainQuickReply, safeHttpsImage } from "./shared";

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
                label: "เช็กสต็อก & สั่งซื้อ",
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
                    label: "แจ้งเคลม",
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
  mode: "stock" | "order" = "stock",
  publicBaseUrl?: string
): unknown[] {
  // กรองเฉพาะรายการที่เปิดใช้งาน (isActive !== 0)
  const activeProducts = products.filter(
    (p) => p.isActive !== 0 && (p.isActive as any) !== "0" && p.isActive !== false
  );

  const availableProducts = activeProducts.filter((p) => {
    const info = formatProductStock(p);
    return p.isAvailable && !info.isOutOfStock;
  });

  const totalKg = activeProducts.reduce(
    (sum, p) => sum + (p.stockUnit === "kg" && typeof p.stockKg === "number" ? p.stockKg : 0),
    0
  );
  const isClosed = round?.status === "closed" || (round?.quotaRemaining ?? 1) <= 0;
  const isLowQuota = !isClosed && (round?.quotaRemaining ?? 0) <= 5 && (round?.quotaRemaining ?? 0) > 0;
  const statusColor = isClosed ? "#DC2626" : isLowQuota ? "#D97706" : "#15803D";
  const statusText = isClosed ? "🔴 ปิดรับรอบส่งแล้ว" : isLowQuota ? "🟠 โควต้าใกล้เต็ม" : "🟢 กำลังเปิดรับออเดอร์";

  // สร้างแถวรายการสต็อกย่อสำหรับใส่ในการ์ด Dashboard (ตัวหนังสือใหญ่ อ่านง่าย ไม่ตัดคำ)
  const miniStockRows = activeProducts.slice(0, 6).map((p) => {
    const st = formatProductStock(p);
    const isOut = p.isAvailable === false || st.isOutOfStock;
    return {
      type: "box",
      layout: "horizontal",
      margin: "sm",
      contents: [
        {
          type: "text",
          text: isOut ? "⚪" : st.isLowStock ? "🟠" : "🟢",
          size: "sm",
          flex: 1,
        },
        {
          type: "text",
          text: p.name,
          size: "sm",
          color: isOut ? "#9CA3AF" : "#1F2937",
          weight: "bold",
          flex: 6,
          wrap: true,
        },
        {
          type: "text",
          text: isOut ? "หมดรอบนี้" : st.summary,
          size: "sm",
          color: isOut ? "#EF4444" : st.isLowStock ? "#D97706" : "#059669",
          weight: "bold",
          align: "end",
          flex: 4,
        },
      ],
    };
  });

  // การ์ดที่ 1: สรุปสต็อกและรอบจัดส่งแบบ Dashboard กราฟิกหรูหรา (แทน Plain Text เดิม)
  const overviewBubble = {
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
              text: "🍈 สต็อกสดหน้าสวน",
              color: "#FDE047",
              weight: "bold",
              size: "md",
              flex: 5,
            },
            {
              type: "text",
              text: statusText,
              color: "#FFFFFF",
              size: "xs",
              weight: "bold",
              align: "end",
              flex: 4,
            },
          ],
        },
        {
          type: "text",
          text: `${shopInfo.name} — คัดแก่จัด 85%+ วิ่งตรงถึงบ้านคุณ`,
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
        // Round info banner
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#F0FDF4",
          cornerRadius: "md",
          paddingAll: "md",
          borderColor: "#BBF7D0",
          borderWidth: "1px",
          contents: [
            {
              type: "text",
              text: `🚚 รอบส่ง: ${round?.name || "รอบจัดส่งปัจจุบัน"}`,
              weight: "bold",
              size: "sm",
              color: "#166534",
            },
            {
              type: "box",
              layout: "horizontal",
              margin: "sm",
              contents: [
                {
                  type: "text",
                  text: `✂️ ตัดสด: ${round?.harvestDate || "ตามคิว"}`,
                  size: "xs",
                  color: "#374151",
                  weight: "bold",
                  flex: 1,
                },
                {
                  type: "text",
                  text: `🏡 ส่งถึงบ้าน: ${round?.deliveryDate || "1-2 วัน"}`,
                  size: "xs",
                  color: "#374151",
                  weight: "bold",
                  align: "end",
                  flex: 1,
                },
              ],
            },
          ],
        },
        // 3-column stats metrics
        {
          type: "box",
          layout: "horizontal",
          spacing: "xs",
          contents: [
            {
              type: "box",
              layout: "vertical",
              backgroundColor: "#FEF3C7",
              cornerRadius: "md",
              paddingAll: "sm",
              flex: 1,
              contents: [
                { type: "text", text: "สต็อกรวม", size: "xs", color: "#92400E", align: "center" },
                {
                  type: "text",
                  text: `${totalKg.toFixed(1)} กก.`,
                  size: "sm",
                  weight: "bold",
                  color: "#78350F",
                  margin: "xs",
                  align: "center",
                },
              ],
            },
            {
              type: "box",
              layout: "vertical",
              backgroundColor: "#ECFDF5",
              cornerRadius: "md",
              paddingAll: "sm",
              flex: 1,
              contents: [
                { type: "text", text: "โควต้ากล่อง", size: "xs", color: "#065F46", align: "center" },
                {
                  type: "text",
                  text: `${round?.quotaRemaining ?? 0}/${round?.totalQuota ?? 0}`,
                  size: "sm",
                  weight: "bold",
                  color: "#047857",
                  margin: "xs",
                  align: "center",
                },
              ],
            },
            {
              type: "box",
              layout: "vertical",
              backgroundColor: "#EFF6FF",
              cornerRadius: "md",
              paddingAll: "sm",
              flex: 1,
              contents: [
                { type: "text", text: "พร้อมส่ง", size: "xs", color: "#1E40AF", align: "center" },
                {
                  type: "text",
                  text: `${availableProducts.length} ชนิด`,
                  size: "sm",
                  weight: "bold",
                  color: "#1D4ED8",
                  margin: "xs",
                  align: "center",
                },
              ],
            },
          ],
        },
        // Mini checklist
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            {
              type: "text",
              text: "📋 รายการสต็อกคงเหลือแต่ละสายพันธุ์:",
              weight: "bold",
              size: "sm",
              color: "#1C1917",
            },
            ...miniStockRows,
          ],
        },
        {
          type: "text",
          text: "👉 เลื่อนดูข้อมูลสเปกและความสุกทุเรียนแต่ละสายพันธุ์ด้านข้างได้เลยครับ",
          size: "xs",
          weight: "bold",
          color: "#065F46",
          align: "center",
          margin: "xs",
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
          color: "#166534",
          height: "sm",
          flex: 1,
          action: {
            type: "postback",
            label: "🔄 อัปเดตสต็อกสด",
            data: "action=stock",
            displayText: "เช็คสต็อก",
          },
        },
        ...(publicBaseUrl
          ? [
              {
                type: "button",
                style: "secondary",
                height: "sm",
                flex: 1,
                action: {
                  type: "uri",
                  label: "🌐 ดูหน้าร้านเว็บ",
                  uri: publicBaseUrl,
                },
              },
            ]
          : []),
      ],
    },
  };

  // การ์ดสินค้าแต่ละตัวใน Carousel (เฉพาะข้อมูลสต็อก ไม่มีปุ่มสั่งซื้อปน)
  const sorted = [...activeProducts]
    .sort((a, b) => Number(b.isAvailable) - Number(a.isAvailable))
    .slice(0, 10);

  const bubbles = sorted.map((p) => {
    const stockInfo = formatProductStock(p);
    const isLow = stockInfo.isLowStock;
    const isOut = p.isAvailable === false || stockInfo.isOutOfStock;

    return {
      type: "bubble",
      size: "mega",
      hero: {
        type: "image",
        url: safeHttpsImage(p.image),
        size: "full",
        aspectRatio: "16:9",
        aspectMode: "cover",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "lg",
        contents: [
          // 1. ชื่อ
          {
            type: "text",
            text: p.name,
            weight: "bold",
            size: "md",
            wrap: true,
            maxLines: 2,
            color: "#111827",
          },
          // 2. ราคาต่อโล
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "ราคาต่อโล:",
                size: "xs",
                color: "#6B7280",
                flex: 4,
              },
              {
                type: "text",
                text: `฿${(p.pricePerKg || p.price).toLocaleString()} / กก.`,
                weight: "bold",
                size: "lg",
                color: "#B45309",
                align: "end",
                flex: 6,
              },
            ],
          },
          { type: "separator", margin: "xs" },
          // 3. น้ำหนัก
          {
            type: "box",
            layout: "horizontal",
            margin: "xs",
            contents: [
              { type: "text", text: "⚖️ น้ำหนัก:", size: "xs", color: "#4B5563", flex: 4 },
              { type: "text", text: p.weight || "-", size: "xs", weight: "bold", color: "#1F2937", flex: 6 },
            ],
          },
          // 4. เกรด
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "🏷️ เกรด:", size: "xs", color: "#4B5563", flex: 4 },
              { type: "text", text: p.grade || "เกรด A+ พรีเมียม", size: "xs", weight: "bold", color: "#15803D", flex: 6 },
            ],
          },
          // 5. Texture
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "✨ Texture:", size: "xs", color: "#4B5563", flex: 4 },
              { type: "text", text: p.texture || p.specs?.texture || "กรอบนอกนุ่มใน", size: "xs", weight: "bold", color: "#0D9488", flex: 6 },
            ],
          },
          // 6. รายละเอียด
          {
            type: "box",
            layout: "vertical",
            margin: "sm",
            backgroundColor: "#F9FAFB",
            cornerRadius: "md",
            paddingAll: "sm",
            contents: [
              { type: "text", text: "📝 รายละเอียด:", size: "xxs", color: "#6B7280", weight: "bold" },
              {
                type: "text",
                text: p.description || "ทุเรียนคัดคุณภาพพิเศษ หวานมันกลมกล่อม",
                size: "xs",
                color: "#374151",
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
        paddingAll: "sm",
        spacing: "xs",
        contents: [
          {
            type: "text",
            text: isOut ? "⚪ สินค้าหมดรอบจัดส่งนี้" : isLow ? "🟠 สินค้าเหลือน้อยใกล้หมด" : "🟢 มีสินค้าพร้อมจัดส่ง",
            size: "xs",
            align: "center",
            weight: "bold",
            color: isOut ? "#9CA3AF" : isLow ? "#D97706" : "#166534",
          },
          ...(!isOut && !isClosed
            ? [
                {
                  type: "button",
                  style: "primary",
                  color: "#15803D",
                  height: "sm",
                  action: {
                    type: "postback",
                    label: "🛒 สั่งจองพันธุ์นี้",
                    data: `action=order_step&step=qty&pid=${encodeURIComponent(p.id)}`,
                    displayText: `สั่งจอง ${p.name}`,
                  },
                },
              ]
            : []),
        ],
      },
    };
  });

  const resultMessages: unknown[] = [
    {
      type: "flex",
      altText: `📦 รายงานสต็อกทุเรียนสดหน้าสวน — ${shopInfo.name}`,
      contents: overviewBubble,
    },
  ];

  if (bubbles.length > 0) {
    resultMessages.push({
      type: "flex",
      altText: `🍈 รายการทุเรียนพร้อมส่ง — ${shopInfo.name}`,
      quickReply: buildMainQuickReply(),
      contents: {
        type: "carousel",
        contents: bubbles,
      },
    });
  }

  return resultMessages;
}

/**
 * แคตตาล็อกสินค้าสำหรับสั่งซื้อโดยเฉพาะ (มีปุ่มสั่งซื้อพันธุ์นี้ชัดเจน ไม่แสดงการ์ดสรุปสต็อกปน)
 */
export function buildOrderCatalogMessages(
  products: Product[],
  round: Round | undefined,
  publicBaseUrl?: string
): unknown[] {
  const activeProducts = products.filter(
    (p) => p.isActive !== 0 && (p.isActive as any) !== "0" && p.isActive !== false
  );
  if (activeProducts.length === 0) {
    return [
      {
        type: "text",
        text: `🍈 ขณะนี้ทางสวนยังไม่มีรายการทุเรียนที่เปิดรับสั่งจองครับ\n\nสามารถกดปุ่ม "เช็กสต็อก" ด้านล่าง หรือทักสอบถามแอดมินเกี่ยวกับรอบถัดไปได้เลยครับ ✨`,
        quickReply: buildMainQuickReply(),
      },
    ];
  }
  const isClosed = round?.status === "closed" || (round?.quotaRemaining ?? 1) <= 0;

  const bubbles = activeProducts.map((p) => {
    const stockInfo = formatProductStock(p);
    const canBuy = p.isAvailable && !stockInfo.isOutOfStock && !isClosed;
    const isLow = stockInfo.isLowStock;
    const isOut = p.isAvailable === false || stockInfo.isOutOfStock;

    return {
      type: "bubble",
      size: "mega",
      hero: {
        type: "image",
        url: safeHttpsImage(p.image),
        size: "full",
        aspectRatio: "16:9",
        aspectMode: "cover",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "lg",
        contents: [
          // 1. ชื่อ
          {
            type: "text",
            text: p.name,
            weight: "bold",
            size: "md",
            wrap: true,
            maxLines: 2,
            color: "#111827",
          },
          // 2. ราคาต่อโล
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "ราคาต่อโล:",
                size: "xs",
                color: "#6B7280",
                flex: 4,
              },
              {
                type: "text",
                text: `฿${(p.pricePerKg || p.price).toLocaleString()} / กก.`,
                weight: "bold",
                size: "lg",
                color: "#B45309",
                align: "end",
                flex: 6,
              },
            ],
          },
          { type: "separator", margin: "xs" },
          // 3. น้ำหนัก
          {
            type: "box",
            layout: "horizontal",
            margin: "xs",
            contents: [
              { type: "text", text: "⚖️ น้ำหนัก:", size: "xs", color: "#4B5563", flex: 4 },
              { type: "text", text: p.weight || "-", size: "xs", weight: "bold", color: "#1F2937", flex: 6 },
            ],
          },
          // 4. เกรด
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "🏷️ เกรด:", size: "xs", color: "#4B5563", flex: 4 },
              { type: "text", text: p.grade || "เกรด A+ พรีเมียม", size: "xs", weight: "bold", color: "#15803D", flex: 6 },
            ],
          },
          // 5. Texture
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "✨ Texture:", size: "xs", color: "#4B5563", flex: 4 },
              { type: "text", text: p.texture || p.specs?.texture || "กรอบนอกนุ่มใน", size: "xs", weight: "bold", color: "#0D9488", flex: 6 },
            ],
          },
          // 6. รายละเอียด
          {
            type: "box",
            layout: "vertical",
            margin: "sm",
            backgroundColor: "#F9FAFB",
            cornerRadius: "md",
            paddingAll: "sm",
            contents: [
              { type: "text", text: "📝 รายละเอียด:", size: "xxs", color: "#6B7280", weight: "bold" },
              {
                type: "text",
                text: p.description || "ทุเรียนคัดคุณภาพพิเศษ หวานมันกลมกล่อม",
                size: "xs",
                color: "#374151",
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
        paddingAll: "md",
        contents: [
          canBuy
            ? {
                type: "button",
                style: "primary",
                color: "#15803D",
                height: "sm",
                action: {
                  type: "postback",
                  label: "🛒 สั่งจองพันธุ์นี้",
                  data: `action=order_step&step=qty&pid=${encodeURIComponent(p.id)}`,
                  displayText: `สั่งจอง ${p.name}`,
                },
              }
            : {
                type: "button",
                style: "secondary",
                height: "sm",
                action: {
                  type: "postback",
                  label: "หมดรอบนี้ (ดูพันธุ์อื่น)",
                  data: "action=order",
                },
              },
        ],
      },
    };
  });

  return [
    {
      type: "flex",
      altText: `🛒 เลือกสั่งซื้อทุเรียน — ${shopInfo.name}`,
      quickReply: buildMainQuickReply(),
      contents: {
        type: "carousel",
        contents: bubbles,
      },
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
        label: cfg.isLiveNow ? "🔴 ชมไลฟ์สดตอนนี้" : "เปิดชมช่องไลฟ์สด",
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
      label: "เช็กสต็อกทุเรียน",
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
        label: "📋 ประวัติคำสั่งซื้อของฉัน",
        data: "action=my_orders",
        displayText: "ประวัติคำสั่งซื้อ",
      },
    },
    {
      type: "button",
      style: "secondary",
      height: "sm",
      action: {
        type: "postback",
        label: "📦 เช็กสถานะพัสดุ",
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
          label: "🌐 เข้าชมหน้าร้าน",
          uri: `${baseUrl}/`,
        },
      },
      {
        type: "button",
        style: "secondary",
        height: "sm",
        action: {
          type: "uri",
          label: "🚚 เช็กเลขพัสดุ",
          uri: `${baseUrl}/tracking`,
        },
      },
      {
        type: "button",
        style: "secondary",
        height: "sm",
        action: {
          type: "uri",
          label: "🛡️ แจ้งเคลมสินค้า",
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
      label: "📞 โทรติดต่อร้าน",
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

// ============================================================
// ขั้นตอนจองใน LINE (ไม่มีสถานะค้างในเซิร์ฟเวอร์: ทุกปุ่มพกข้อมูลการจองไปเอง)
// จำนวน → ความสุก → การ์ดยืนยัน (มีที่อยู่) / ขอที่อยู่ (ยังไม่มี) → ใบรับจอง
// ============================================================
