// ============================================================
// Server-Side Data Layer: Google Sheets Web App + Local JSON Fallback
// ============================================================
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type {
  Claim,
  DatabaseState,
  LotCost,
  Order,
  Product,
  Promotion,
  Round,
  RuntimeConfig,
  User,
} from "../types/durian";
import { deductProductStock, restoreProductStock } from "./stock";
import { getWritableDataDir } from "./storage-dir";
import { getSigningSecret } from "./secrets";
import { nextRunningId, type IdKind } from "./ids";
import { shopInfo } from "../data/shop";
import { keepAlive } from "./background";

const shopInfoBank = () => shopInfo.bankAccount;

// URL ของ Web App ใช้ได้ต่อเมื่อมี API key เท่านั้น (ดู google-apps-script/Code.gs)
const DEFAULT_SHEETS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzDCBqJeHA5NkSM3j4j02esWdOhoUoqIml50KoDvLBjpzj9Y7BEgNVcBwhzo_hgktHh/exec";

function getLocalDbPath(): string {
  return path.join(getWritableDataDir(), "local-db.json");
}

function getRuntimeConfigPath(): string {
  return path.join(getWritableDataDir(), "runtime-config.json");
}

// ============================================================
// Runtime Configuration (ENV + local runtime-config.json)
// ============================================================
// ค่าที่บันทึกถาวรใน Apps Script (Script Properties) — โหลดมากับ getAll ทุกครั้ง ใช้ได้ทุก instance
let runtimeAdminGroupId = "";
let runtimeAdminUserId = "";

// ค่าที่แอดมินตั้งจากหน้าเว็บ (เก็บใน Apps Script Script Properties) — ชนะ env เสมอ
// โหลดเก็บไว้ในหน่วยความจำเท่านั้น ไม่เขียนลงดิสก์ (มี secret)
export type AppSettings = Partial<Record<string, string>> & { richMenu?: unknown };
export interface SheetSchemaInfo {
  file: "USER" | "THUREAN";
  idCol: string;
  headers: string[];
  notes: string[];
}
let remoteSettings: AppSettings = {};
let remoteCustomColumns: Record<string, string[]> = {};
let remoteSchema: Record<string, SheetSchemaInfo> = {};
let remoteLoadedAt = 0;
let remoteLoading: Promise<void> | null = null;
const SETTINGS_TTL_MS = 60 * 1000;

/** ดึงค่าตั้งค่าจาก Apps Script (แคช 1 นาที) — เรียกก่อนใช้ token/secret ในเส้นทางที่ไม่ได้โหลดฐานข้อมูล */
export async function loadAppSettings(force = false): Promise<void> {
  const url = process.env.GOOGLE_SHEETS_WEBAPP_URL || "";
  if (!url || !process.env.GOOGLE_SHEETS_API_KEY) return;
  if (!force && Date.now() - remoteLoadedAt < SETTINGS_TTL_MS) return;
  if (remoteLoading && !force) return remoteLoading;
  remoteLoading = (async () => {
    try {
      const data = await callGoogleAppsScriptPost<{
        settings?: AppSettings;
        customColumns?: Record<string, string[]>;
        schema?: Record<string, SheetSchemaInfo>;
      }>(url, "getSettings", {});
      remoteSettings = data?.settings || {};
      remoteCustomColumns = data?.customColumns || {};
      remoteSchema = data?.schema || {};
      remoteLoadedAt = Date.now();
    } catch (err) {
      console.warn("[settings] load failed, using env/defaults:", String(err));
      remoteLoadedAt = Date.now() - SETTINGS_TTL_MS + 10_000; // ลองใหม่ใน 10 วินาที
    } finally {
      remoteLoading = null;
    }
  })();
  return remoteLoading;
}

export function getSettingsBundle() {
  return { settings: remoteSettings, customColumns: remoteCustomColumns, schema: remoteSchema, loadedAt: remoteLoadedAt };
}

/** บันทึกค่า (ค่าว่าง = ลบ กลับไปใช้ env/ค่าเริ่มต้น) */
export async function saveAppSettings(partial: Record<string, unknown>): Promise<void> {
  const url = getRuntimeConfig().googleSheetsWebAppUrl;
  if (!url) throw new Error("ยังไม่ได้เชื่อม Google Sheets — บันทึกค่าถาวรไม่ได้");
  await callGoogleAppsScriptPost(url, "saveSettings", { settings: partial });
  await loadAppSettings(true);
}

/** เก็บรูปสลิปลง Google Drive ของร้าน + อ่านตัวหนังสือ (OCR ฟรีของ Google) — ใช้ไม่ได้ในโหมด local */
export async function ocrSlipImage(image: Buffer, mime: string, orderId: string, ext: string): Promise<{ text: string; fileUrl?: string; error?: string } | null> {
  const url = getRuntimeConfig().googleSheetsWebAppUrl;
  if (!url) return null;
  return await callGoogleAppsScriptPost<{ text: string; fileUrl?: string; error?: string }>(url, "ocrSlip", {
    base64: image.toString("base64"),
    mime,
    orderId,
    ext,
  });
}

/** เขียนแท็บ Settings (สรุปค่าแบบปิดบังค่าลับ) ในไฟล์ USER */
export async function writeSettingsSheet(rows: { group: string; label: string; value: string; source: string; key: string }[]): Promise<void> {
  const url = getRuntimeConfig().googleSheetsWebAppUrl;
  if (!url) return;
  await callGoogleAppsScriptPost(url, "writeSettingsSheet", { rows });
}

export async function saveCustomColumns(table: string, columns: string[]): Promise<{ message?: string }> {
  const url = getRuntimeConfig().googleSheetsWebAppUrl;
  if (!url) throw new Error("ยังไม่ได้เชื่อม Google Sheets");
  const res = await callGoogleAppsScriptPost<{ message?: string }>(url, "saveCustomColumns", { table, columns });
  await loadAppSettings(true);
  return res;
}

const pickSetting = (key: string): string => {
  const v = remoteSettings[key];
  return typeof v === "string" ? v.trim() : "";
};

export interface BankAccount {
  bank: string;
  number: string;
  name: string;
  promptPay: string;
}

/** บัญชีรับเงินของร้าน — ตั้งได้ที่หน้าแอดมิน › การเชื่อมต่อ (ใช้ตรวจสลิปว่าโอนเข้าบัญชีร้านจริง) */
export function getBankAccount(): BankAccount {
  const d = shopInfoBank();
  return {
    bank: pickSetting("shopBankName") || d.bank,
    number: pickSetting("shopAccountNumber") || d.number,
    name: pickSetting("shopAccountName") || d.name,
    promptPay: pickSetting("shopPromptPay") || d.promptPay,
  };
}

