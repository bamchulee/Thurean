import fs from "fs";
import path from "path";
import sharp from "sharp";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin, unauthorizedResponse } from "../../../../lib/admin-auth";
import { getRuntimeConfig, getSettingsBundle, loadAppSettings } from "../../../../lib/sheets-db";

export const dynamic = "force-dynamic";

type RichButton = { type: "message" | "uri"; value: string };
type RichMenuSetting = { chatBarText?: string; buttons?: RichButton[] };

// ปุ่มเริ่มต้นตรงกับรูป public/line-richmenu.jpg (3 คอลัมน์ x 2 แถว เรียงซ้าย→ขวา บน→ล่าง)
const DEFAULT_BUTTONS: RichButton[] = [
  { type: "message", value: "สั่งซื้อ" },
  { type: "message", value: "เช็กสต็อก" },
  { type: "message", value: "โปรโมชั่น" },
  { type: "message", value: "ดูไลฟ์สด" },
  { type: "message", value: "แจ้งเคลม" },
  { type: "message", value: "เพิ่มเติม" },
];

const W = 2500;
const H = 1686;

function areas(buttons: RichButton[]) {
  const colW = [833, 833, 834];
  const rowH = [843, 843];
  return buttons.slice(0, 6).map((b, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = colW.slice(0, col).reduce((a, c) => a + c, 0);
    const y = row * rowH[0];
    const value = b.value.trim();
    const action =
      b.type === "uri"
        ? { type: "uri", label: value.slice(0, 20), uri: value }
        : { type: "message", label: value.slice(0, 20), text: value.slice(0, 300) };
    return { bounds: { x, y, width: colW[col], height: rowH[row] }, action };
  });
}

async function prepareImage(input?: string | Buffer): Promise<{ buf: Buffer; type: "image/jpeg" }> {
  let rawBuf: Buffer;
  if (Buffer.isBuffer(input)) {
    rawBuf = input;
  } else if (typeof input === "string" && input.startsWith("data:")) {
    const m = input.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
    if (!m) throw new Error("รูปแบบภาพ Data URL ไม่ถูกต้อง");
    rawBuf = Buffer.from(m[1], "base64");
  } else {
    const jpg = path.join(process.cwd(), "public", "line-richmenu.jpg");
    const png = path.join(process.cwd(), "public", "line-richmenu.png");
    if (fs.existsSync(jpg)) rawBuf = fs.readFileSync(jpg);
    else if (fs.existsSync(png)) rawBuf = fs.readFileSync(png);
    else throw new Error("ไม่พบไฟล์รูปภาพ Rich Menu ใน public/");
  }

  // ปรับขนาดเป็น 2500 x 1686 เสมอตามข้อกำหนดของ LINE และบีบอัดเป็น JPEG ขนาด < 1MB
  let quality = 90;
  let processed = await sharp(rawBuf)
    .resize(W, H, { fit: "fill" })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

  while (processed.length > 980 * 1024 && quality > 35) {
    quality -= 10;
    processed = await sharp(rawBuf)
      .resize(W, H, { fit: "fill" })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
  }

  if (processed.length > 1024 * 1024) {
    throw new Error("รูปภาพมีขนาดเกิน 1 MB (ข้อจำกัดของ LINE)");
  }

  // บันทึกเก็บเป็น line-richmenu.jpg ล่าสุด (ถ้าทำได้)
  try {
    const outJpg = path.join(process.cwd(), "public", "line-richmenu.jpg");
    fs.writeFileSync(outJpg, processed);
  } catch {
    // Vercel serverless filesystem read-only เป็นปกติ
  }

  return { buf: processed, type: "image/jpeg" };
}

