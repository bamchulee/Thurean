import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSuperAdmin, unauthorizedResponse } from "../../../../lib/admin-auth";
import { GOOGLE_LOGIN_ENABLED } from "../../../../lib/feature-flags";
import { getBankAccount, getRuntimeConfig, getSettingsBundle, loadAppSettings, saveAppSettings, saveCustomColumns, writeSettingsSheet } from "../../../../lib/sheets-db";

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
  { key: "shopBankName", group: "pay", label: "ธนาคาร", secret: false, env: "SHOP_BANK_NAME" },
  { key: "shopAccountNumber", group: "pay", label: "เลขบัญชี", secret: false, env: "SHOP_ACCOUNT_NUMBER" },
  { key: "shopAccountName", group: "pay", label: "ชื่อบัญชี", secret: false, env: "SHOP_ACCOUNT_NAME" },
  { key: "shopPromptPay", group: "pay", label: "พร้อมเพย์ (เบอร์/เลขบัตร)", secret: false, env: "SHOP_PROMPTPAY" },
  { key: "publicBaseUrl", group: "web", label: "ที่อยู่เว็บ (Base URL)", secret: false, env: "NEXT_PUBLIC_BASE_URL" },
  { key: "liveStreamPlatform", group: "web", label: "แพลตฟอร์มไลฟ์สด", secret: false, env: "LINE_LIVE_PLATFORM" },
  { key: "liveStreamUrl", group: "web", label: "ลิงก์ไลฟ์สด", secret: false, env: "LINE_LIVE_URL" },
  { key: "liveStreamNote", group: "web", label: "ข้อความไลฟ์สด", secret: false, env: "LINE_LIVE_NOTE" },
] as const;

// Google login ปิดไว้ก่อน — ไม่โชว์/ไม่รับช่อง Google Client ID / secret
const VISIBLE_FIELDS = SETTING_FIELDS.filter((f) => GOOGLE_LOGIN_ENABLED || !f.key.startsWith("google"));

const EDITABLE = new Set<string>([...VISIBLE_FIELDS.map((f) => f.key), "isLiveNow", "richMenu"]);

function mask(v: string) {
  if (!v) return "";
  return v.length <= 8 ? "••••••••" : `${v.slice(0, 4)}••••••••${v.slice(-4)}`;
}

const GROUP_LABEL: Record<string, string> = { line: "LINE OA", login: "เข้าสู่ระบบ", pay: "บัญชีรับเงิน", web: "เว็บ & ไลฟ์" };
const SOURCE_LABEL: Record<string, string> = { admin: "ตั้งจากหน้าแอดมิน", env: "Vercel", default: "ค่าเริ่มต้น", none: "ยังไม่ตั้ง" };

function sourceOf(key: string, env: string): string {
  const saved = getSettingsBundle().settings[key];
  const value = effective(key);
  return saved ? "admin" : process.env[env] ? "env" : value ? "default" : "none";
}

/** แถวสำหรับแท็บ Settings ในชีต — ค่าลับปิดบังเสมอ */
function settingsSheetRows() {
  type Row = { group: string; label: string; value: string; source: string; key: string };
  const rows: Row[] = VISIBLE_FIELDS.map((f) => {
    const value = effective(f.key);
    return {
      group: GROUP_LABEL[f.group] || f.group,
      label: f.label,
      value: f.secret ? mask(value) : value,
      source: SOURCE_LABEL[sourceOf(f.key, f.env)],
      key: f.key,
    };
  });
  rows.push({ group: GROUP_LABEL.web, label: "กำลังไลฟ์อยู่", value: getRuntimeConfig().isLiveNow ? "ใช่" : "ไม่", source: "", key: "isLiveNow" });
  const menu = getSettingsBundle().settings.richMenu as { chatBarText?: string; buttons?: { type: string; value: string }[] } | undefined;
  if (menu?.buttons) {
    rows.push({ group: "Rich menu", label: "ข้อความแถบเมนู", value: menu.chatBarText || "", source: SOURCE_LABEL.admin, key: "richMenu.chatBarText" });
    menu.buttons.forEach((b, i) =>
      rows.push({ group: "Rich menu", label: `ปุ่ม ${i + 1}`, value: `${b.type === "uri" ? "ลิงก์" : "ข้อความ"}: ${b.value}`, source: SOURCE_LABEL.admin, key: `richMenu.${i + 1}` })
    );
  }
  return rows;
}

function effective(key: string): string {
  const bank = getBankAccount();
  const bankKeys: Record<string, string> = { shopBankName: bank.bank, shopAccountNumber: bank.number, shopAccountName: bank.name, shopPromptPay: bank.promptPay };
  if (key in bankKeys) return bankKeys[key];
  const cfg = getRuntimeConfig() as Record<string, unknown>;
  const v = cfg[key];
  return typeof v === "string" ? v : "";
}

export async function GET(req: NextRequest) {
  if (!(await requireSuperAdmin(req))) return unauthorizedResponse();
  await loadAppSettings(true);
  const { settings, customColumns, schema, loadedAt } = getSettingsBundle();
  const fields = VISIBLE_FIELDS.map((f) => {
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
  if (!(await requireSuperAdmin(req))) return unauthorizedResponse();
  try {
    const body = (await req.json()) as {
      action: "save" | "columns" | "syncSheet";
      values?: Record<string, unknown>;
      table?: string;
      columns?: string[];
    };
    if (body.action === "syncSheet") {
      await loadAppSettings(true);
      await writeSettingsSheet(settingsSheetRows());
      return NextResponse.json({ ok: true, message: "อัปเดตแท็บ Settings ในไฟล์ USER แล้ว" });
    }
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
    // สรุปลงแท็บ Settings (ไม่ทำให้การบันทึกล้มถ้าเขียนชีตไม่สำเร็จ)
    await writeSettingsSheet(settingsSheetRows()).catch((err) => console.warn("[settings] sheet mirror failed", String(err)));
    return NextResponse.json({ ok: true, saved: Object.keys(values) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