export function getRuntimeConfig(): RuntimeConfig {
  let fileConfig: RuntimeConfig = {};
  const cfgPath = getRuntimeConfigPath();
  try {
    if (fs.existsSync(cfgPath)) {
      const raw = fs.readFileSync(cfgPath, "utf-8");
      fileConfig = JSON.parse(raw) as RuntimeConfig;
    }
  } catch {
    fileConfig = {};
  }

  const vercelFallbackUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "";

  return {
    googleSheetsWebAppUrl:
      process.env.GOOGLE_SHEETS_WEBAPP_URL ||
      // ค่าว่างที่บันทึกไว้ = แอดมินกด "ตัดการเชื่อมต่อ" ให้ใช้โหมด local จริง ๆ
      (fileConfig.googleSheetsWebAppUrl !== undefined
        ? fileConfig.googleSheetsWebAppUrl
        : DEFAULT_SHEETS_WEBAPP_URL),
    googleSheetViewUrl:
      process.env.GOOGLE_SHEET_VIEW_URL ||
      fileConfig.googleSheetViewUrl ||
      "https://docs.google.com/spreadsheets/d/1QQcCxxnuHg9nmAQ-JHmTdIaC2kA-vnJEJpmOvWlgMb8/edit?usp=sharing",
    userSheetViewUrl:
      process.env.USER_SHEET_VIEW_URL ||
      fileConfig.userSheetViewUrl ||
      "https://docs.google.com/spreadsheets/d/16Np4KAWCGv9RGIrj3hAqUCeNK1EXjiHLXmBfg849yHQ/edit?usp=sharing",
    thureanSheetViewUrl:
      process.env.THUREAN_SHEET_VIEW_URL ||
      fileConfig.thureanSheetViewUrl ||
      "https://docs.google.com/spreadsheets/d/1QQcCxxnuHg9nmAQ-JHmTdIaC2kA-vnJEJpmOvWlgMb8/edit?usp=sharing",
    lineOaId:
      pickSetting("lineOaId") || process.env.LINE_OA_ID || fileConfig.lineOaId || "@713imada",
    lineChannelAccessToken:
      pickSetting("lineChannelAccessToken") || process.env.LINE_CHANNEL_ACCESS_TOKEN || fileConfig.lineChannelAccessToken || "",
    lineAdminUserId:
      pickSetting("lineAdminUserId") || process.env.LINE_ADMIN_USER_ID || runtimeAdminUserId || fileConfig.lineAdminUserId || "",
    lineAdminGroupId:
      pickSetting("lineAdminGroupId") || process.env.LINE_ADMIN_GROUP_ID || runtimeAdminGroupId || fileConfig.lineAdminGroupId || "",
    lineLiffId:
      pickSetting("lineLiffId") || process.env.NEXT_PUBLIC_LINE_LIFF_ID || fileConfig.lineLiffId || "2012605985-l0IfXrhJ",
    lineLoginChannelId:
      pickSetting("lineLoginChannelId") || process.env.LINE_LOGIN_CHANNEL_ID || fileConfig.lineLoginChannelId || "2012605985",
    lineLoginChannelSecret:
      pickSetting("lineLoginChannelSecret") || process.env.LINE_LOGIN_CHANNEL_SECRET || fileConfig.lineLoginChannelSecret || "",
    googleSheetsApiKey:
      process.env.GOOGLE_SHEETS_API_KEY || fileConfig.googleSheetsApiKey || "",
    // ไม่มี PIN เริ่มต้น: ถ้าไม่ตั้ง ADMIN_PIN จะเข้าแอดมินด้วย PIN ไม่ได้
    adminPin: process.env.ADMIN_PIN || fileConfig.adminPin || "",
    publicBaseUrl:
      pickSetting("publicBaseUrl") || process.env.NEXT_PUBLIC_BASE_URL || fileConfig.publicBaseUrl || vercelFallbackUrl,
    liveStreamPlatform:
      pickSetting("liveStreamPlatform") || process.env.LINE_LIVE_PLATFORM || fileConfig.liveStreamPlatform || "",
    liveStreamUrl: pickSetting("liveStreamUrl") || process.env.LINE_LIVE_URL || fileConfig.liveStreamUrl || "",
    liveStreamNote: pickSetting("liveStreamNote") || process.env.LINE_LIVE_NOTE || fileConfig.liveStreamNote || "",
    isLiveNow:
      pickSetting("isLiveNow")
        ? pickSetting("isLiveNow") === "true"
        : process.env.LINE_IS_LIVE_NOW === "true" || Boolean(fileConfig.isLiveNow),
    lineChannelSecret: pickSetting("lineChannelSecret") || process.env.LINE_CHANNEL_SECRET || "",
    googleClientId: pickSetting("googleClientId") || process.env.GOOGLE_CLIENT_ID || "",
    googleClientSecret: pickSetting("googleClientSecret") || process.env.GOOGLE_CLIENT_SECRET || "",
    geminiApiKey: pickSetting("geminiApiKey") || process.env.GEMINI_API_KEY || "",
    geminiModel: pickSetting("geminiModel") || process.env.GEMINI_MODEL || "gemini-3.8-flash",
    lastSyncedAt: fileConfig.lastSyncedAt,
  };
}

export function saveRuntimeConfig(partial: Partial<RuntimeConfig>): RuntimeConfig {
  const cfgPath = getRuntimeConfigPath();
  let existing: RuntimeConfig = {};
  try {
    if (fs.existsSync(cfgPath)) {
      existing = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
    }
  } catch {
    existing = {};
  }

  const next: RuntimeConfig = { ...existing };
  if (partial.googleSheetsWebAppUrl !== undefined) {
    next.googleSheetsWebAppUrl = partial.googleSheetsWebAppUrl.trim();
  }
  if (partial.googleSheetViewUrl !== undefined) {
    next.googleSheetViewUrl = partial.googleSheetViewUrl.trim();
  }
  if (partial.userSheetViewUrl !== undefined) {
    next.userSheetViewUrl = partial.userSheetViewUrl.trim();
  }
  if (partial.thureanSheetViewUrl !== undefined) {
    next.thureanSheetViewUrl = partial.thureanSheetViewUrl.trim();
  }
  if (partial.lineOaId !== undefined) {
    next.lineOaId = partial.lineOaId.trim();
  }
  if (partial.lineChannelAccessToken !== undefined) {
    next.lineChannelAccessToken = partial.lineChannelAccessToken.trim();
  }
  if (partial.lineAdminUserId !== undefined) {
    next.lineAdminUserId = partial.lineAdminUserId.trim();
    runtimeAdminUserId = partial.lineAdminUserId.trim();
  }
  if (partial.lineAdminGroupId !== undefined) {
    next.lineAdminGroupId = partial.lineAdminGroupId.trim();
    runtimeAdminGroupId = partial.lineAdminGroupId.trim();
  }
  if (partial.lineLiffId !== undefined) {
    next.lineLiffId = partial.lineLiffId.trim();
  }
  if (partial.lineLoginChannelId !== undefined) {
    next.lineLoginChannelId = partial.lineLoginChannelId.trim();
  }
  if (partial.lineLoginChannelSecret !== undefined) {
    next.lineLoginChannelSecret = partial.lineLoginChannelSecret.trim();
  }
  if (partial.googleSheetsApiKey !== undefined) {
    next.googleSheetsApiKey = partial.googleSheetsApiKey.trim();
  }
  if (partial.adminPin !== undefined && partial.adminPin.trim().length >= 4) {
    next.adminPin = partial.adminPin.trim();
  }
  if (partial.publicBaseUrl !== undefined) {
    next.publicBaseUrl = partial.publicBaseUrl.trim().replace(/\/+$/, "");
  }
  if (partial.liveStreamPlatform !== undefined) {
    next.liveStreamPlatform = partial.liveStreamPlatform.trim();
  }
  if (partial.liveStreamUrl !== undefined) {
    next.liveStreamUrl = partial.liveStreamUrl.trim();
  }
  if (partial.liveStreamNote !== undefined) {
    next.liveStreamNote = partial.liveStreamNote.trim();
  }
  if (partial.isLiveNow !== undefined) {
    next.isLiveNow = Boolean(partial.isLiveNow);
  }
  if (partial.lastSyncedAt !== undefined) {
    next.lastSyncedAt = partial.lastSyncedAt;
  }

  fs.writeFileSync(cfgPath, JSON.stringify(next, null, 2), "utf-8");
  return getRuntimeConfig();
}

