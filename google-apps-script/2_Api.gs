// 2_Api.gs — API key และจุดรับคำขอจากเว็บ (doGet / doPost)
// (ส่วนหนึ่งของโปรเจกต์ Apps Script ทุเรียนวินคิน ดูวิธีติดตั้งใน 1_Config.gs)

// ============================================================
// API KEY
// ============================================================

/** รันครั้งเดียวจากหน้า Apps Script editor เพื่อสร้าง key แล้วดูค่าใน Execution log */
function generateApiKey() {
  const key = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
  PropertiesService.getScriptProperties().setProperty("API_KEY", key);
  Logger.log("API key ใหม่ (นำไปใส่ GOOGLE_SHEETS_API_KEY ที่เว็บ): " + key);
  return key;
}

function getApiKey() {
  return PropertiesService.getScriptProperties().getProperty("API_KEY") || "";
}

// ============================================================
// HTTP HANDLERS
// ============================================================

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function errorResponse(err) {
  const msg = String((err && err.message) || err);
  const m = msg.match(/^([A-Z_]+):/);
  return jsonResponse({ ok: false, error: msg, code: m ? m[1] : "ERROR" });
}

/** GET ใช้เช็กสถานะเท่านั้น ไม่คืนข้อมูลและไม่แก้ไขอะไร */
function doGet() {
  return jsonResponse({
    ok: true,
    message: "Durian Winkin Sheets API is ready. Use POST with an API key.",
    secured: Boolean(getApiKey()),
  });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const expectedKey = getApiKey();
    if (!expectedKey) {
      throw new Error("API_KEY_NOT_SET: ยังไม่ได้ตั้ง API key — รันฟังก์ชัน generateApiKey ใน Apps Script ก่อน");
    }
    if (String(body.key || "") !== expectedKey) {
      throw new Error("UNAUTHORIZED: API key ไม่ถูกต้อง");
    }

    const action = body.action;
    const payload = body.payload || {};

    ensureCustomColumns();
    if (action === "ping") return jsonResponse({ ok: true, data: { secured: true } });
    if (action === "getSettings") return jsonResponse({ ok: true, data: readSettingsBundle() });
    // อ่านสลิป: ช้าไม่กี่วินาที ไม่ต้องล็อกชีต
    if (action === "ocrSlip") return jsonResponse({ ok: true, data: ocrSlip(payload) });
    if (action === "getAll") return jsonResponse({ ok: true, data: readAllCached() });

    const lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      const data = handleWrite(action, payload);
      SpreadsheetApp.flush();
      return jsonResponse({ ok: true, data: data });
    } finally {
      // มีการเขียน (สำเร็จหรือไม่ก็ตาม) → ข้อมูลที่จำไว้ใช้ไม่ได้แล้ว
      clearReadAllCache();
      lock.releaseLock();
    }
  } catch (err) {
    return errorResponse(err);
  }
}

