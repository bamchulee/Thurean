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
import { createInitialDatabase } from "../data/mock";
import { deductProductStock } from "./stock";
import { getWritableDataDir } from "./storage-dir";

function getLocalDbPath(): string {
  return path.join(getWritableDataDir(), "local-db.json");
}

function getRuntimeConfigPath(): string {
  return path.join(getWritableDataDir(), "runtime-config.json");
}

// ============================================================
// Runtime Configuration (ENV + local runtime-config.json)
// ============================================================
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
      process.env.GOOGLE_SHEETS_WEBAPP_URL || fileConfig.googleSheetsWebAppUrl || "",
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
      process.env.LINE_OA_ID || fileConfig.lineOaId || "",
    lineChannelAccessToken:
      process.env.LINE_CHANNEL_ACCESS_TOKEN || fileConfig.lineChannelAccessToken || "",
    lineAdminUserId:
      process.env.LINE_ADMIN_USER_ID || fileConfig.lineAdminUserId || "",
    lineLiffId:
      process.env.NEXT_PUBLIC_LINE_LIFF_ID || fileConfig.lineLiffId || "",
    lineLoginChannelId:
      process.env.LINE_LOGIN_CHANNEL_ID || fileConfig.lineLoginChannelId || "",
    lineLoginChannelSecret:
      process.env.LINE_LOGIN_CHANNEL_SECRET || fileConfig.lineLoginChannelSecret || "",
    adminPin: process.env.ADMIN_PIN || fileConfig.adminPin || "2824",
    publicBaseUrl:
      process.env.NEXT_PUBLIC_BASE_URL || fileConfig.publicBaseUrl || vercelFallbackUrl,
    liveStreamPlatform:
      process.env.LINE_LIVE_PLATFORM || fileConfig.liveStreamPlatform || "",
    liveStreamUrl: process.env.LINE_LIVE_URL || fileConfig.liveStreamUrl || "",
    liveStreamNote: process.env.LINE_LIVE_NOTE || fileConfig.liveStreamNote || "",
    isLiveNow:
      process.env.LINE_IS_LIVE_NOW === "true" || Boolean(fileConfig.isLiveNow),
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
  const dbPath = getLocalDbPath();
  if (!fs.existsSync(dbPath)) {
    const seed = createInitialDatabase();
    fs.writeFileSync(dbPath, JSON.stringify(seed, null, 2), "utf-8");
    return seed;
  }
  try {
    const raw = fs.readFileSync(dbPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<DatabaseState>;
    const seed = createInitialDatabase();
    const mergedProducts = (Array.isArray(parsed.products) ? parsed.products : seed.products).map(
      (prod) => {
        const seedMatch = seed.products.find((sp) => sp.id === prod.id);
        return {
          ...prod,
          stockUnit: prod.stockUnit ?? seedMatch?.stockUnit ?? (prod.type === "flesh" ? "qty" : "kg"),
          stockKg: prod.stockKg ?? seedMatch?.stockKg,
          avgWeightKg: prod.avgWeightKg ?? seedMatch?.avgWeightKg,
          stockQty: prod.stockQty ?? seedMatch?.stockQty,
        };
      }
    );
    return {
      products: mergedProducts,
      rounds: Array.isArray(parsed.rounds) ? parsed.rounds : seed.rounds,
      orders: Array.isArray(parsed.orders) ? parsed.orders : seed.orders,
      lots: Array.isArray(parsed.lots) ? parsed.lots : seed.lots,
      claims: Array.isArray(parsed.claims) ? parsed.claims : seed.claims,
      promotions: Array.isArray(parsed.promotions) ? parsed.promotions : seed.promotions,
      users: Array.isArray(parsed.users) ? parsed.users : [],
    };
  } catch {
    const seed = createInitialDatabase();
    fs.writeFileSync(dbPath, JSON.stringify(seed, null, 2), "utf-8");
    return seed;
  }
}

function writeLocalDb(db: DatabaseState) {
  fs.writeFileSync(getLocalDbPath(), JSON.stringify(db, null, 2), "utf-8");
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

function applyDatabaseJoins(db: DatabaseState): DatabaseState {
  const users = Array.isArray(db.users) ? db.users : [];
  const orders = Array.isArray(db.orders) ? db.orders : [];
  const claims = Array.isArray(db.claims) ? db.claims : [];

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
    orders: joinedOrders,
    claims: joinedClaims,
    users: joinedUsers,
  };
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
      return { data: applyDatabaseJoins(sheetData), source: "google-sheets" };
    } catch (err) {
      // Fallback to local if sheet endpoint fails temporarily
      return {
        data: applyDatabaseJoins(readLocalDb()),
        source: "local",
        warning: `เชื่อมต่อ Google Sheet ไม่สำเร็จ (${String(err)}) — กำลังแสดงข้อมูลสำรองในเครื่อง`,
      };
    }
  }
  return { data: applyDatabaseJoins(readLocalDb()), source: "local" };
}