/** ผูกกลุ่ม/บัญชี LINE แอดมิน (หลังตรวจ PIN แล้ว) — บันทึกถาวรใน Apps Script ไม่ใช่ /tmp */
export async function setLineAdminTarget(kind: "group" | "user", id: string): Promise<void> {
  const cleanId = (id || "").trim();
  const key = kind === "group" ? "lineAdminGroupId" : "lineAdminUserId";
  saveRuntimeConfig({ [key]: cleanId });
  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    try {
      await callGoogleAppsScriptPost(cfg.googleSheetsWebAppUrl, "setConfig", { [key]: cleanId });
    } catch (err) {
      console.warn(`Failed to persist ${key} to Apps Script Script Properties:`, err);
    }
  }
}

export function getDataSourceMode(): "google-sheets" | "local" {
  const cfg = getRuntimeConfig();
  return cfg.googleSheetsWebAppUrl ? "google-sheets" : "local";
}

// ============================================================
// Auth Helpers (Admin Session Token)
// ============================================================

// ============================================================
// Local JSON Store Helpers
// ============================================================
/** ฐานข้อมูลว่าง — ระบบไม่มีข้อมูลตัวอย่าง ร้านกรอกสินค้า/รอบเองในชีตหรือหลังบ้าน */
function emptyDatabase(): DatabaseState {
  return { products: [], rounds: [], orders: [], lots: [], claims: [], promotions: [], users: [] };
}

function readLocalDb(): DatabaseState {
  const dbPath = getLocalDbPath();
  if (!fs.existsSync(dbPath)) return emptyDatabase();
  try {
    const parsed = JSON.parse(fs.readFileSync(dbPath, "utf-8")) as Partial<DatabaseState>;
    const list = <T,>(v: T[] | undefined): T[] => (Array.isArray(v) ? v : []);
    return {
      products: list(parsed.products),
      rounds: list(parsed.rounds),
      orders: list(parsed.orders),
      lots: list(parsed.lots),
      claims: list(parsed.claims),
      promotions: list(parsed.promotions),
      users: list(parsed.users),
    };
  } catch (err) {
    // ไฟล์เสีย: อย่าเขียนทับ (เก็บไว้ให้กู้) — ทำงานต่อแบบฐานข้อมูลว่าง
    console.error("[sheets-db] local-db.json อ่านไม่ได้:", err);
    return emptyDatabase();
  }
}

function writeLocalDb(db: DatabaseState) {
  // เขียนลงไฟล์ชั่วคราวก่อนแล้วค่อยสลับชื่อ กันไฟล์พังถ้าโปรเซสดับกลางคัน
  const target = getLocalDbPath();
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf-8");
  fs.renameSync(tmp, target);
  // โหมดชีต: แคชเก็บข้อมูลจากชีต (แก้ผ่าน patchCache แล้ว) — ไฟล์นี้เป็นแค่สำรอง ไม่ต้องล้างแคช
  if (!getRuntimeConfig().googleSheetsWebAppUrl) invalidateDatabaseCache();
}

// ============================================================
// Google Apps Script HTTP Bridge
// ============================================================
export class SheetsApiError extends Error {
  code: string;
  constructor(message: string, code = "ERROR") {
    super(message);
    this.name = "SheetsApiError";
    this.code = code;
  }
}

const SHEETS_TIMEOUT_MS = 30_000;

async function parseSheetsResponse<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    throw new SheetsApiError(`Google Apps Script ${label} failed: HTTP ${res.status}`, "HTTP_ERROR");
  }
  const text = await res.text();
  let json: { ok: boolean; data?: T; error?: string; code?: string };
  try {
    json = JSON.parse(text);
  } catch {
    // ได้หน้า HTML กลับมา = URL ผิด หรือ Web App ไม่ได้เปิดสิทธิ์ "Anyone"
    throw new SheetsApiError(
      "Google Apps Script ไม่ได้ตอบกลับเป็น JSON (ตรวจ URL และสิทธิ์การ Deploy)",
      "BAD_RESPONSE"
    );
  }
  if (!json.ok) {
    const msg = json.error || "Google Apps Script returned error";
    const code = json.code || msg.match(/([A-Z_]{4,}):/)?.[1] || "ERROR";
    throw new SheetsApiError(msg, code);
  }
  return json.data as T;
}

async function callGoogleAppsScriptPost<T>(
  webAppUrl: string,
  action: string,
  payload: unknown
): Promise<T> {
  const key = getRuntimeConfig().googleSheetsApiKey || "";
  const isWrite = !READ_ACTIONS.has(action);
  let result: T;
  try {
    const res = await fetch(webAppUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, payload, key }),
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(SHEETS_TIMEOUT_MS),
    });
    result = await parseSheetsResponse<T>(res, `POST ${action}`);
  } catch (err) {
    if (isWrite) invalidateDatabaseCache();
    throw err;
  }
  if (isWrite) patchCache(action, payload, result);
  return result;
}

const READ_ACTIONS = new Set(["getAll", "ping", "getSettings", "ocrSlip"]);

async function fetchAllFromSheets(webAppUrl: string): Promise<DatabaseState> {
  try {
    return await callGoogleAppsScriptPost<DatabaseState>(webAppUrl, "getAll", {});
  } catch (err) {
    // สคริปต์รุ่นเก่า (ยังไม่ได้ Deploy โค้ดรุ่นใหม่ใน google-apps-script/) รู้จัก getAll เฉพาะแบบ GET
    const legacy =
      err instanceof SheetsApiError && /Unknown POST action/i.test(err.message);
    if (!legacy) throw err;
    const url = new URL(webAppUrl);
    url.searchParams.set("action", "getAll");
    const res = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(SHEETS_TIMEOUT_MS),
    });
    return await parseSheetsResponse<DatabaseState>(res, "GET getAll");
  }
}

export async function testGoogleSheetsConnection(webAppUrl: string) {
  const data = await fetchAllFromSheets(webAppUrl);
  return {
    connected: true,
    counts: {
      products: data?.products?.length ?? 0,
      rounds: data?.rounds?.length ?? 0,
      orders: data?.orders?.length ?? 0,
      lots: data?.lots?.length ?? 0,
      claims: data?.claims?.length ?? 0,
    },
  };
}

export async function setupSheetsSchema(webAppUrl?: string) {
  const target = webAppUrl || getRuntimeConfig().googleSheetsWebAppUrl;
  if (!target) throw new Error("No Google Sheets Web App URL configured");
  return await callGoogleAppsScriptPost<{ message?: string }>(target, "setupSheets", {});
}

export async function rebuildSheetsSchema(webAppUrl?: string) {
  const target = webAppUrl || getRuntimeConfig().googleSheetsWebAppUrl;
  if (!target) throw new Error("No Google Sheets Web App URL configured");
  return await callGoogleAppsScriptPost<{ message?: string }>(target, "rebuildSheets", { confirm: "RESET" });
}

export async function syncLocalDataToGoogleSheet(webAppUrl: string) {
  const local = readLocalDb();
  const res = await callGoogleAppsScriptPost<{ syncedItems: number }>(
    webAppUrl,
    "syncSeed",
    local
  );
  saveRuntimeConfig({ lastSyncedAt: new Date().toISOString() });
  return res;
}

