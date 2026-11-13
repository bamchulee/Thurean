import fs from "fs";
import path from "path";
import crypto from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getWritableDataDir } from "../../../../lib/storage-dir";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string" || !(file instanceof Blob)) {
      return NextResponse.json(
        { ok: false, error: "กรุณาเลือกไฟล์รูปภาพ" },
        { status: 400 }
      );
    }

    const type = file.type;
    let ext = ".jpg";
    if (type === "image/png") ext = ".png";
    else if (type === "image/webp") ext = ".webp";
    else if (type === "image/jpeg" || type === "image/jpg") ext = ".jpg";
    else {
      return NextResponse.json(
        { ok: false, error: "รองรับเฉพาะไฟล์รูปภาพ JPG, PNG หรือ WEBP" },
        { status: 400 }
      );
    }

    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: "ขนาดไฟล์รูปภาพต้องไม่เกิน 5 MB" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const randomSuffix = crypto.randomBytes(6).toString("hex");
    const filename = `avatar_${Date.now()}_${randomSuffix}${ext}`;
    const dir = getWritableDataDir("avatars");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const targetPath = path.join(dir, filename);
    fs.writeFileSync(targetPath, buffer);

    const publicUrl = `/api/avatars/${filename}`;

    return NextResponse.json({
      ok: true,
      url: publicUrl,
      filename,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `เกิดข้อผิดพลาดในการอัปโหลดรูป: ${String(err)}` },
      { status: 500 }
    );
  }
}
