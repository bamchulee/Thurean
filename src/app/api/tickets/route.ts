import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAllDatabase, getRuntimeConfig } from "../../../lib/sheets-db";
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
    // โหลดชีตก่อน: รหัสกลุ่มแอดมินที่ผูกไว้มากับข้อมูลชีต
    await getAllDatabase().catch(() => undefined);
    const cfg = getRuntimeConfig();
    const token = cfg.lineChannelAccessToken;

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
        message: String(message).trim().slice(0, 1000),
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