function applyDatabaseJoins(db: DatabaseState): DatabaseState {
  if (db.config?.lineAdminGroupId) runtimeAdminGroupId = db.config.lineAdminGroupId;
  if (db.config?.lineAdminUserId) runtimeAdminUserId = db.config.lineAdminUserId;
  // ชีตว่าง = ร้านยังไม่มีสินค้า/รอบ — ห้ามเติมข้อมูลตัวอย่าง (mock) แทน ไม่งั้นลูกค้าจองสินค้าปลอมได้
  const users = Array.isArray(db.users) ? db.users : [];
  const orders = Array.isArray(db.orders) ? db.orders : [];
  const claims = Array.isArray(db.claims) ? db.claims : [];
  const rounds = Array.isArray(db.rounds) ? db.rounds : [];
  const rawProducts = Array.isArray(db.products) ? db.products : [];
  const lots = Array.isArray(db.lots) ? db.lots : [];
  const promotions = Array.isArray(db.promotions) ? db.promotions : [];

  // Deduplicate products by id & merge fields
  const productMap = new Map<string, Product>();
  for (const p of rawProducts) {
    const existing = productMap.get(p.id);
    if (!existing) {
      productMap.set(p.id, p);
    } else {
      productMap.set(p.id, {
        ...existing,
        ...p,
        stockQty: p.stockQty !== undefined ? p.stockQty : existing.stockQty,
        grade: p.grade || existing.grade,
        pricePerKg: p.pricePerKg || existing.pricePerKg,
        weight: p.weight || existing.weight,
        productType: p.productType || existing.productType,
      });
    }
  }

  // ใช้ค่าจากชีตตามจริง: ไม่มีราคาต่อกิโล = ยังขายไม่ได้, ช่องสต็อกว่าง = ไม่จำกัด, isAvailable ในชีตต้องเคารพ
  const products = Array.from(productMap.values()).map((p) => {
    const stockQty =
      typeof p.stockQty === "number"
        ? p.stockQty
        : typeof p.stockKg === "number"
        ? Math.max(0, Math.floor(p.stockKg / (p.avgWeightKg || 3)))
        : undefined;
    const pricePerKg = Number(p.pricePerKg) || Number(p.price) || 0;
    const isActive = p.isActive !== 0 && (p.isActive as unknown) !== "0" && p.isActive !== false ? 1 : 0;
    const sheetAvailable = p.isAvailable !== false && String(p.isAvailable).toUpperCase() !== "FALSE";
    return {
      ...p,
      maturity: p.maturity || p.specs?.maturity,
      texture: p.texture || p.specs?.texture,
      weight: p.weight || "",
      stockQty,
      pricePerKg,
      price: pricePerKg,
      isActive,
      isAvailable: sheetAvailable && isActive === 1 && pricePerKg > 0 && (stockQty === undefined || stockQty >= 1),
    };
  });

  const cleanPhone = (p?: string) => (p || "").replace(/[^\d]/g, "");

  // 1. Join Order -> User
  const joinedOrders = orders.map((o) => {
    if (o.userId) return o;
    const matched = users.find(
      (u) =>
        (o.lineUserId && u.lineUserId === o.lineUserId) ||
        (o.phone && u.phone && cleanPhone(u.phone) === cleanPhone(o.phone))
    );
    return {
      ...o,
      userId: matched?.id || matched?.userId || (o.lineUserId ? `usr_${o.lineUserId.slice(-8)}` : undefined),
    };
  });

  // 2. Join Claim -> User & Order
  const joinedClaims = claims.map((c) => {
    if (c.userId) return c;
    const matchedOrder = joinedOrders.find((o) => o.id === c.orderId);
    const matchedUser = users.find(
      (u) => c.phone && u.phone && cleanPhone(u.phone) === cleanPhone(c.phone)
    );
    return {
      ...c,
      userId: matchedOrder?.userId || matchedUser?.id || undefined,
    };
  });

  // 3. User stats from Orders (relational aggregate)
  const joinedUsers = users.map((u) => {
    const userOrders = joinedOrders.filter(
      (o) =>
        (o.userId && (o.userId === u.id || o.userId === u.userId)) ||
        (u.lineUserId && o.lineUserId === u.lineUserId) ||
        (u.phone && o.phone && cleanPhone(u.phone) === cleanPhone(o.phone))
    );
    const totalSpent = userOrders.reduce((sum, o) => sum + (o.totalPrice + o.shippingCost), 0);
    return {
      ...u,
      userId: u.userId || u.id,
      orderCount: userOrders.length,
      totalSpent,
    };
  });

  return {
    ...db,
    rounds,
    products,
    lots,
    promotions,
    orders: joinedOrders,
    claims: joinedClaims,
    users: joinedUsers,
  };
}

// ============================================================
// Public Unified CRUD Operations & In-Memory / Disk SWR Fast Cache
// ============================================================
let memoryCache: {
  data: DatabaseState;
  source: "google-sheets" | "local";
  timestamp: number;
} | null = null;

const CACHE_FRESH_TTL_MS = 60_000; // 1 นาที: คืนค่าจากแคชทันที (< 5ms)
const CACHE_STALE_TTL_MS = 300_000; // 5 นาที: คืนค่าจากแคชทันที แล้วดึงอัปเดตชีตแบบ background

function getDiskCachePath(): string {
  const dir = getWritableDataDir();
  return path.join(dir, "sheets-cache.json");
}