function handleWrite(action, payload) {
  switch (action) {
    case "setupSheets":
      return { message: setupDurianWinkinSheets() };
    case "rebuildSheets":
      if (payload.confirm !== "RESET") {
        throw new Error("CONFIRM_REQUIRED: ต้องส่ง confirm = RESET เพื่อยืนยันการล้างข้อมูล");
      }
      return { message: resetAndRebuildAllSheets() };
    case "syncSeed":
      return syncSeedData(payload);
    case "createOrder":
      return createOrder(payload);
    case "updateOrder":
      return updateOrder(payload);
    case "createProduct":
      return insertRow(SHEET_NAMES.PRODUCTS, flattenProduct(payload, true));
    case "updateProduct":
      return updateById(SHEET_NAMES.PRODUCTS, payload.id, flattenProduct(payload, false));
    case "createRound":
      return insertRow(SHEET_NAMES.ROUNDS, payload);
    case "updateRound":
      return updateById(SHEET_NAMES.ROUNDS, payload.id, payload);
    case "createLot":
      return insertRow(SHEET_NAMES.LOTS, payload);
    case "createClaim":
      return insertRow(SHEET_NAMES.CLAIMS, payload);
    case "updateClaim":
      return updateById(SHEET_NAMES.CLAIMS, payload.claimId, payload);
    case "createPromotion":
      return insertRow(SHEET_NAMES.PROMOTIONS, payload);
    case "updatePromotion":
      return updateById(SHEET_NAMES.PROMOTIONS, payload.id, payload);
    case "createUser":
      return createUserRow(normalizeUser(payload));
    case "updateUser":
      return updateById(SHEET_NAMES.USERS, payload.userId || payload.id, normalizeUser(payload));
    case "saveSettings":
      return saveAppSettings(payload.settings || {});
    case "writeSettingsSheet":
      return writeSettingsSheet(payload.rows || []);
    case "saveCustomColumns":
      return saveCustomColumns(payload.table, payload.columns || []);
    case "setConfig": {
      // กลุ่ม/บัญชี LINE แอดมิน เก็บใน Script Properties (เว็บตรวจ PIN ก่อนเรียก)
      const props = PropertiesService.getScriptProperties();
      if (payload.lineAdminGroupId !== undefined) props.setProperty("LINE_ADMIN_GROUP_ID", String(payload.lineAdminGroupId || ""));
      if (payload.lineAdminUserId !== undefined) props.setProperty("LINE_ADMIN_USER_ID", String(payload.lineAdminUserId || ""));
      return {
        lineAdminGroupId: props.getProperty("LINE_ADMIN_GROUP_ID") || "",
        lineAdminUserId: props.getProperty("LINE_ADMIN_USER_ID") || "",
      };
    }
    default:
      throw new Error("UNKNOWN_ACTION: " + action);
  }
}

// ============================================================
// ตั้งค่าร้าน (Token / Secret / Rich menu) — เก็บใน Script Properties ถาวร แก้จากหน้าแอดมินได้
// ============================================================

function readJsonProperty(name, fallback) {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(name);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function readSettingsBundle() {
  const props = PropertiesService.getScriptProperties();
  const settings = readJsonProperty("APP_SETTINGS", {});
  // ค่าที่บอทบันทึกเอง (ผูกกลุ่มแอดมิน) ใช้ค่าเดียวกัน
  if (!settings.lineAdminGroupId && props.getProperty("LINE_ADMIN_GROUP_ID")) settings.lineAdminGroupId = props.getProperty("LINE_ADMIN_GROUP_ID");
  if (!settings.lineAdminUserId && props.getProperty("LINE_ADMIN_USER_ID")) settings.lineAdminUserId = props.getProperty("LINE_ADMIN_USER_ID");
  const schema = {};
  Object.keys(SHEET_DEFS).forEach((name) => {
    schema[name] = {
      file: name === SHEET_NAMES.USERS ? "USER" : "THUREAN",
      idCol: SHEET_DEFS[name].idCol,
      headers: SHEET_DEFS[name].headers.slice(),
      notes: SHEET_DEFS[name].headers.map((h) => HEADER_NOTES[h] || ""),
    };
  });
  return { settings: settings, customColumns: readJsonProperty("CUSTOM_COLUMNS", {}), schema: schema };
}

/** รวมค่าใหม่เข้ากับค่าเดิม — ค่าว่าง/null = ลบคีย์นั้น */
function saveAppSettings(partial) {
  const props = PropertiesService.getScriptProperties();
  const current = readJsonProperty("APP_SETTINGS", {});
  Object.keys(partial).forEach((k) => {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,60}$/.test(k)) return;
    const v = partial[k];
    if (v === null || v === "" || v === undefined) delete current[k];
    else current[k] = typeof v === "object" ? v : String(v);
    if (k === "lineAdminGroupId") props.setProperty("LINE_ADMIN_GROUP_ID", String(v || ""));
    if (k === "lineAdminUserId") props.setProperty("LINE_ADMIN_USER_ID", String(v || ""));
  });
  props.setProperty("APP_SETTINGS", JSON.stringify(current));
  return { keys: Object.keys(current) };
}

