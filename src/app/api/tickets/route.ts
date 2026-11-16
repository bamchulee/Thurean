import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRuntimeConfig } from "../../../lib/sheets-db";
import { buildTicketAlertForAdmin, pushLineMessage } from "../../../lib/line-notify";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerName, phone, orderId, message, lineUserId, source } = body;

    if (!message || !message.trim()) {
      return NextResponse.json(
        { ok: false, error: "กรุณาระบุข้อความที่ต้องการสอบถาม" },
        { status: 400 }
      );
    }

    const ticketId = `TCK-${Math.floor(100000 + Math.random() * 900000)}`;
    const cfg = getRuntimeConfig();
    const token =
      cfg.lineChannelAccessToken ||
      process.env.LINE_CHANNEL_ACCESS_TOKEN ||
      "PdFpuOJEzMXiSaUJDIssLxWbbXYtaUE0/e6/1IVXsGDWtu+MpuSsxtx+p2JAZYnh5L68apEKj1Pr8ceQ3UCv9nONR954SD4V8acz6dNxKoghEA0GKanpmzY+p+bM82oxNGaC2Z+LqK1HBSa+Rt/GPgdB04t89/1O/w1cDnyilFU=";

    const publicBaseUrl =
      cfg.publicBaseUrl ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "https://durianwinkin.vercel.app";

    const ticketAlert = buildTicketAlertForAdmin(
      {
        ticketId,
        customerName: (customerName || "").trim() || "ลูกค้า (ผ่านเว็บไซต์)",
        phone: (phone || "").trim() || undefined,
        orderId: (orderId || "").trim() || undefined,
        lineUserId: (lineUserId || "").trim() || undefined,
        message: message.trim(),
        source: source || "web-tracking",
        createdAt: new Date().toLocaleString("th-TH"),
      },
      publicBaseUrl
    );

    const adminTargets: string[] = [];
    if (cfg.lineAdminGroupId) adminTargets.push(cfg.lineAdminGroupId);
    if (cfg.lineAdminUserId && !adminTargets.includes(cfg.lineAdminUserId)) {
      adminTargets.push(cfg.lineAdminUserId);
    }

    let alertSent = false;
    for (const tId of adminTargets) {
      try {
        const res = await pushLineMessage(tId, ticketAlert, token);
        if (res.sent) alertSent = true;
      } catch (pushErr) {
        console.warn("Failed to push ticket alert to:", tId, pushErr);
      }
    }

    return NextResponse.json({
      ok: true,
      ticketId,
      alertSent,
      message: "ส่งข้อความถึงทีมงานแอดมินเรียบร้อยแล้ว",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