function readDiskCache(): { data: DatabaseState; source: "google-sheets" | "local"; timestamp: number } | null {
  try {
    const p = getDiskCachePath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf-8");
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

function writeDiskCache(cached: { data: DatabaseState; source: "google-sheets" | "local"; timestamp: number }) {
  try {
    const p = getDiskCachePath();
    fs.writeFileSync(p, JSON.stringify(cached), "utf-8");
  } catch {}
}

/** เพิ่มทุกครั้งที่มีการเขียน — ผลดึงชีตที่เริ่มก่อนการเขียนจะไม่ไปทับข้อมูลที่ patch แล้ว */
let cacheVersion = 0;
let refreshing: Promise<void> | null = null;

/** เวลาที่ทำให้แคช "เก่าแต่ยังใช้ได้": อ่านครั้งถัดไปได้ทันที แล้วดึงชีตใหม่เบื้องหลัง */
const staleStamp = () => Date.now() - CACHE_FRESH_TTL_MS - 1;

/**
 * มีการเขียนข้อมูล: โหมดชีตเก็บข้อมูลเดิมไว้แต่ถือว่าเก่า (ไม่ล้างทิ้ง — ล้างแล้วคำขอถัดไปต้องรอชีต 3-8 วินาที)
 * โหมดเครื่อง (ไม่มีชีต) ล้างทิ้งเหมือนเดิม
 */
export function invalidateDatabaseCache() {
  cacheVersion++;
  if (memoryCache && getRuntimeConfig().googleSheetsWebAppUrl) {
    memoryCache = { ...memoryCache, timestamp: Math.min(memoryCache.timestamp, staleStamp()) };
    return;
  }
  memoryCache = null;
  try {
    const p = getDiskCachePath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}

const WRITE_TABLES: Record<string, keyof DatabaseState> = {
  Order: "orders",
  Product: "products",
  Round: "rounds",
  Lot: "lots",
  Claim: "claims",
  Promotion: "promotions",
  User: "users",
};

type Row = Record<string, unknown>;
const rowIds = (r: Row) => [r.id, r.userId, r.claimId, r.lotId].filter((v): v is string => typeof v === "string" && v !== "");

/** ใส่ผลการเขียน (create/update) ลงแคชทันที ให้หน้าเว็บ/แอดมินเห็นค่าใหม่โดยไม่ต้องรอชีต */
function patchCache(action: string, payload: unknown, result: unknown) {
  invalidateDatabaseCache();
  const m = /^(create|update)([A-Z]\w*)$/.exec(action);
  const table = m ? WRITE_TABLES[m[2]] : undefined;
  if (!memoryCache || !m || !table || !payload || typeof payload !== "object") return;
  const rec: Row = { ...(payload as Row) };
  delete rec._autoId;
  // ชีตออกเลขจริงให้ → ใช้เลขนั้น
  if (result && typeof result === "object") {
    for (const k of ["id", "userId", "claimId", "lotId"]) {
      const v = (result as Row)[k];
      if (typeof v === "string" && v) rec[k] = v;
    }
  }
  const ids = rowIds(rec);
  if (!ids.length) return;
  const rows = ((memoryCache.data[table] as unknown as Row[]) || []).slice();
  const idx = rows.findIndex((r) => rowIds(r).some((id) => ids.includes(id)));
  if (idx >= 0) rows[idx] = { ...rows[idx], ...rec };
  else if (m[1] === "create") {
    if (table === "orders") rows.unshift(rec);
    else rows.push(rec);
  } else return;
  memoryCache = { ...memoryCache, data: { ...memoryCache.data, [table]: rows } };
}

/** ดึงชีตใหม่เบื้องหลัง (ครั้งละงานเดียว) — บน Vercel ใช้ after() ให้ทำต่อจนเสร็จหลังตอบผู้ใช้แล้ว */
function refreshInBackground(webAppUrl: string) {
  if (refreshing) return;
  const startVersion = cacheVersion;
  refreshing = fetchAllFromSheets(webAppUrl)
    .then((sheetData) => {
      // ระหว่างดึงมีการเขียนใหม่ → ข้อมูลชุดนี้อาจไม่มีค่านั้น อย่าทับ (รอบหน้าค่อยดึงใหม่)
      if (startVersion !== cacheVersion) return;
      memoryCache = { data: applyDatabaseJoins(sheetData), source: "google-sheets", timestamp: Date.now() };
      writeDiskCache(memoryCache);
    })
    .catch((e) => console.warn("[Sheets Background Refresh Error]", e))
    .finally(() => {
      refreshing = null;
    });
  keepAlive(refreshing);
}

export async function getAllDatabase(forceRefresh = false): Promise<{
  data: DatabaseState;
  source: "google-sheets" | "local";
  warning?: string;
}> {
  await loadAppSettings();
  const now = Date.now();
  if (!memoryCache) {
    memoryCache = readDiskCache();
  }

  // 1. แคชยังสด (< 1 นาที): คืนค่าทันที ไม่ต้องต่อเน็ต
  if (!forceRefresh && memoryCache && (now - memoryCache.timestamp) < CACHE_FRESH_TTL_MS) {
    return { data: memoryCache.data, source: memoryCache.source };
  }

  // 2. แคชเริ่มเก่า (< 5 นาที): คืนค่าแคชให้ผู้ใช้ทันที (< 5ms) แล้ว refresh ข้อมูลชีตใน background
  if (!forceRefresh && memoryCache && (now - memoryCache.timestamp) < CACHE_STALE_TTL_MS) {
    const cfg = getRuntimeConfig();
    if (cfg.googleSheetsWebAppUrl) refreshInBackground(cfg.googleSheetsWebAppUrl);
    return { data: memoryCache.data, source: memoryCache.source };
  }

  // 3. ไม่มีแคชเลย หรือบังคับรีเฟรช: ดึงสดจาก Google Apps Script
  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    try {
      const startVersion = cacheVersion;
      const sheetData = await fetchAllFromSheets(cfg.googleSheetsWebAppUrl);
      const joined = applyDatabaseJoins(sheetData);
      // มีการเขียนระหว่างดึง: ส่งข้อมูลชุดนี้ให้ผู้เรียก แต่ให้แคชถือว่าเก่า
      if (startVersion !== cacheVersion) {
        memoryCache = { data: joined, source: "google-sheets", timestamp: staleStamp() };
        return { data: joined, source: "google-sheets" };
      }
      memoryCache = {
        data: joined,
        source: "google-sheets",
        timestamp: Date.now(),
      };
      writeDiskCache(memoryCache);
      return { data: joined, source: "google-sheets" };
    } catch (err) {
      // Fallback to local if sheet endpoint fails temporarily
      const localJoined = applyDatabaseJoins(readLocalDb());
      return {
        data: localJoined,
        source: "local",
        warning: `เชื่อมต่อ Google Sheet ไม่สำเร็จ (${String(err)}) — กำลังแสดงข้อมูลสำรองในเครื่อง`,
      };
    }
  }
  return { data: applyDatabaseJoins(readLocalDb()), source: "local" };
}

/** ส่งแถวใหม่ขึ้นชีต: autoId = ให้ Apps Script ออกเลขรันจริง แล้วคืนรหัสที่ชีตใช้ */
async function createOnSheets(
  action: string,
  record: object,
  idKey: string,
  autoId: boolean
): Promise<string | undefined> {
  const cfg = getRuntimeConfig();
  if (!cfg.googleSheetsWebAppUrl) return undefined;
  const res = await callGoogleAppsScriptPost<Record<string, unknown> | null>(
    cfg.googleSheetsWebAppUrl,
    action,
    autoId ? { ...record, _autoId: true } : record
  );
  const assigned = res && typeof res === "object" ? res[idKey] : undefined;
  return typeof assigned === "string" && assigned ? assigned : undefined;
}

/** รหัสชั่วคราวสำหรับโหมด local / Apps Script รุ่นเก่า (รุ่นใหม่จะออกเลขจริงทับให้) */
export function localNextId(kind: IdKind, ids: Iterable<string | undefined>): string {
  return nextRunningId(kind, ids);
}

export async function createOrderRecord(order: Order): Promise<Order> {
  const now = new Date().toISOString();
  if (!order.createDate) order.createDate = order.createdAt || now;
  if (!order.createdAt) order.createdAt = order.createDate;
  if (order.isActive === undefined) order.isActive = 1;
  if (!order.createdBy) order.createdBy = order.userId || order.lineUserId || "customer";
  if (!order.updatedAt) order.updatedAt = now;
  if (!order.updatedBy) order.updatedBy = order.createdBy;

  // Ensure order has a valid userId linking to User sheet
  if (!order.userId) {
    const cleanPhone = (p?: string) => (p || "").replace(/[^\d]/g, "");
    const local = readLocalDb();
    const existing = (local.users || []).find(
      (u) =>
        (order.lineUserId && u.lineUserId === order.lineUserId) ||
        (order.phone && u.phone && cleanPhone(u.phone) === cleanPhone(order.phone))
    );
    if (existing) {
      order.userId = existing.id || existing.userId;
    }
  }

  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    // Apps Script ออกเลขออเดอร์ เช็กสต็อก และตัดสต็อกภายใต้ล็อกเดียวกัน
    // (bookingKey ซ้ำ = คืนเลขออเดอร์เดิม ไม่สร้างใหม่ ไม่ตัดสต็อกซ้ำ)
    const assigned = await createOnSheets("createOrder", order, "id", true);
    if (assigned) order.id = assigned;
  } else {
    const local = readLocalDb();
    const sameBooking = order.bookingKey
      ? local.orders.find((o) => o.bookingKey === order.bookingKey)
      : undefined;
    if (sameBooking) return sameBooking;
    if (local.orders.some((o) => o.id === order.id)) {
      throw new SheetsApiError(`DUPLICATE_ID: รหัสออเดอร์ ${order.id} ถูกใช้แล้ว`, "DUPLICATE_ID");
    }
  }
  // Always mirror locally as backup / instant cache + deduct weight/qty stock
  const db = readLocalDb();
  if (db.orders.some((o) => o.id === order.id)) return order;
  db.orders.unshift(order);
  const qtySum = order.items.reduce((s, it) => s + it.qty, 0);
  const round = db.rounds.find((r) => r.id === order.roundId);
  if (round) {
    round.quotaRemaining = Math.max(0, round.quotaRemaining - qtySum);
  }
  for (const it of order.items) {
    const prod = db.products.find((p) => p.id === it.productId);
    if (prod) {
      deductProductStock(prod, it.qty);
    }
  }
  writeLocalDb(db);
  return order;
}

export async function updateOrderRecord(
  id: string,
  updates: Partial<Order>
): Promise<Order | null> {
  const cfg = getRuntimeConfig();
  const normalized = {
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: updates.updatedBy || "admin",
    ...(updates.isActive !== undefined
      ? { isActive: (updates.isActive === 0 || (updates.isActive as any) === "0" || updates.isActive === false) ? 0 : 1 }
      : {}),
  };
  if (cfg.googleSheetsWebAppUrl) {
    await callGoogleAppsScriptPost(cfg.googleSheetsWebAppUrl, "updateOrder", {
      id,
      ...normalized,
    });
  }
  const db = readLocalDb();
  const idx = db.orders.findIndex((o) => o.id === id);
  if (idx !== -1) {
    const before = db.orders[idx];
    db.orders[idx] = { ...before, ...normalized };
    // ยกเลิกแล้วคืนสต็อก (ฝั่งชีตทำใน Apps Script updateOrder)
    if (normalized.orderStatus === "ยกเลิก" && before.orderStatus !== "ยกเลิก") {
      for (const it of before.items || []) {
        const prod = db.products.find((p) => p.id === it.productId);
        if (prod) restoreProductStock(prod, it.qty);
      }
      const round = db.rounds.find((r) => r.id === before.roundId);
      const qtySum = (before.items || []).reduce((s, it) => s + it.qty, 0);
      if (round) round.quotaRemaining = Math.min(round.totalQuota || Infinity, round.quotaRemaining + qtySum);
    }
    writeLocalDb(db);
    return db.orders[idx];
  }

  // If using Google Sheets and local mirror didn't have it, refetch
  if (cfg.googleSheetsWebAppUrl) {
    const fresh = await getAllDatabase();
    return fresh.data.orders.find((o) => o.id === id) || null;
  }
  return null;
}

export async function createProductRecord(
  product: Product,
  options: { autoId?: boolean } = {}
): Promise<Product> {
  const now = new Date().toISOString();
  if (!product.createDate) product.createDate = now;
  if (product.isActive === undefined) product.isActive = 1;
  if (!product.createdBy) product.createdBy = "admin";
  if (!product.updatedAt) product.updatedAt = now;
  if (!product.updatedBy) product.updatedBy = product.createdBy;

  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    const assigned = await createOnSheets("createProduct", product, "id", Boolean(options.autoId));
    if (assigned) product.id = assigned;
  }
  const db = readLocalDb();
  db.products.push(product);
  writeLocalDb(db);
  return product;
}