// ============================================================
// คอลัมน์เพิ่มเอง (แอดมินเพิ่มจากหน้าเว็บ) — ต่อก่อนคอลัมน์ระบบ isActive
// ============================================================
let _customApplied = false;

function ensureCustomColumns() {
  if (_customApplied) return;
  _customApplied = true;
  const custom = readJsonProperty("CUSTOM_COLUMNS", {});
  Object.keys(custom).forEach((name) => {
    const def = SHEET_DEFS[name];
    if (!def || !Array.isArray(custom[name])) return;
    custom[name].forEach((col) => {
      if (def.headers.indexOf(col) !== -1) return;
      const at = def.headers.indexOf("isActive");
      def.headers.splice(at === -1 ? def.headers.length : at, 0, col);
    });
  });
}

function saveCustomColumns(table, columns) {
  const def = SHEET_DEFS[table];
  if (!def) throw new Error("BAD_TABLE: ไม่มีตาราง " + table);
  const custom = readJsonProperty("CUSTOM_COLUMNS", {});
  const before = custom[table] || [];
  const base = def.headers.filter((h) => before.indexOf(h) === -1);
  const clean = [];
  (columns || []).forEach((c) => {
    const col = String(c || "").trim();
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(col)) throw new Error("BAD_COLUMN: ชื่อคอลัมน์ต้องเป็นภาษาอังกฤษ/ตัวเลข/_ ขึ้นต้นด้วยตัวอักษร: " + col);
    if (base.indexOf(col) !== -1) throw new Error("BAD_COLUMN: คอลัมน์ " + col + " มีอยู่แล้วในระบบ");
    if (clean.indexOf(col) === -1) clean.push(col);
  });
  if (clean.length) custom[table] = clean;
  else delete custom[table];
  PropertiesService.getScriptProperties().setProperty("CUSTOM_COLUMNS", JSON.stringify(custom));
  // ใช้โครงใหม่ทันที: ถอดคอลัมน์เดิมที่เพิ่มเอง แล้วต่อชุดใหม่
  def.headers = base.slice();
  _customApplied = false;
  ensureCustomColumns();
  const message = arrangeColumns(ensureSheet(table), table) || table + ": คอลัมน์ตรงแล้ว";
  _tables = {};
  return { table: table, columns: clean, message: message };
}

/**
 * แท็บ Settings ในไฟล์ USER: สรุปค่าที่ร้านใช้อยู่ (เว็บส่งมาแบบปิดบังค่าลับแล้ว)
 * แก้ค่าที่หน้าแอดมิน → การเชื่อมต่อ เท่านั้น — แก้ในชีตนี้ไม่มีผล
 */
function writeSettingsSheet(rows) {
  const ss = getUserSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS) || ss.insertSheet(SHEET_NAMES.SETTINGS);
  const header = ["หมวด", "การตั้งค่า", "ค่า", "ที่มา", "key"];
  const body = (rows || []).map((r) => [
    String(r.group || ""),
    String(r.label || ""),
    String(r.value || ""),
    String(r.source || ""),
    String(r.key || ""),
  ]);
  sheet.clear();
  sheet.getRange(1, 1, 1, header.length).setValues([header]).setBackground("#7c2d12").setFontColor("#ffffff").setFontWeight("bold");
  if (body.length) {
    sheet.getRange(2, 1, body.length, header.length).setNumberFormat("@").setValues(body);
  }
  const noteRow = body.length + 3;
  sheet.getRange(noteRow, 1).setValue(
    "อัปเดตล่าสุด " + Utilities.formatDate(new Date(), "Asia/Bangkok", "d MMM yyyy HH:mm") +
      " — แก้ค่าที่หน้าแอดมิน › การเชื่อมต่อ เท่านั้น / ค่าลับ (token, secret) เก็บใน Script Properties แสดงที่นี่แบบปิดบัง"
  ).setFontColor("#78716c").setFontStyle("italic");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, header.length);
  // กันแก้ด้วยมือโดยไม่ตั้งใจ (เจ้าของไฟล์ยังแก้ได้ แต่จะมีคำเตือน)
  const existing = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  if (existing.length === 0) sheet.protect().setDescription("แก้ที่หน้าแอดมินเท่านั้น").setWarningOnly(true);
  return { rows: body.length };
}

