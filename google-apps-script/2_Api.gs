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
    if (action === "getAll") return jsonResponse({ ok: true, data: readAllDatabase() });

    const lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      const data = handleWrite(action, payload);
      SpreadsheetApp.flush();
      return jsonResponse({ ok: true, data: data });
    } finally {
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
