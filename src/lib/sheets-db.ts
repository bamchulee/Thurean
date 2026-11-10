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
  Round,
  RuntimeConfig,
} from "../types/durian";
import { createInitialDatabase } from "../data/mock";

const DATA_DIR = path.join(process.cwd(), "data");
const LOCAL_DB_PATH = path.join(DATA_DIR, "local-db.json");
const RUNTIME_CONFIG_PATH = path.join(DATA_DIR, "runtime-config.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ============================================================
// Runtime Configuration (ENV + local runtime-config.json)
// ============================================================
export function getRuntimeConfig(): RuntimeConfig {
  let fileConfig: RuntimeConfig = {};
  try {
    if (fs.existsSync(RUNTIME_CONFIG_PATH)) {
      const raw = fs.readFileSync(RUNTIME_CONFIG_PATH, "utf-8");
      fileConfig = JSON.parse(raw) as RuntimeConfig;
    }
  } catch {
    fileConfig = {};
  }

  return {
    googleSheetsWebAppUrl:
      process.env.GOOGLE_SHEETS_WEBAPP_URL || fileConfig.googleSheetsWebAppUrl || "",
    googleSheetViewUrl:
      process.env.GOOGLE_SHEET_VIEW_URL || fileConfig.googleSheetViewUrl || "",
    lineChannelAccessToken:
      process.env.LINE_CHANNEL_ACCESS_TOKEN || fileConfig.lineChannelAccessToken || "",
    lineAdminUserId:
      process.env.LINE_ADMIN_USER_ID || fileConfig.lineAdminUserId || "",
    lineLiffId:
      process.env.NEXT_PUBLIC_LINE_LIFF_ID || fileConfig.lineLiffId || "",
    adminPin: process.env.ADMIN_PIN || fileConfig.adminPin || "2824",
    lastSyncedAt: fileConfig.lastSyncedAt,
  };
}

export function saveRuntimeConfig(partial: Partial<RuntimeConfig>): RuntimeConfig {
  ensureDataDir();
  let existing: RuntimeConfig = {};
  try {
    if (fs.existsSync(RUNTIME_CONFIG_PATH)) {
      existing = JSON.parse(fs.readFileSync(RUNTIME_CONFIG_PATH, "utf-8"));
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
  if (partial.lineChannelAccessToken !== undefined) {
    next.lineChannelAccessToken = partial.lineChannelAccessToken.trim();
  }
  if (partial.lineAdminUserId !== undefined) {
    next.lineAdminUserId = partial.lineAdminUserId.trim();
  }
  if (partial.lineLiffId !== undefined) {
    next.lineLiffId = partial.lineLiffId.trim();
  }
  if (partial.adminPin !== undefined && partial.adminPin.trim().length >= 4) {
    next.adminPin = partial.adminPin.trim();
  }
  if (partial.lastSyncedAt !== undefined) {
    next.lastSyncedAt = partial.lastSyncedAt;
  }

  fs.writeFileSync(RUNTIME_CONFIG_PATH, JSON.stringify(next, null, 2), "utf-8");
  return getRuntimeConfig();
}

export function getDataSourceMode(): "google-sheets" | "local" {
  const cfg = getRuntimeConfig();
  return cfg.googleSheetsWebAppUrl ? "google-sheets" : "local";
}

// ============================================================
// Auth Helpers (Admin Session Token)
// ============================================================
export function createAdminSessionToken(pin: string): string {
  const secret = process.env.ADMIN_SECRET || "winkin-durian-secret-2026";
  return crypto.createHmac("sha256", secret).update(pin).digest("hex");
}

export function verifyAdminSessionToken(token?: string | null): boolean {
  if (!token) return false;
  const cfg = getRuntimeConfig();
  const expected = createAdminSessionToken(cfg.adminPin || "2824");
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ============================================================
// Local JSON Store Helpers
// ============================================================
function readLocalDb(): DatabaseState {
  ensureDataDir();
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    const seed = createInitialDatabase();
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(seed, null, 2), "utf-8");
    return seed;
  }
  try {
    const raw = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<DatabaseState>;
    const seed = createInitialDatabase();
    return {
      products: Array.isArray(parsed.products) ? parsed.products : seed.products,
      rounds: Array.isArray(parsed.rounds) ? parsed.rounds : seed.rounds,
      orders: Array.isArray(parsed.orders) ? parsed.orders : seed.orders,
      lots: Array.isArray(parsed.lots) ? parsed.lots : seed.lots,
      claims: Array.isArray(parsed.claims) ? parsed.claims : seed.claims,
    };
  } catch {
    const seed = createInitialDatabase();
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(seed, null, 2), "utf-8");
    return seed;
  }
}

function writeLocalDb(db: DatabaseState) {
  ensureDataDir();
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

// ============================================================
// Google Apps Script HTTP Bridge
// ============================================================
async function callGoogleAppsScriptGet<T>(webAppUrl: string, action: string): Promise<T> {
  const url = new URL(webAppUrl);
  url.searchParams.set("action", action);

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`Google Apps Script GET failed: ${res.status}`);
  }
  const json = (await res.json()) as { ok: boolean; data?: T; error?: string };
  if (!json.ok) {
    throw new Error(json.error || "Google Apps Script returned error");
  }
  return json.data as T;
}

