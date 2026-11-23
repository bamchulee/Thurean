import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireStaff, requireSuperAdmin, unauthorizedResponse } from "../../../../lib/admin-auth";
import { pushLineMessage } from "../../../../lib/line-notify";
import { GOOGLE_LOGIN_ENABLED } from "../../../../lib/feature-flags";
import { getRuntimeConfig, loadAppSettings, testGoogleSheetsConnection } from "../../../../lib/sheets-db";

export const dynamic = "force-dynamic";

type Check = { id: string; label: string; ok: boolean; detail: string; ms?: number };

async function timed<T>(fn: () => Promise<T>): Promise<{ value?: T; error?: string; ms: number }> {
  const t0 = Date.now();
  try {
    return { value: await fn(), ms: Date.now() - t0 };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err), ms: Date.now() - t0 };
  }
}

// ปุ่ม "ทดสอบระบบ": เช็กทุกการเชื่อมต่อที่ร้านใช้ (ไม่แก้ข้อมูลอะไร)
export async function GET(req: NextRequest) {
  if (!(await requireStaff(req))) return unauthorizedResponse();
  await loadAppSettings(true);
  const cfg = getRuntimeConfig();
  const checks: Check[] = [];

  const sheets = await timed(() => testGoogleSheetsConnection(cfg.googleSheetsWebAppUrl || ""));
  checks.push({
    id: "sheets",
    label: "Google Sheets (ฐานข้อมูล)",
    ok: !sheets.error,
    ms: sheets.ms,
    detail: sheets.error
      ? sheets.error
      : `อ่านได้ — สินค้า ${sheets.value?.counts.products} · ออเดอร์ ${sheets.value?.counts.orders} · รอบ ${sheets.value?.counts.rounds}`,
  });

  if (cfg.lineChannelAccessToken) {
    const bot = await timed(async () => {
      const res = await fetch("https://api.line.me/v2/bot/info", {
        headers: { Authorization: `Bearer ${cfg.lineChannelAccessToken}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`LINE ตอบ ${res.status} — token ไม่ถูกต้องหรือหมดอายุ`);
      return (await res.json()) as { displayName?: string; basicId?: string };
    });
    checks.push({
      id: "line-token",
      label: "LINE Messaging API (token)",
      ok: !bot.error,
      ms: bot.ms,
      detail: bot.error || `บอท ${bot.value?.displayName || ""} ${bot.value?.basicId || ""}`.trim(),
    });
  } else {
    checks.push({ id: "line-token", label: "LINE Messaging API (token)", ok: false, detail: "ยังไม่ได้ใส่ Channel access token" });
  }

  checks.push({
    id: "line-secret",
    label: "LINE Channel secret (รับข้อความจากบอท)",
    ok: Boolean(cfg.lineChannelSecret),
    detail: cfg.lineChannelSecret ? "ตั้งค่าแล้ว" : "ยังไม่ได้ใส่ — บอทจะไม่รับข้อความ",
  });
  checks.push({
    id: "admin-group",
    label: "กลุ่ม LINE แอดมิน (รับแจ้งเตือนออเดอร์)",
    ok: Boolean(cfg.lineAdminGroupId || cfg.lineAdminUserId),
    detail: cfg.lineAdminGroupId ? "ผูกกลุ่มแล้ว" : cfg.lineAdminUserId ? "ส่งหาแอดมินรายคน (ยังไม่ผูกกลุ่ม)" : "ยังไม่ผูก — พิมพ์ /bind-admin <PIN> ในกลุ่ม",
  });
  checks.push({
    id: "line-login",
    label: "เข้าสู่ระบบด้วย LINE",
    ok: Boolean(cfg.lineLoginChannelId && cfg.lineLoginChannelSecret),
    detail: cfg.lineLoginChannelId && cfg.lineLoginChannelSecret ? "พร้อมใช้" : "ขาด Channel ID หรือ secret",
  });
  // Google login ปิดไว้ก่อน (lib/feature-flags.ts) — ไม่ต้องตรวจ
  if (GOOGLE_LOGIN_ENABLED) checks.push({
    id: "google-login",
    label: "เข้าสู่ระบบด้วย Google",
    ok: Boolean(cfg.googleClientId && cfg.googleClientSecret),
    detail: cfg.googleClientId && cfg.googleClientSecret ? "พร้อมใช้" : "ยังไม่ได้ใส่ Client ID / secret",
  });
  // AI ตรวจสลิป — ไม่ใส่คีย์ = ปิดอยู่ (ไม่นับเป็นปัญหา); ใส่แล้วถาม Google ว่าคีย์ + รุ่นใช้ได้ไหม (ไม่เสีย token)
  if (cfg.geminiApiKey) {
    const model = (cfg.geminiModel || "gemini-3.8-flash").trim();
    const gm = await timed(async () => {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`, {
        headers: { "x-goog-api-key": cfg.geminiApiKey || "" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 400 || res.status === 401 || res.status === 403) throw new Error(`Google ตอบ ${res.status} — API key ไม่ถูกต้องหรือยังไม่เปิดใช้`);
      if (res.status === 404) throw new Error(`ไม่พบรุ่น "${model}" — แก้ช่องรุ่นโมเดล Gemini`);
      if (!res.ok) throw new Error(`Google ตอบ ${res.status}`);
      return (await res.json()) as { displayName?: string };
    });
    checks.push({
      id: "gemini",
      label: "AI ตรวจสลิป (Gemini)",
      ok: !gm.error,
      ms: gm.ms,
      detail: gm.error || `พร้อมใช้ — ${gm.value?.displayName || model}`,
    });
  } else {
    checks.push({ id: "gemini", label: "AI ตรวจสลิป (Gemini)", ok: true, detail: "ปิดอยู่ (ยังไม่ใส่ API key)" });
  }
  checks.push({
    id: "base-url",
    label: "ที่อยู่เว็บ",
    ok: Boolean(cfg.publicBaseUrl),
    detail: cfg.publicBaseUrl || "ไม่ทราบที่อยู่เว็บ — ลิงก์ในข้อความ LINE อาจผิด",
  });

  return NextResponse.json({ ok: checks.every((c) => c.ok), checks, at: new Date().toISOString() });
}

// ส่งการ์ดทดสอบเข้ากลุ่มแอดมิน 1 ใบ (superadmin เท่านั้น) — เช็กว่ากลุ่มรับแจ้งเตือนได้จริง
export async function POST(req: NextRequest) {
  if (!(await requireSuperAdmin(req))) return unauthorizedResponse();
  await loadAppSettings(true);
  const cfg = getRuntimeConfig();
  const targets = Array.from(new Set([cfg.lineAdminGroupId, cfg.lineAdminUserId].map((v) => (v || "").trim()).filter(Boolean)));
  if (!targets.length) return NextResponse.json({ ok: false, error: "ยังไม่ผูกกลุ่มแอดมิน — พิมพ์ /bind-admin <PIN> ในกลุ่ม" }, { status: 400 });
  const at = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });
  const row = (k: string, v: string, color = "#1C1917") => ({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: k, size: "sm", color: "#78716C", flex: 4 },
      { type: "text", text: v, size: "sm", color, flex: 6, wrap: true, weight: "bold" },
    ],
  });
  const card = {
    type: "flex",
    altText: "🧪 ทดสอบระบบแจ้งเตือน — กลุ่มแอดมินรับข้อความได้",
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#1B4D31",
        paddingAll: "14px",
        contents: [
          { type: "text", text: "🧪 ทดสอบระบบแจ้งเตือน", color: "#FFFFFF", weight: "bold", size: "md" },
          { type: "text", text: at, color: "#D1FAE5", size: "xs", margin: "4px" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "8px",
        paddingAll: "14px",
        contents: [
          { type: "text", text: "ถ้าเห็นการ์ดนี้ แปลว่ากลุ่มนี้รับแจ้งเตือนออเดอร์และสลิปได้แล้ว ✅", size: "sm", wrap: true, color: "#1C1917" },
          { type: "separator", margin: "8px" },
          row("ส่งไปที่", cfg.lineAdminGroupId ? "กลุ่มแอดมิน" : "แอดมินรายคน"),
          row("AI ตรวจสลิป", cfg.geminiApiKey ? `เปิด (${cfg.geminiModel || "gemini-3.8-flash"})` : "ปิด", cfg.geminiApiKey ? "#047857" : "#A8A29E"),
          { type: "text", text: "การ์ดนี้ส่งจากปุ่ม ทดสอบระบบ ในหลังบ้าน — ไม่ต้องทำอะไรต่อ", size: "xxs", color: "#A8A29E", wrap: true, margin: "10px" },
        ],
      },
    },
  };
  const results = [];
  for (const to of targets) {
    const r = await pushLineMessage(to, [card], cfg.lineChannelAccessToken);
    results.push({ target: to === cfg.lineAdminGroupId ? "group" : "admin", sent: r.sent, reason: r.sent ? undefined : r.reason });
  }
  const ok = results.every((r) => r.sent);
  return NextResponse.json({ ok, results, error: ok ? undefined : results.find((r) => !r.sent)?.reason }, { status: ok ? 200 : 502 });
}
