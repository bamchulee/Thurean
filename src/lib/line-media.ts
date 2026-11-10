// ============================================================
// LINE Content API Downloader (Payment Slips & Claim Photos)
// ============================================================
import fs from "fs";
import path from "path";
import { getWritableDataDir } from "./storage-dir";

export interface DownloadedLineMedia {
  ok: boolean;
  filename?: string;
  apiPath?: string;
  sizeBytes?: number;
  contentType?: string;
  reason?: string;
}

/**
 * Fetches an image binary uploaded by a customer in LINE chat, validates basic image headers,
 * and saves it safely inside `data/slips/` served by `/api/slips/[filename]`.
 */
export async function downloadAndVerifyLineImage(
  messageId: string,
  channelAccessToken: string,
  prefix = "slip"
): Promise<DownloadedLineMedia> {
  if (!messageId || !channelAccessToken) {
    return { ok: false, reason: "Missing messageId or channel token" };
  }

  try {
    const res = await fetch(
      `https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`,
      {
        headers: { Authorization: `Bearer ${channelAccessToken}` },
      }
    );

    if (!res.ok) {
      return { ok: false, reason: `LINE Content API ${res.status}` };
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const arrBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrBuf);

    if (buf.length < 256) {
      return { ok: false, reason: "ไฟล์ภาพมีขนาดเล็กผิดปกติ" };
    }

    // Validate common image magic bytes (JPEG, PNG, WebP)
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
    const isPng =
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    const isWebp = buf.slice(0, 4).toString("ascii") === "RIFF";
    if (!isJpeg && !isPng && !isWebp) {
      return { ok: false, reason: "รูปแบบไฟล์ไม่ใช่ภาพสลิปที่รองรับ (JPG/PNG/WebP)" };
    }

    const ext = isPng ? "png" : isWebp ? "webp" : "jpg";
    const safeMsgId = messageId.replace(/[^a-zA-Z0-9_-]/g, "");
    const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "");
    const filename = `${safePrefix}-${safeMsgId}.${ext}`;

    const slipsDir = getWritableDataDir("slips");
    fs.writeFileSync(path.join(slipsDir, filename), buf);

    return {
      ok: true,
      filename,
      apiPath: `/api/slips/${filename}`,
      sizeBytes: buf.length,
      contentType,
    };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}