async function callGoogleAppsScriptPost<T>(
  webAppUrl: string,
  action: string,
  payload: unknown
): Promise<T> {
  const res = await fetch(webAppUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, payload }),
    cache: "no-store",
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`Google Apps Script POST failed: ${res.status}`);
  }
  const json = (await res.json()) as { ok: boolean; data?: T; error?: string };
  if (!json.ok) {
    throw new Error(json.error || "Google Apps Script returned error");
  }
  return json.data as T;
}

export async function testGoogleSheetsConnection(webAppUrl: string) {
  const data = await callGoogleAppsScriptGet<DatabaseState>(webAppUrl, "getAll");
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

// ============================================================
// Public Unified CRUD Operations
// ============================================================
export async function getAllDatabase(): Promise<{
  data: DatabaseState;
  source: "google-sheets" | "local";
  warning?: string;
}> {
  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    try {
      const sheetData = await callGoogleAppsScriptGet<DatabaseState>(
        cfg.googleSheetsWebAppUrl,
        "getAll"
      );
      return { data: sheetData, source: "google-sheets" };
    } catch (err) {
      // Fallback to local if sheet endpoint fails temporarily
      return {
        data: readLocalDb(),
        source: "local",
        warning: `เชื่อมต่อ Google Sheet ไม่สำเร็จ (${String(err)}) — กำลังแสดงข้อมูลสำรองในเครื่อง`,
      };
    }
  }
  return { data: readLocalDb(), source: "local" };
}

export async function createOrderRecord(order: Order): Promise<Order> {
  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    await callGoogleAppsScriptPost(cfg.googleSheetsWebAppUrl, "createOrder", order);
  }
  // Always mirror locally as backup / instant cache
  const db = readLocalDb();
  db.orders.unshift(order);
  const qtySum = order.items.reduce((s, it) => s + it.qty, 0);
  const round = db.rounds.find((r) => r.id === order.roundId);
  if (round) {
    round.quotaRemaining = Math.max(0, round.quotaRemaining - qtySum);
  }
  writeLocalDb(db);
  return order;
}

export async function updateOrderRecord(
  id: string,
  updates: Partial<Order>
): Promise<Order | null> {
  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    await callGoogleAppsScriptPost(cfg.googleSheetsWebAppUrl, "updateOrder", {
      id,
      ...updates,
    });
  }
  const db = readLocalDb();
  const idx = db.orders.findIndex((o) => o.id === id);
  if (idx !== -1) {
    db.orders[idx] = { ...db.orders[idx], ...updates };
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

export async function createProductRecord(product: Product): Promise<Product> {
  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    await callGoogleAppsScriptPost(cfg.googleSheetsWebAppUrl, "createProduct", product);
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
  if (cfg.googleSheetsWebAppUrl) {
    await callGoogleAppsScriptPost(cfg.googleSheetsWebAppUrl, "updateProduct", {
      id,
      ...updates,
    });
  }
  const db = readLocalDb();
  const idx = db.products.findIndex((p) => p.id === id);
  if (idx !== -1) {
    db.products[idx] = { ...db.products[idx], ...updates };
    writeLocalDb(db);
    return db.products[idx];
  }
  if (cfg.googleSheetsWebAppUrl) {
    const fresh = await getAllDatabase();
    return fresh.data.products.find((p) => p.id === id) || null;
  }
  return null;
}

export async function createRoundRecord(round: Round): Promise<Round> {
  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    await callGoogleAppsScriptPost(cfg.googleSheetsWebAppUrl, "createRound", round);
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
  if (cfg.googleSheetsWebAppUrl) {
    await callGoogleAppsScriptPost(cfg.googleSheetsWebAppUrl, "updateRound", {
      id,
      ...updates,
    });
  }
  const db = readLocalDb();
  const idx = db.rounds.findIndex((r) => r.id === id);
  if (idx !== -1) {
    db.rounds[idx] = { ...db.rounds[idx], ...updates };
    writeLocalDb(db);
    return db.rounds[idx];
  }
  if (cfg.googleSheetsWebAppUrl) {
    const fresh = await getAllDatabase();
    return fresh.data.rounds.find((r) => r.id === id) || null;
  }
  return null;
}

export async function createLotRecord(lot: LotCost): Promise<LotCost> {
  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    await callGoogleAppsScriptPost(cfg.googleSheetsWebAppUrl, "createLot", lot);
  }
  const db = readLocalDb();
  db.lots.unshift(lot);
  writeLocalDb(db);
  return lot;
}

export async function createClaimRecord(claim: Claim): Promise<Claim> {
  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    await callGoogleAppsScriptPost(cfg.googleSheetsWebAppUrl, "createClaim", claim);
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
  if (cfg.googleSheetsWebAppUrl) {
    await callGoogleAppsScriptPost(cfg.googleSheetsWebAppUrl, "updateClaim", {
      claimId,
      ...updates,
    });
  }
  const db = readLocalDb();
  const idx = db.claims.findIndex((c) => c.claimId === claimId);
  if (idx !== -1) {
    db.claims[idx] = { ...db.claims[idx], ...updates };
    writeLocalDb(db);
    return db.claims[idx];
  }
  if (cfg.googleSheetsWebAppUrl) {
    const fresh = await getAllDatabase();
    return fresh.data.claims.find((c) => c.claimId === claimId) || null;
  }
  return null;
}