export async function updateProductRecord(
  id: string,
  updates: Partial<Product>
): Promise<Product | null> {
  const cfg = getRuntimeConfig();
  const normalized = {
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: updates.updatedBy || "admin",
    ...(updates.isActive !== undefined
      ? { isActive: (updates.isActive === 0 || (updates.isActive as any) === "0" || updates.isActive === false) ? 0 : 1 }
      : {}),
  };
  if (cfg.googleSheetsWebAppUrl) {
    await callGoogleAppsScriptPost(cfg.googleSheetsWebAppUrl, "updateProduct", {
      id,
      ...normalized,
    });
  }
  const db = readLocalDb();
  const idx = db.products.findIndex((p) => p.id === id);
  if (idx !== -1) {
    db.products[idx] = { ...db.products[idx], ...normalized };
    writeLocalDb(db);
    return db.products[idx];
  }
  if (cfg.googleSheetsWebAppUrl) {
    const fresh = await getAllDatabase();
    return fresh.data.products.find((p) => p.id === id) || null;
  }
  return null;
}

export async function createRoundRecord(
  round: Round,
  options: { autoId?: boolean } = {}
): Promise<Round> {
  const now = new Date().toISOString();
  if (!round.createDate) round.createDate = now;
  if (round.isActive === undefined) round.isActive = 1;
  if (!round.createdBy) round.createdBy = "admin";
  if (!round.updatedAt) round.updatedAt = now;
  if (!round.updatedBy) round.updatedBy = round.createdBy;

  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    const assigned = await createOnSheets("createRound", round, "id", Boolean(options.autoId));
    if (assigned) round.id = assigned;
  }
  const db = readLocalDb();
  db.rounds.unshift(round);
  writeLocalDb(db);
  return round;
}

export async function updateRoundRecord(
  id: string,
  updates: Partial<Round>
): Promise<Round | null> {
  const cfg = getRuntimeConfig();
  const normalized = {
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: updates.updatedBy || "admin",
    ...(updates.isActive !== undefined
      ? { isActive: (updates.isActive === 0 || (updates.isActive as any) === "0" || updates.isActive === false) ? 0 : 1 }
      : {}),
  };
  if (cfg.googleSheetsWebAppUrl) {
    await callGoogleAppsScriptPost(cfg.googleSheetsWebAppUrl, "updateRound", {
      id,
      ...normalized,
    });
  }
  const db = readLocalDb();
  const idx = db.rounds.findIndex((r) => r.id === id);
  if (idx !== -1) {
    db.rounds[idx] = { ...db.rounds[idx], ...normalized };
    writeLocalDb(db);
    return db.rounds[idx];
  }
  if (cfg.googleSheetsWebAppUrl) {
    const fresh = await getAllDatabase();
    return fresh.data.rounds.find((r) => r.id === id) || null;
  }
  return null;
}

export async function createLotRecord(
  lot: LotCost,
  options: { autoId?: boolean } = {}
): Promise<LotCost> {
  const now = new Date().toISOString();
  if (!lot.createDate) lot.createDate = lot.date || now;
  if (lot.isActive === undefined) lot.isActive = 1;
  if (!lot.createdBy) lot.createdBy = "admin";
  if (!lot.updatedAt) lot.updatedAt = now;
  if (!lot.updatedBy) lot.updatedBy = lot.createdBy;

  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    const assigned = await createOnSheets("createLot", lot, "lotId", Boolean(options.autoId));
    if (assigned) lot.lotId = assigned;
  }
  const db = readLocalDb();
  db.lots.unshift(lot);
  writeLocalDb(db);
  return lot;
}

export async function createClaimRecord(claim: Claim): Promise<Claim> {
  const now = new Date().toISOString();
  if (!claim.createDate) claim.createDate = claim.createdAt || now;
  if (!claim.createdAt) claim.createdAt = claim.createDate;
  if (claim.isActive === undefined) claim.isActive = 1;
  if (!claim.createdBy) claim.createdBy = claim.userId || "customer";
  if (!claim.updatedAt) claim.updatedAt = now;
  if (!claim.updatedBy) claim.updatedBy = claim.createdBy;

  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    const assigned = await createOnSheets("createClaim", claim, "claimId", true);
    if (assigned) claim.claimId = assigned;
  }
  const db = readLocalDb();
  db.claims.unshift(claim);
  writeLocalDb(db);
  return claim;
}

