import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAllDatabase, getRuntimeConfig } from "../../../../lib/sheets-db";
import { replyLineMessage } from "../../../../lib/line-notify";
import { shopInfo } from "../../../../data/mock";

export const dynamic = "force-dynamic";

interface LineWebhookEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { events?: LineWebhookEvent[] };
    const cfg = getRuntimeConfig();
    const events = body.events || [];

    for (const ev of events) {
      if (ev.type === "message" && ev.message?.type === "text" && ev.replyToken) {
        const text = (ev.message.text || "").trim();
        const userId = ev.source?.userId || "";

        if (text.toUpperCase().startsWith("WK-") || text.includes("สถานะ")) {
          const code = text.match(/WK-\d+/i)?.[0]?.toUpperCase();
          if (code) {
            const { data } = await getAllDatabase();
            const order = data.orders.find((o) => o.id.toUpperCase() === code);
            if (order) {
              await replyLineMessage(
                ev.replyToken,
                [
                  {
                    type: "text",
                    text: `📦 ออเดอร์ ${order.id} (${order.customerName})\nสถานะ: ${order.orderStatus}\nการชำระเงิน: ${order.paymentStatus}\n${order.trackingNo ? `เลขพัสดุ: ${order.trackingNo}` : ""}`,
                  },
                ],
                cfg.lineChannelAccessToken
              );
              continue;
            }
          }
          await replyLineMessage(
            ev.replyToken,
            [
              {
                type: "text",
                text: `พิมพ์รหัสออเดอร์เช่น "WK-9521" เพื่อเช็กสถานะได้เลยครับ หรือโทรสอบถาม ${shopInfo.phone}`,
              },
            ],
            cfg.lineChannelAccessToken
          );
        } else if (text === "myid" && userId) {
          // Helpful command for shop owner to find their LINE Admin User ID!
          await replyLineMessage(
            ev.replyToken,
            [{ type: "text", text: `LINE User ID ของคุณคือ:\n${userId}` }],
            cfg.lineChannelAccessToken
          );
        } else if (text.includes("สั่ง") || text.includes("ทุเรียน")) {
          await replyLineMessage(
            ev.replyToken,
            [
              {
                type: "text",
                text: `🍈 สวัสดีครับ ร้าน ${shopInfo.name} ยินดีต้อนรับ!\nดูรายการทุเรียนรอบนี้และกดสั่งซื้อได้ทันที หรือโทร ${shopInfo.phone}`,
              },
            ],
            cfg.lineChannelAccessToken
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