// ============================================================
// สลิปโอนเงิน: เก็บรูปถาวรใน Google Drive ของร้าน + อ่านตัวหนังสือด้วย OCR ของ Google (ฟรี)
// ครั้งแรกต้องรันฟังก์ชัน authorizeSlipOcr ใน editor แล้วกดอนุญาตสิทธิ์ Drive/Docs หนึ่งครั้ง
// ============================================================

/** โฟลเดอร์หลักเก็บสลิป: SLIP_ROOT_FOLDER_ID ใน 1_Config.gs */
function getSlipRootFolder() {
  return DriveApp.getFolderById(SLIP_ROOT_FOLDER_ID);
}

function childFolder(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/** โฟลเดอร์ของวันนั้น: <หลัก>/2026-11/2026-11-17 (สร้างให้ถ้ายังไม่มี) */
function getSlipDayFolder(date) {
  const tz = "Asia/Bangkok";
  const month = childFolder(getSlipRootFolder(), Utilities.formatDate(date, tz, "yyyy-MM"));
  return childFolder(month, Utilities.formatDate(date, tz, "yyyy-MM-dd"));
}

/** รันครั้งเดียวจาก editor เพื่อให้ Google ขอสิทธิ์ (Drive, Docs, เรียก API) */
function authorizeSlipOcr() {
  // โค้ดรุ่นแรกสร้างโฟลเดอร์ "ทุเรียนวินคิน - สลิปโอนเงิน" ไว้ที่หน้าแรกของ Drive — ย้ายลงถังขยะถ้ายังว่าง (กู้คืนได้)
  const props = PropertiesService.getScriptProperties();
  const oldId = props.getProperty("SLIP_FOLDER_ID");
  if (oldId) {
    try {
      const old = DriveApp.getFolderById(oldId);
      if (old.getName() === "ทุเรียนวินคิน - สลิปโอนเงิน" && !old.getFiles().hasNext() && !old.getFolders().hasNext()) {
        old.setTrashed(true);
        Logger.log("ย้ายโฟลเดอร์ว่างที่สร้างผิดที่ลงถังขยะแล้ว");
      }
    } catch (e) {
      // ไม่มีแล้ว
    }
    props.deleteProperty("SLIP_FOLDER_ID");
  }
  const folder = getSlipDayFolder(new Date());
  DocumentApp.getActiveDocument;
  UrlFetchApp.getRequest;
  Logger.log("พร้อมใช้งาน — โฟลเดอร์เก็บสลิป: " + folder.getUrl());
  return folder.getUrl();
}

/** payload: { base64, mime, orderId, ext } → { text, fileId, fileUrl } — ไฟล์ชื่อ OD000123_20261117-143512.jpg */
function ocrSlip(payload) {
  if (!payload || !payload.base64) throw new Error("MISSING_DATA: ไม่มีรูปสลิป");
  const now = new Date();
  const folder = getSlipDayFolder(now);
  const orderId = String(payload.orderId || "NO-ORDER").replace(/[^A-Za-z0-9_-]/g, "");
  const ext = String(payload.ext || "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 4) || "jpg";
  const name = orderId + "_" + Utilities.formatDate(now, "Asia/Bangkok", "yyyyMMdd-HHmmss") + "." + ext;
  const blob = Utilities.newBlob(Utilities.base64Decode(payload.base64), payload.mime || "image/jpeg", name);
  const file = folder.createFile(blob);

  // แปลงรูปเป็น Google Doc พร้อม OCR ภาษาไทย แล้วอ่านข้อความ (ลบเอกสารชั่วคราวทิ้ง)
  const res = UrlFetchApp.fetch(
    "https://www.googleapis.com/drive/v3/files/" + file.getId() + "/copy?ocrLanguage=th&fields=id",
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ name: "ocr-" + name, mimeType: "application/vnd.google-apps.document", parents: [folder.getId()] }),
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
    }
  );
  if (res.getResponseCode() >= 300) {
    return { text: "", fileId: file.getId(), fileUrl: file.getUrl(), error: "OCR " + res.getResponseCode() };
  }
  const docId = JSON.parse(res.getContentText()).id;
  let text = "";
  try {
    text = DocumentApp.openById(docId).getBody().getText();
  } finally {
    DriveApp.getFileById(docId).setTrashed(true);
  }
  return { text: text, fileId: file.getId(), fileUrl: file.getUrl() };
}