export async function updateClaimRecord(
  claimId: string,
  updates: Partial<Claim>
): Promise<Claim | null> {
  const cfg = getRuntimeConfig();
  const normalized = {
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: updates.updatedBy || "admin",
    ...(updates.isActive !== undefined
      ? { isActive: (updates.isActive === 0 || (updates.isActive as any) === "0" || updates.isActive === false) ? 0 : 1 }
      : {}),
  };
  if (cfg.googleSheetsWebAppUrl) {
    await callGoogleAppsScriptPost(cfg.googleSheetsWebAppUrl, "updateClaim", {
      claimId,
      ...normalized,
    });
  }
  const db = readLocalDb();
  const idx = db.claims.findIndex((c) => c.claimId === claimId);
  if (idx !== -1) {
    db.claims[idx] = { ...db.claims[idx], ...normalized };
    writeLocalDb(db);
    return db.claims[idx];
  }
  if (cfg.googleSheetsWebAppUrl) {
    const fresh = await getAllDatabase();
    return fresh.data.claims.find((c) => c.claimId === claimId) || null;
  }
  return null;
}

export async function createPromotionRecord(
  promo: Promotion,
  options: { autoId?: boolean } = {}
): Promise<Promotion> {
  const now = new Date().toISOString();
  if (!promo.createDate) promo.createDate = now;
  if (promo.isActive === undefined) promo.isActive = true;
  if (!promo.createdBy) promo.createdBy = "admin";
  if (!promo.updatedAt) promo.updatedAt = now;
  if (!promo.updatedBy) promo.updatedBy = promo.createdBy;

  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    const assigned = await createOnSheets("createPromotion", promo, "id", Boolean(options.autoId));
    if (assigned) promo.id = assigned;
  }
  const db = readLocalDb();
  const list = Array.isArray(db.promotions) ? db.promotions : [];
  list.unshift(promo);
  db.promotions = list;
  writeLocalDb(db);
  return promo;
}

export async function updatePromotionRecord(
  id: string,
  updates: Partial<Promotion>
): Promise<Promotion | null> {
  const cfg = getRuntimeConfig();
  const normalized = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  if (cfg.googleSheetsWebAppUrl) {
    await callGoogleAppsScriptPost(cfg.googleSheetsWebAppUrl, "updatePromotion", {
      id,
      ...normalized,
    });
  }
  const db = readLocalDb();
  const list = Array.isArray(db.promotions) ? db.promotions : [];
  const idx = list.findIndex((p) => p.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...normalized };
    db.promotions = list;
    writeLocalDb(db);
    return list[idx];
  }
  return null;
}

// ============================================================
// Users & Member Account Operations
// ============================================================
export async function getAllUsers(): Promise<User[]> {
  const db = await getAllDatabase();
  return db.data.users || [];
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const clean = username.trim().toLowerCase();
  const cleanDigits = clean.replace(/[^0-9]/g, "");
  // ล็อกอินด้วยเบอร์โทรได้เฉพาะบัญชีที่ตั้งรหัสผ่านไว้ (ไม่ใช่ข้อมูลลูกค้าที่บันทึกจากออเดอร์)
  const matches = (u: User) =>
    (u.username || "").toLowerCase() === clean ||
    (cleanDigits.length >= 9 &&
      Boolean(u.passwordHash?.includes(":")) &&
      (u.phone || "").replace(/[^0-9]/g, "") === cleanDigits);

  const db = readLocalDb();
  const found = db.users?.find(matches);
  if (found) return found;

  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    try {
      const all = await getAllDatabase();
      return all.data.users?.find(matches) || null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function getUserById(id: string): Promise<User | null> {
  const db = readLocalDb();
  const found = db.users?.find(
    (u) =>
      u.id === id ||
      u.userId === id ||
      (u.lineUserId && u.lineUserId === id) ||
      (u.username && u.username === id)
  );
  if (found) return found;

  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    try {
      const all = await getAllDatabase();
      return (
        all.data.users?.find(
          (u) =>
            u.id === id ||
            u.userId === id ||
            (u.lineUserId && u.lineUserId === id) ||
            (u.username && u.username === id)
        ) || null
      );
    } catch {
      return null;
    }
  }
  return null;
}

export async function createUserRecord(user: User): Promise<User> {
  const now = new Date().toISOString();
  if (!user.createDate) user.createDate = user.createdAt || now;
  if (!user.createdAt) user.createdAt = user.createDate;
  if (user.isActive === undefined) user.isActive = 1;
  if (!user.createdBy) user.createdBy = user.source || "user";
  if (!user.updatedAt) user.updatedAt = now;
  if (!user.updatedBy) user.updatedBy = user.createdBy;

  // บันทึกลงชีตก่อน ถ้าไม่สำเร็จให้ error ออกไปเลย (ดีกว่าบอกว่าสมัครสำเร็จแต่ข้อมูลหาย)
  // ชีตเป็นคนออกเลข USR- จริง แล้วเว็บใช้เลขนั้นต่อ
  const assigned = await createOnSheets(
    "createUser",
    { ...user, userId: user.userId || user.id },
    "userId",
    true
  );
  if (assigned) {
    user.id = assigned;
    user.userId = assigned;
  }

  const db = readLocalDb();
  if (!Array.isArray(db.users)) db.users = [];
  const existingIdx = db.users.findIndex((u) => u.id === user.id);
  if (existingIdx !== -1) {
    db.users[existingIdx] = user;
  } else {
    db.users.push(user);
  }
  writeLocalDb(db);
  invalidateDatabaseCache();

  return user;
}

export async function updateUserRecord(
  id: string,
  updates: Partial<User>
): Promise<User | null> {
  const db = readLocalDb();
  if (!Array.isArray(db.users)) db.users = [];
  const idx = db.users.findIndex((u) => u.id === id || (u.userId && u.userId === id));
  let updatedUser: User | null = null;
  const normalized = {
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: updates.updatedBy || "admin",
    ...(updates.isActive !== undefined
      ? { isActive: (updates.isActive === 0 || (updates.isActive as any) === "0" || updates.isActive === false) ? 0 : 1 }
      : {}),
  };
  if (idx !== -1) {
    db.users[idx] = {
      ...db.users[idx],
      ...normalized,
    };
    writeLocalDb(db);
    updatedUser = db.users[idx];
  }
  invalidateDatabaseCache();

  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    try {
      const res = await callGoogleAppsScriptPost<unknown>(
        cfg.googleSheetsWebAppUrl,
        "updateUser",
        { id, userId: id, ...normalized }
      );
      // ไม่พบแถวในชีต (เช่น เคยบันทึกไม่สำเร็จ) → ส่งข้อมูลเต็มขึ้นไปสร้างใหม่
      if (res === null && updatedUser) {
        await callGoogleAppsScriptPost(cfg.googleSheetsWebAppUrl, "createUser", {
          ...updatedUser,
          userId: updatedUser.userId || updatedUser.id,
        });
      }
    } catch (err) {
      console.error("Google Sheets updateUser failed (saved locally only):", err);
    }
  }

  return updatedUser;
}