async function line(token: string, url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`${url.split("/v2/")[1] || url} → ${res.status} ${await res.text()}`);
  return res;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return unauthorizedResponse();
  try {
    const token = getRuntimeConfig().lineChannelAccessToken;
    let defaultRichMenuId = "";
    if (token) {
      try {
        const res = await line(token, "https://api.line.me/v2/bot/user/all/richmenu");
        const json = (await res.json()) as { richMenuId?: string };
        defaultRichMenuId = json.richMenuId || "";
      } catch {
        defaultRichMenuId = "";
      }
    }
    return NextResponse.json({
      ok: true,
      defaultRichMenuId,
      previewUrl: "/line-richmenu.jpg",
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return unauthorizedResponse();
  try {
    await loadAppSettings(true);
    const token = getRuntimeConfig().lineChannelAccessToken;
    if (!token) return NextResponse.json({ ok: false, error: "ยังไม่ได้ใส่ LINE Channel access token" }, { status: 400 });

    let buttonsInput: RichButton[] | undefined;
    let chatBarTextInput: string | undefined;
    let imageInput: string | Buffer | undefined;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("image") || formData.get("file");
      if (file && typeof file === "object" && "arrayBuffer" in file) {
        const ab = await (file as Blob).arrayBuffer();
        imageInput = Buffer.from(ab);
      }
      const rawButtons = formData.get("buttons");
      if (typeof rawButtons === "string") {
        try {
          buttonsInput = JSON.parse(rawButtons);
        } catch {}
      }
      const rawChatBarText = formData.get("chatBarText");
      if (typeof rawChatBarText === "string") {
        chatBarTextInput = rawChatBarText;
      }
    } else {
      const body = (await req.json().catch(() => ({}))) as RichMenuSetting & { image?: string };
      buttonsInput = body.buttons;
      chatBarTextInput = body.chatBarText;
      imageInput = body.image;
    }

    const saved = (getSettingsBundle().settings.richMenu || {}) as RichMenuSetting;
    const buttons = (buttonsInput || saved.buttons || DEFAULT_BUTTONS).map((b, i) => ({
      type: b.type === "uri" ? ("uri" as const) : ("message" as const),
      value: String(b.value || DEFAULT_BUTTONS[i]?.value || "").trim(),
    }));
    if (buttons.length !== 6 || buttons.some((b) => !b.value)) throw new Error("ต้องตั้งครบ 6 ปุ่ม และทุกปุ่มต้องมีข้อความหรือลิงก์");
    if (buttons.some((b) => b.type === "uri" && !/^https:\/\//.test(b.value))) throw new Error("ปุ่มแบบลิงก์ต้องขึ้นต้นด้วย https://");
    const chatBarText = String(chatBarTextInput || saved.chatBarText || "เมนูทุเรียนวินคิน").slice(0, 14);

    const image = await prepareImage(imageInput);

    // เมนูหลักเดิม (ลบทิ้งหลังตั้งเมนูใหม่สำเร็จ)
    let oldId = "";
    try {
      oldId = ((await (await line(token, "https://api.line.me/v2/bot/user/all/richmenu")).json()) as { richMenuId?: string }).richMenuId || "";
    } catch {
      oldId = "";
    }

    // 1. สร้าง Rich Menu spec
    const created = (await (
      await line(token, "https://api.line.me/v2/bot/richmenu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: { width: W, height: H }, selected: true, name: "DurianWinkin menu", chatBarText, areas: areas(buttons) }),
      })
    ).json()) as { richMenuId: string };
    const id = created.richMenuId;

    // 2. อัปโหลดรูปภาพ
    await line(token, `https://api-data.line.me/v2/bot/richmenu/${encodeURIComponent(id)}/content`, {
      method: "POST",
      headers: { "Content-Type": image.type },
      body: new Uint8Array(image.buf),
    });

    // 3. ตั้งเป็น Default Rich Menu สำหรับผู้ใช้ทุกคน
    await line(token, `https://api.line.me/v2/bot/user/all/richmenu/${encodeURIComponent(id)}`, { method: "POST" });

    // 4. ลบเมนูเดิมเพื่อไม่ให้เปลืองโควตา
    if (oldId && oldId !== id) {
      await line(token, `https://api.line.me/v2/bot/richmenu/${encodeURIComponent(oldId)}`, { method: "DELETE" }).catch(() => null);
    }

    return NextResponse.json({ ok: true, richMenuId: id, message: "ติดตั้งเมนู Rich Menu 6 ปุ่มใน LINE OA เรียบร้อยแล้ว!" });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