// ============================================================
// แคชผล getAll ไว้ใน CacheService (ล้างทุกครั้งที่เขียนผ่าน API)
// อ่านทั้งหมดจากชีตใช้ 4-5 วินาที — จากแคชเหลือไม่ถึงครึ่งวินาที
// แก้ชีตด้วยมือ: เว็บเห็นค่าใหม่ภายใน READ_ALL_CACHE_SECONDS
// ============================================================
const READ_ALL_CACHE_KEY = "readAll_v1";
const READ_ALL_CACHE_SECONDS = 60;
const READ_ALL_GEN_KEY = "readAll_gen";
const READ_ALL_CHUNK = 25000; // ตัวอักษรต่อชิ้น (ภาษาไทย 3 ไบต์/ตัว ไม่เกินลิมิต 100KB ต่อค่า)

function readAllCached() {
  const cache = CacheService.getScriptCache();
  try {
    const count = Number(cache.get(READ_ALL_CACHE_KEY) || 0);
    if (count > 0) {
      const keys = [];
      for (let i = 0; i < count; i++) keys.push(READ_ALL_CACHE_KEY + "_" + i);
      const parts = cache.getAll(keys);
      if (keys.every((k) => parts[k] !== undefined && parts[k] !== null)) {
        return JSON.parse(keys.map((k) => parts[k]).join(""));
      }
    }
  } catch (err) {
    // แคชเสีย — อ่านจากชีตแทน
  }

  // จำรุ่นไว้ก่อนอ่าน — ถ้ามีการเขียนระหว่างอ่าน ห้ามเก็บข้อมูลชุดนี้ลงแคช
  const gen = cache.get(READ_ALL_GEN_KEY) || "0";
  _readOnly = true;
  let data;
  try {
    data = readAllDatabase();
  } finally {
    _readOnly = false;
  }
  try {
    const json = JSON.stringify(data);
    const chunks = {};
    let n = 0;
    for (let i = 0; i < json.length; i += READ_ALL_CHUNK) chunks[READ_ALL_CACHE_KEY + "_" + n++] = json.slice(i, i + READ_ALL_CHUNK);
    if (n <= 200 && (cache.get(READ_ALL_GEN_KEY) || "0") === gen) {
      cache.putAll(chunks, READ_ALL_CACHE_SECONDS);
      cache.put(READ_ALL_CACHE_KEY, String(n), READ_ALL_CACHE_SECONDS);
    }
  } catch (err) {
    // เก็บแคชไม่ได้ก็ไม่เป็นไร
  }
  return data;
}

function clearReadAllCache() {
  try {
    const cache = CacheService.getScriptCache();
    cache.put(READ_ALL_GEN_KEY, String(Date.now()), 21600);
    cache.remove(READ_ALL_CACHE_KEY);
  } catch (err) {
    // ignore
  }
}
