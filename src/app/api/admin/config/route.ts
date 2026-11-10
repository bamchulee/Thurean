import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createAdminSessionToken,
  getDataSourceMode,
  getRuntimeConfig,
  saveRuntimeConfig,
  syncLocalDataToGoogleSheet,
  testGoogleSheetsConnection,
} from "../../../../lib/sheets-db";
import {
  ADMIN_COOKIE_NAME,
  isAdminRequest,
  unauthorizedResponse,
} from "../../../../lib/admin-auth";
import { isCloudServerless } from "../../../../lib/storage-dir";

export const dynamic = "force-dynamic";

function maskSecret(val?: string) {
  if (!val) return "";
  if (val.length <= 8) return "••••••••";
  return val.slice(0, 4) + "••••••••" + val.slice(-4);
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  const cfg = getRuntimeConfig();
  let appsScriptCode = "";
  try {
    const gsPath = path.join(process.cwd(), "google-apps-script", "Code.gs");
    if (fs.existsSync(gsPath)) {
      appsScriptCode = fs.readFileSync(gsPath, "utf-8");
    }
  } catch {
    appsScriptCode = "";
  }

  return NextResponse.json({
    ok: true,
    mode: getDataSourceMode(),
    isCloudServerless: isCloudServerless(),
    config: {
      googleSheetsWebAppUrl: cfg.googleSheetsWebAppUrl || "",
      googleSheetViewUrl: cfg.googleSheetViewUrl || "",
      hasLineToken: Boolean(cfg.lineChannelAccessToken),
      lineTokenMasked: maskSecret(cfg.lineChannelAccessToken),
      lineAdminUserId: cfg.lineAdminUserId || "",
      lineLiffId: cfg.lineLiffId || "",
      publicBaseUrl: cfg.publicBaseUrl || "",
      liveStreamPlatform: cfg.liveStreamPlatform || "",
      liveStreamUrl: cfg.liveStreamUrl || "",
      liveStreamNote: cfg.liveStreamNote || "",
      isLiveNow: Boolean(cfg.isLiveNow),
      lastSyncedAt: cfg.lastSyncedAt || null,
    },
    appsScriptCode,
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  try {
    const body = (await req.json()) as {
      action?: "save" | "test" | "sync" | "disconnect";
      googleSheetsWebAppUrl?: string;
      googleSheetViewUrl?: string;
      lineChannelAccessToken?: string;
      lineAdminUserId?: string;
      lineLiffId?: string;
      adminPin?: string;
      publicBaseUrl?: string;
      liveStreamPlatform?: string;
      liveStreamUrl?: string;
      liveStreamNote?: string;
      isLiveNow?: boolean;
    };

    const action = body.action || "save";

    if (action === "disconnect") {
      saveRuntimeConfig({
        googleSheetsWebAppUrl: "",
        googleSheetViewUrl: "",
      });
      return NextResponse.json({
        ok: true,
        mode: getDataSourceMode(),
        message: "สลับกลับมาใช้ฐานข้อมูลในเครื่อง (Local Mode) เรียบร้อยแล้ว",
      });
    }

    if (action === "test") {
      const targetUrl =
        body.googleSheetsWebAppUrl?.trim() ||
        getRuntimeConfig().googleSheetsWebAppUrl;
      if (!targetUrl) {
        return NextResponse.json(
          { ok: false, error: "กรุณาระบุ Google Apps Script Web App URL ก่อนทดสอบ" },
          { status: 400 }
        );
      }
      if (!targetUrl.startsWith("https://script.google.com/")) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "URL ต้องขึ้นต้นด้วย https://script.google.com/... (ไม่ใช่ลิงก์เปิดดูชีตโดยตรง — ต้อง Deploy เป็น Web App ก่อนครับ)",
          },
          { status: 400 }
        );
      }
      const testRes = await testGoogleSheetsConnection(targetUrl);
      return NextResponse.json({
        ok: true,
        ...testRes,
        message: "เชื่อมต่อ Google Sheet สำเร็จ!",
      });
    }

    if (action === "sync") {
      const targetUrl =
        body.googleSheetsWebAppUrl?.trim() ||
        getRuntimeConfig().googleSheetsWebAppUrl;
      if (!targetUrl) {
        return NextResponse.json(
          { ok: false, error: "กรุณาบันทึก Web App URL ก่อนซิงก์ข้อมูล" },
          { status: 400 }
        );
      }
      const syncRes = await syncLocalDataToGoogleSheet(targetUrl);
      return NextResponse.json({
        ok: true,
        ...syncRes,
        message: `ส่งข้อมูลตั้งต้นไปยัง Google Sheet สำเร็จ (${syncRes.syncedItems} รายการ)`,
      });
    }

    // Save config
    const updated = saveRuntimeConfig({
      googleSheetsWebAppUrl: body.googleSheetsWebAppUrl,
      googleSheetViewUrl: body.googleSheetViewUrl,
      lineChannelAccessToken:
        body.lineChannelAccessToken && !body.lineChannelAccessToken.includes("••••")
          ? body.lineChannelAccessToken
          : undefined,
      lineAdminUserId: body.lineAdminUserId,
      lineLiffId: body.lineLiffId,
      adminPin: body.adminPin,
      publicBaseUrl: body.publicBaseUrl,
      liveStreamPlatform: body.liveStreamPlatform,
      liveStreamUrl: body.liveStreamUrl,
      liveStreamNote: body.liveStreamNote,
      isLiveNow: body.isLiveNow,
    });

    const res = NextResponse.json({
      ok: true,
      mode: getDataSourceMode(),
      message: "บันทึกการตั้งค่าเรียบร้อยแล้ว",
    });

    // If PIN changed, refresh session cookie
    if (body.adminPin && body.adminPin.trim().length >= 4) {
      const newToken = createAdminSessionToken(updated.adminPin || "2824");
      res.cookies.set(ADMIN_COOKIE_NAME, newToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return res;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
