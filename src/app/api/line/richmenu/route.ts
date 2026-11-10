import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAdminRequest, unauthorizedResponse } from "../../../../lib/admin-auth";
import { getRuntimeConfig } from "../../../../lib/sheets-db";

export const dynamic = "force-dynamic";

async function deployDefaultRichMenu(channelAccessToken: string) {
  const imgPath = path.join(process.cwd(), "public", "line-richmenu.png");
  if (!fs.existsSync(imgPath)) {
    throw new Error("ไม่พบไฟล์ public/line-richmenu.png");
  }
  const imgBuffer = fs.readFileSync(imgPath);

  const menuSpec = {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: "DurianWinkin 6-Button Menu",
    chatBarText: "เมนูวินคิน",
    areas: [
      {
        bounds: { x: 0, y: 0, width: 833, height: 843 },
        action: { type: "message", text: "สั่งซื้อ" },
      },
      {
        bounds: { x: 833, y: 0, width: 833, height: 843 },
        action: { type: "message", text: "เช็กสต็อก" },
      },
      {
        bounds: { x: 1666, y: 0, width: 834, height: 843 },
        action: { type: "message", text: "โปรโมชั่น" },
      },
      {
        bounds: { x: 0, y: 843, width: 833, height: 843 },
        action: { type: "message", text: "ดูไลฟ์สด" },
      },
      {
        bounds: { x: 833, y: 843, width: 833, height: 843 },
        action: { type: "message", text: "แจ้งเคลม" },
      },
      {
        bounds: { x: 1666, y: 843, width: 834, height: 843 },
        action: { type: "message", text: "เพิ่มเติม" },
      },
    ],
  };

  // 1. Create Rich Menu object
  const createRes = await fetch("https://api.line.me/v2/bot/richmenu", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify(menuSpec),
  });
  const createJson = (await createRes.json()) as {
    richMenuId?: string;
    message?: string;
    details?: unknown[];
  };
  if (!createRes.ok || !createJson.richMenuId) {
    throw new Error(
      `สร้าง Rich Menu ไม่สำเร็จ: ${JSON.stringify(createJson)}`
    );
  }
  const richMenuId = createJson.richMenuId;

  // 2. Upload PNG artwork
  const uploadRes = await fetch(
    `https://api-data.line.me/v2/bot/richmenu/${encodeURIComponent(richMenuId)}/content`,
    {
      method: "POST",
      headers: {
        "Content-Type": "image/png",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: imgBuffer,
    }
  );
  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`อัปโหลดรูป Rich Menu ไม่สำเร็จ: ${errText}`);
  }

  // 3. Set as default Rich Menu for all users
  const defRes = await fetch(
    `https://api.line.me/v2/bot/user/all/richmenu/${encodeURIComponent(richMenuId)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${channelAccessToken}` },
    }
  );
  if (!defRes.ok) {
    const errText = await defRes.text();
    throw new Error(`ตั้งค่า Default Rich Menu ไม่สำเร็จ: ${errText}`);
  }

  return richMenuId;
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  try {
    const cfg = getRuntimeConfig();
    if (!cfg.lineChannelAccessToken) {
      return NextResponse.json(
        { ok: false, error: "ยังไม่ได้ตั้งค่า LINE Channel Access Token" },
        { status: 400 }
      );
    }

    const richMenuId = await deployDefaultRichMenu(cfg.lineChannelAccessToken);
    return NextResponse.json({
      ok: true,
      richMenuId,
      message: "ติดตั้งเมนู Rich Menu 4 ปุ่มใน LINE OA เรียบร้อยแล้ว!",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
