import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin, unauthorizedResponse } from "../../../../lib/admin-auth";
import { getRuntimeConfig, getSettingsBundle, loadAppSettings, saveAppSettings, saveCustomColumns } from "../../../../lib/sheets-db";

export const dynamic = "force-dynamic";

// ค่าที่แก้ได้จากหน้าแอดมิน (เก็บถาวรใน Apps Script) — secret: ส่งกลับแค่แบบปิดบัง แก้ได้อย่างเดียว อ่านค่าเต็มไม่ได้
const SETTING_FIELDS = [
  { key: "lineOaId", group: "line", label: "LINE OA ID", secret: false, env: "LINE_OA_ID" },
  { key: "lineChannelAccessToken", group: "line", label: "Channel access token (Messaging API)", secret: true, env: "LINE_CHANNEL_ACCESS_TOKEN" },
  { key: "lineChannelSecret", group: "line", label: "Channel secret (Messaging API)", secret: true, env: "LINE_CHANNEL_SECRET" },
  { key: "lineAdminGroupId", group: "line", label: "กลุ่ม LINE แอดมิน (Group ID)", secret: false, env: "LINE_ADMIN_GROUP_ID" },
  { key: "lineAdminUserId", group: "line", label: "LINE userId เจ้าของร้าน", secret: false, env: "LINE_ADMIN_USER_ID" },
  { key: "lineLoginChannelId", group: "login", label: "LINE Login Channel ID", secret: false, env: "LINE_LOGIN_CHANNEL_ID" },
  { key: "lineLoginChannelSecret", group: "login", label: "LINE Login Channel secret", secret: true, env: "LINE_LOGIN_CHANNEL_SECRET" },
  { key: "lineLiffId", group: "login", label: "LIFF ID", secret: false, env: "NEXT_PUBLIC_LINE_LIFF_ID" },
  { key: "googleClientId", group: "login", label: "Google Client ID", secret: false, env: "GOOGLE_CLIENT_ID" },
  { key: "googleClientSecret", group: "login", label: "Google Client secret", secret: true, env: "GOOGLE_CLIENT_SECRET" },
  { key: "publicBaseUrl", group: "web", label: "ที่อยู่เว็บ (Base URL)", secret: false, env: "NEXT_PUBLIC_BASE_URL" },
  { key: "liveStreamPlatform", group: "web", label: "แพลตฟอร์มไลฟ์สด", secret: false, env: "LINE_LIVE_PLATFORM" },
  { key: "liveStreamUrl", group: "web", label: "ลิงก์ไลฟ์สด", secret: false, env: "LINE_LIVE_URL" },
  { key: "liveStreamNote", group: "web", label: "ข้อความไลฟ์สด", secret: false, env: "LINE_LIVE_NOTE" },
] as const;

const EDITABLE = new Set<string>([...SETTING_FIELDS.map((f) => f.key), "isLiveNow", "richMenu"]);

function mask(v: string) {
  if (!v) return "";
  return v.length <= 8 ? "••••••••" : `${v.slice(0, 4)}••••••••${v.slice(-4)}`;
}

function effective(key: string): string {
  const cfg = getRuntimeConfig() as Record<string, unknown>;
  const v = cfg[key];
  return typeof v === "string" ? v : "";
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return unauthorizedResponse();
  await loadAppSettings(true);
  const { settings, customColumns, schema, loadedAt } = getSettingsBundle();
  const fields = SETTING_FIELDS.map((f) => {
    const saved = typeof settings[f.key] === "string" ? (settings[f.key] as string) : "";
    const value = effective(f.key);
    return {
      key: f.key,
      group: f.group,
      label: f.label,
      secret: f.secret,
      // ค่าเต็มส่งเฉพาะช่องที่ไม่ใช่ความลับ
      value: f.secret ? "" : value,
      masked: f.secret ? mask(value) : "",
      hasValue: Boolean(value),
      source: saved ? "admin" : process.env[f.env] ? "env" : value ? "default" : "none",
    };
  });
  return NextResponse.json({
    ok: true,
    connected: Boolean(process.env.GOOGLE_SHEETS_WEBAPP_URL && process.env.GOOGLE_SHEETS_API_KEY),
    sheetsWebAppUrl: getRuntimeConfig().googleSheetsWebAppUrl || "",
    userSheetUrl: getRuntimeConfig().userSheetViewUrl || "",
    thureanSheetUrl: getRuntimeConfig().thureanSheetViewUrl || "",
    isLiveNow: Boolean(getRuntimeConfig().isLiveNow),
    fields,
    richMenu: settings.richMenu || null,
    schema,
    customColumns,
    loadedAt,
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return unauthorizedResponse();
  try {
    const body = (await req.json()) as {
      action: "save" | "columns";
      values?: Record<string, unknown>;
      table?: string;
      columns?: string[];
    };
    if (body.action === "columns") {
      if (!body.table) return NextResponse.json({ ok: false, error: "ไม่ระบุตาราง" }, { status: 400 });
      const res = await saveCustomColumns(body.table, body.columns || []);
      return NextResponse.json({ ok: true, message: res?.message || "บันทึกคอลัมน์แล้ว" });
    }
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body.values || {})) {
      if (!EDITABLE.has(k)) continue;
      if (k === "richMenu") values[k] = v && typeof v === "object" ? v : null;
      else if (k === "isLiveNow") values[k] = v ? "true" : "false";
      else values[k] = typeof v === "string" ? v.trim() : v === null ? null : String(v ?? "");
    }
    if (Object.keys(values).length === 0) return NextResponse.json({ ok: false, error: "ไม่มีค่าที่เปลี่ยน" }, { status: 400 });
    await saveAppSettings(values);
    return NextResponse.json({ ok: true, saved: Object.keys(values) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
