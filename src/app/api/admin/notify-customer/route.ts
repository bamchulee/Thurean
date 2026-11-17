import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireStaff, unauthorizedResponse } from "../../../../lib/admin-auth";
import { pushLineMessage, buildMainQuickReply } from "../../../../lib/line-notify";
import { getRuntimeConfig } from "../../../../lib/sheets-db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await requireStaff(req))) return unauthorizedResponse();

  try {
    const body = await req.json();
    const { lineUserId, orderId, message } = body;

    const trimmedLineId = (lineUserId || "").trim();
    const textMsg = (message || "").trim();

    if (!trimmedLineId) {
      return NextResponse.json(
        { ok: false, error: "ลูกค้ารายนี้ไม่มี lineUserId จึงไม่สามารถส่งข้อความผ่าน LINE OA ได้" },
        { status: 400 }
      );
    }

    if (!textMsg) {
      return NextResponse.json(
        { ok: false, error: "กรุณาระบุข้อความที่ต้องการส่ง" },
        { status: 400 }
      );
    }

    const cfg = getRuntimeConfig();
    const token =
      cfg.lineChannelAccessToken ||
      process.env.LINE_CHANNEL_ACCESS_TOKEN ||
      "";

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "ไม่ได้ตั้งค่า LINE Channel Access Token" },
        { status: 500 }
      );
    }

    const prefix = orderId ? `🔔 แจ้งเตือนเกี่ยวกับคำสั่งซื้อ #${orderId}:\n\n` : "🍈 ข้อความจากแอดมินร้านทุเรียนวินคิน:\n\n";

    await pushLineMessage(
      trimmedLineId,
      [
        {
          type: "text",
          text: `${prefix}${textMsg}`,
          quickReply: buildMainQuickReply(),
        },
      ],
      token
    );

    return NextResponse.json({ ok: true, message: "ส่งข้อความเข้า LINE ลูกค้าเรียบร้อยแล้ว" });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || String(err) },
      { status: 500 }
    );
  }
}