export async function createOrderRecord(order: Order): Promise<Order> {
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
    } else {
      order.userId = `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    }
  }

  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    await callGoogleAppsScriptPost(cfg.googleSheetsWebAppUrl, "createOrder", order);
  }
  // Always mirror locally as backup / instant cache + deduct weight/qty stock
  const db = readLocalDb();
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

export async function createPromotionRecord(promo: Promotion): Promise<Promotion> {
  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    await callGoogleAppsScriptPost(cfg.googleSheetsWebAppUrl, "createPromotion", promo);
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
  if (cfg.googleSheetsWebAppUrl) {
    await callGoogleAppsScriptPost(cfg.googleSheetsWebAppUrl, "updatePromotion", {
      id,
      ...updates,
    });
  }
  const db = readLocalDb();
  const list = Array.isArray(db.promotions) ? db.promotions : [];
  const idx = list.findIndex((p) => p.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updates };
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
  const db = readLocalDb();
  const found = db.users?.find(
    (u) =>
      u.username.toLowerCase() === clean ||
      (u.phone && clean.length >= 9 && u.phone.replace(/[^0-9]/g, "") === clean.replace(/[^0-9]/g, ""))
  );
  if (found) return found;

  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    try {
      const all = await getAllDatabase();
      return (
        all.data.users?.find(
          (u) =>
            u.username.toLowerCase() === clean ||
            (u.phone && clean.length >= 9 && u.phone.replace(/[^0-9]/g, "") === clean.replace(/[^0-9]/g, ""))
        ) || null
      );
    } catch {
      return null;
    }
  }
  return null;
}

export async function getUserById(id: string): Promise<User | null> {
  const db = readLocalDb();
  const found = db.users?.find((u) => u.id === id);
  if (found) return found;

  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    try {
      const all = await getAllDatabase();
      return all.data.users?.find((u) => u.id === id) || null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function createUserRecord(user: User): Promise<User> {
  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    try {
      await callGoogleAppsScriptPost(cfg.googleSheetsWebAppUrl, "createUser", user);
    } catch (err) {
      console.warn("Google Apps Script createUser failed, saved to local cache:", err);
    }
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
  return user;
}

export async function updateUserRecord(
  id: string,
  updates: Partial<User>
): Promise<User | null> {
  const cfg = getRuntimeConfig();
  if (cfg.googleSheetsWebAppUrl) {
    try {
      await callGoogleAppsScriptPost(cfg.googleSheetsWebAppUrl, "updateUser", {
        id,
        ...updates,
      });
    } catch (err) {
      console.warn("Google Apps Script updateUser failed, saved to local cache:", err);
    }
  }

  const db = readLocalDb();
  if (!Array.isArray(db.users)) db.users = [];
  const idx = db.users.findIndex((u) => u.id === id);
  if (idx !== -1) {
    db.users[idx] = {
      ...db.users[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    writeLocalDb(db);
    return db.users[idx];
  }
  return null;
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
}

export async function upsertLineUser(input: UpsertLineUserInput): Promise<User> {
  const cleanLineId = (input.lineUserId || "").trim();
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

  const allUsers = await getAllUsers();
  const existing = allUsers.find(
    (u) =>
      (cleanLineId && u.lineUserId === cleanLineId) ||
      (cleanLineId && u.username === `line_${cleanLineId}`) ||
      (cleanPhone &&
        cleanPhone.length >= 9 &&
        u.phone &&
        u.phone.replace(/[^\d]/g, "") === cleanPhone.replace(/[^\d]/g, ""))
  );

  const now = new Date().toISOString();

  if (existing) {
    const updates: Partial<User> = {
      updatedAt: now,
    };
    if (cleanLineId && !existing.lineUserId) updates.lineUserId = cleanLineId;
    if (cleanDisplay && !existing.displayName) updates.displayName = cleanDisplay;
    if (cleanPhone && (!existing.phone || existing.phone.length < 9)) updates.phone = cleanPhone;
    if (cleanAddress && (!existing.address || existing.address.length < cleanAddress.length)) updates.address = cleanAddress;
    if (postal && !existing.postalCode) updates.postalCode = postal;
    if (input.avatarUrl && !existing.avatarUrl) updates.avatarUrl = input.avatarUrl;
    if (input.source && !existing.source) updates.source = input.source;
    if (input.notes && !existing.notes) updates.notes = input.notes;
    if (firstName && (!existing.firstName || existing.firstName === "ลูกค้า LINE")) {
      updates.firstName = firstName;
      if (lastName) updates.lastName = lastName;
    }

    const updated = await updateUserRecord(existing.id, updates);
    return updated || { ...existing, ...updates };
  }

  const newUser: User = {
    id: `usr_line_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    username: cleanLineId ? `line_${cleanLineId}` : `line_${Date.now()}`,
    lineUserId: cleanLineId || undefined,
    displayName: cleanDisplay || cleanName,
    passwordHash: "LINE_AUTH_NO_PASSWORD",
    firstName,
    lastName,
    phone: cleanPhone,
    address: cleanAddress,
    postalCode: postal,
    avatarUrl:
      input.avatarUrl ||
      "https://api.dicebear.com/7.x/bottts/svg?seed=MonthongKing&backgroundColor=fef08a",
    role: "user",
    source: input.source || "line-login",
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };

  return await createUserRecord(newUser);
}
