import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getWritableDataDir } from "../../../../lib/storage-dir";
import { getRuntimeConfig } from "../../../../lib/sheets-db";
import { requireStaff } from "../../../../lib/admin-auth";
import { verifySlipSignature } from "../../../../lib/slip-link";

export const dynamic = "force-dynamic";

// รูปสลิป/หลักฐานมีข้อมูลการเงินของลูกค้า: เปิดได้เฉพาะพนักงานที่ล็อกอิน หรือลิงก์ที่มีลายเซ็นจากการ์ด LINE
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await context.params;
    const safeName = path.basename(decodeURIComponent(filename));
    if (!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(safeName)) {
      return NextResponse.json({ ok: false, error: "Invalid filename" }, { status: 400 });
    }
    const sp = req.nextUrl.searchParams;
    const allowed = verifySlipSignature(safeName, sp.get("exp"), sp.get("sig")) || (await requireStaff(req));
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "ไม่มีสิทธิ์ดูรูปนี้" }, { status: 401 });
    }

    const filePath = path.join(getWritableDataDir("slips"), safeName);
    if (!fs.existsSync(filePath)) {
      // บน Vercel ไฟล์อยู่แค่ใน /tmp ของ instance ที่รับรูป — instance อื่นดึงรูปจาก LINE ใหม่
      // (ชื่อไฟล์ = <slip|claim>-<LINE messageId>.<ext>)
      const messageId = safeName.match(/^(?:slip|claim)-(\d+)\./)?.[1];
      const token = getRuntimeConfig().lineChannelAccessToken;
      if (messageId && token) {
        const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          try {
            fs.writeFileSync(filePath, buf);
          } catch {
            // แคชไม่ได้ก็ไม่เป็นไร
          }
          return new NextResponse(new Uint8Array(buf), {
            status: 200,
            headers: { "Content-Type": res.headers.get("content-type") || "image/jpeg", "Cache-Control": "private, max-age=3600" },
          });
        }
      }
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const buf = fs.readFileSync(filePath);
    const ext = path.extname(safeName).toLowerCase();
    const contentType =
      ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