/** บันทึกเวลาล็อกอินล่าสุดลงชีต Users (ไม่ให้ล็อกอินล้มถ้าชีตตอบช้า) */
export async function recordUserLogin(user: Pick<User, "id" | "lineUserId">): Promise<void> {
  try {
    await updateUserRecord(user.id, {
      lastLoginAt: new Date().toISOString(),
      ...(user.lineUserId ? { lineUserId: user.lineUserId } : {}),
    });
  } catch (err) {
    console.error("Recording login time failed:", err);
  }
}

export interface UpsertLineUserInput {
  lineUserId?: string;
  displayName?: string;
  customerName?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  avatarUrl?: string;
  source?: "line-login" | "line-chat" | "web" | string;
  notes?: string;
  mapsUrl?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * บันทึกข้อมูลลูกค้าที่สั่งผ่านเว็บโดยไม่ล็อกอิน ลงชีต Users
 * - เบอร์นี้มีในระบบแล้ว: คืน userId ของคนนั้นเพื่อผูกออเดอร์ แต่ไม่แก้ข้อมูลบัญชีเขา
 *   (คนสั่งพิมพ์เบอร์อะไรก็ได้ จึงห้ามให้ไปทับที่อยู่ของเจ้าของบัญชี)
 * - ยังไม่มี: สร้างแถวลูกค้าใหม่พร้อมชื่อ เบอร์ ที่อยู่ (ไม่มีรหัสผ่าน ใช้ล็อกอินไม่ได้)
 */
export async function recordGuestCustomer(input: {
  customerName: string;
  phone: string;
  address: string;
}): Promise<string | undefined> {
  const digits = (input.phone || "").replace(/[^\d]/g, "");
  if (digits.length < 9) return undefined;

  const samePhone = (u: User) => (u.phone || "").replace(/[^\d]/g, "") === digits;
  let existing = (readLocalDb().users || []).find(samePhone);
  if (!existing) existing = (await getAllUsers()).find(samePhone);
  if (existing) return existing.id || existing.userId;

  const address = input.address.trim();
  const postal = address.match(/\b\d{5}\b/)?.[0] || "";
  const name = input.customerName.trim().replace(/^(คุณ|นาย|นางสาว|นาง)\s*/, "");
  const [firstName, ...rest] = name.split(/\s+/);
  const now = new Date().toISOString();
  const id = localNextId("users", (await getAllUsers()).map((u) => u.id));

  const created = await createUserRecord({
    id,
    userId: id,
    username: `guest_${id}`,
    displayName: input.customerName.trim(),
    firstName: firstName || input.customerName.trim(),
    lastName: rest.join(" "),
    phone: digits,
    address,
    postalCode: postal,
    role: "user",
    source: "web",
    notes: "ลูกค้าสั่งซื้อผ่านเว็บ (ไม่ได้สมัครสมาชิก)",
    isActive: 1,
    createDate: now,
    createdBy: "web-order",
    createdAt: now,
    updatedAt: now,
    updatedBy: "web-order",
  });
  return created.id;
}

/**
 * หา/สร้างสมาชิกจาก LINE userId ที่ยืนยันแล้วเท่านั้น
 * ไม่จับคู่บัญชีด้วยเบอร์โทร: เบอร์โทรใคร ๆ ก็พิมพ์ได้ ถ้าใช้จับคู่จะสวมบัญชีคนอื่นได้
 */
export async function upsertLineUser(input: UpsertLineUserInput): Promise<User> {
  const cleanLineId = (input.lineUserId || "").trim();
  if (!cleanLineId) {
    throw new Error("upsertLineUser requires a verified lineUserId");
  }
  const cleanPhone = (input.phone || "").trim().replace(/\s+/g, "");
  const cleanAddress = (input.address || "").trim();
  const cleanDisplay = (input.displayName || "").trim();
  const cleanName = (input.customerName || cleanDisplay || "ลูกค้า LINE").trim();

  let postal = (input.postalCode || "").trim();
  if (!postal && cleanAddress) {
    const postMatch = cleanAddress.match(/\b\d{5}\b/);
    if (postMatch) postal = postMatch[0];
  }

  const nameWithoutPrefix = cleanName.replace(/^(คุณ|นาย|นาง|นางสาว)\s*/, "");
  const nameParts = nameWithoutPrefix.split(/\s+/);
  const firstName = nameParts[0] || cleanName;
  const lastName = nameParts.slice(1).join(" ") || "";

  const dbLocal = readLocalDb();
  let existing = (dbLocal.users || []).find(
    (u) =>
      (cleanLineId && u.lineUserId === cleanLineId) ||
      (cleanLineId && u.username === `line_${cleanLineId}`)
  );

  if (!existing) {
    const allUsers = await getAllUsers();
    existing = allUsers.find(
      (u) =>
        (cleanLineId && u.lineUserId === cleanLineId) ||
        (cleanLineId && u.username === `line_${cleanLineId}`)
    );
  }

  const now = new Date().toISOString();
  const cfg = getRuntimeConfig();
  const isAdminByLineId = Boolean(
    cfg.lineAdminUserId &&
      cleanLineId &&
      cfg.lineAdminUserId.trim().toLowerCase() === cleanLineId.trim().toLowerCase()
  );

  if (existing) {
    const updates: Partial<User> = {
      updatedAt: now,
    };
    // ห้ามลดสิทธิ์ SUPERADMIN ลงเป็น admin
    if (isAdminByLineId && existing.role !== "admin" && existing.role !== "superadmin") {
      updates.role = "admin";
    }
    if (cleanLineId && !existing.lineUserId) updates.lineUserId = cleanLineId;
    if (cleanDisplay && !existing.displayName) updates.displayName = cleanDisplay;
    if (cleanPhone && (!existing.phone || existing.phone.length < 9)) updates.phone = cleanPhone;
    if (cleanAddress) updates.address = cleanAddress;
    if (postal) updates.postalCode = postal;
    if (input.mapsUrl) updates.mapsUrl = input.mapsUrl;
    if (input.latitude !== undefined) updates.latitude = input.latitude;
    if (input.longitude !== undefined) updates.longitude = input.longitude;
    if (input.avatarUrl && !existing.avatarUrl) updates.avatarUrl = input.avatarUrl;
    if (input.source && !existing.source) updates.source = input.source;
    if (input.notes) updates.notes = input.notes;
    if (firstName && (!existing.firstName || existing.firstName === "ลูกค้า LINE")) {
      updates.firstName = firstName;
      if (lastName) updates.lastName = lastName;
    }

    const updated = await updateUserRecord(existing.id, updates);
    return updated || { ...existing, ...updates };
  }

  const genId = localNextId("users", (await getAllUsers()).map((u) => u.id));
  const newUser: User = {
    id: genId,
    userId: genId,
    username: cleanLineId ? `line_${cleanLineId}` : `line_${Date.now()}`,
    lineUserId: cleanLineId || undefined,
    displayName: cleanDisplay || cleanName,
    passwordHash: "LINE_AUTH_NO_PASSWORD",
    firstName,
    lastName,
    phone: cleanPhone,
    address: cleanAddress,
    postalCode: postal,
    mapsUrl: input.mapsUrl,
    latitude: input.latitude,
    longitude: input.longitude,
    avatarUrl:
      input.avatarUrl ||
      "https://api.dicebear.com/7.x/bottts/svg?seed=MonthongKing&backgroundColor=fef08a",
    role: isAdminByLineId ? "admin" : "user",
    source: input.source || "line-login",
    notes: input.notes,
    isActive: 1,
    createDate: now,
    createdBy: "line-login",
    createdAt: now,
    updatedAt: now,
    updatedBy: "line-login",
  };

  return await createUserRecord(newUser);
}
