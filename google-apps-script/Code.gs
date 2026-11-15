/**
 * ============================================================
 * Google Apps Script — ฐานข้อมูลร้าน "ทุเรียนวินคิน"
 * ============================================================
 * ชีต 2 ไฟล์:
 * 1. USER Sheet    — ตาราง Users (สมาชิก)
 * 2. THUREAN Sheet — Products, Rounds, Orders, Lots_Cost, Claims, Promotions
 *
 * หลักการบันทึกข้อมูล (เวอร์ชันนี้):
 * - ทุกคำขอต้องแนบ API key (ตั้งครั้งแรกด้วยฟังก์ชัน generateApiKey ด้านล่าง)
 * - ทุกการเขียนอยู่ใต้ LockService ทีละคำขอ กันออเดอร์ชนกัน/ตัดสต็อกซ้อน
 * - สร้างออเดอร์: เช็กรหัสซ้ำ + เช็กสต็อกก่อน แล้วค่อยบันทึกและตัดสต็อก
 * - สมาชิก: upsert (มีแล้วอัปเดต ไม่มีค่อยเพิ่ม) ไม่เกิดแถวซ้ำ
 * - syncSeed: upsert ตามรหัส กดซ้ำกี่ครั้งก็ไม่เกิดแถวซ้ำและไม่ตัดสต็อกซ้ำ
 *
 * ติดตั้ง/อัปเดต:
 * 1. วางโค้ดนี้ทับของเดิม แล้วกดบันทึก
 * 2. เลือกฟังก์ชัน generateApiKey แล้วกด Run (ครั้งเดียว) คัดลอก key จาก Execution log
 * 3. นำ key ไปใส่ที่เว็บ: ตัวแปร GOOGLE_SHEETS_API_KEY
 * 4. Deploy > Manage deployments > แก้ไข > Version: New version > Deploy (URL เดิม)
 * ============================================================
 */

const USER_SPREADSHEET_ID = "16Np4KAWCGv9RGIrj3hAqUCeNK1EXjiHLXmBfg849yHQ";
const THUREAN_SPREADSHEET_ID = "1QQcCxxnuHg9nmAQ-JHmTdIaC2kA-vnJEJpmOvWlgMb8";

const SHEET_NAMES = {
  PRODUCTS: "Products",
  ROUNDS: "Rounds",
  ORDERS: "Orders",
  LOTS: "Lots_Cost",
  CLAIMS: "Claims",
  PROMOTIONS: "Promotions",
  USERS: "Users",
};

const AUDIT_HEADERS = ["isActive", "createDate", "createdBy", "updatedAt", "updatedBy"];

const SHEET_DEFS = {
  Users: {
    color: "#1e3a8a",
    idCol: "userId",
    headers: [
      "userId", "lineUserId", "username", "displayName", "firstName", "lastName",
      "phone", "address", "postalCode", "avatarUrl", "role", "source", "notes",
      "passwordHash",
    ].concat(AUDIT_HEADERS),
  },
  Products: {
    color: "#15803d",
    idCol: "id",
    headers: [
      "id", "name", "variety", "type", "price", "marketPrice", "unit", "isAvailable",
      "stockQty", "stockKg", "stockUnit", "avgWeightKg", "ripeness", "weight", "origin",
      "brix", "image", "badge", "description", "maturity", "texture", "flavor",
    ].concat(AUDIT_HEADERS),
  },
  Rounds: {
    color: "#b45309",
    idCol: "id",
    headers: [
      "id", "name", "truckRoute", "harvestDate", "closeDate", "deliveryDate", "status",
      "quotaRemaining", "totalQuota",
    ].concat(AUDIT_HEADERS),
  },
  Orders: {
    color: "#166534",
    idCol: "id",
    headers: [
      "id", "createDate", "roundId", "userId", "customerName", "phone", "address",
      "lineUserId", "ripenessPref", "itemsJson", "itemSummary", "totalPrice",
      "shippingMethod", "shippingCost", "grandTotal", "paymentStatus", "orderStatus",
      "trackingNo", "lotId", "notes", "courier", "slipUrl", "isActive", "createdBy",
      "updatedAt", "updatedBy",
    ],
  },
  Lots_Cost: {
    color: "#7c2d12",
    idCol: "lotId",
    headers: [
      "lotId", "roundId", "date", "supplierName", "supplierPhone", "variety", "weightKg",
      "costPerKg", "totalFruitCost", "packagingCost", "truckFuelCost", "notes",
    ].concat(AUDIT_HEADERS),
  },
  Claims: {
    color: "#991b1b",
    idCol: "claimId",
    headers: [
      "claimId", "createDate", "orderId", "userId", "phone", "reason", "description",
      "evidenceName", "status", "resolutionNote", "lotId", "isActive", "createdBy",
      "updatedAt", "updatedBy",
    ],
  },
  Promotions: {
    color: "#b45309",
    idCol: "id",
    headers: [
      "id", "title", "badge", "discountText", "conditionText", "promoCode",
    ].concat(AUDIT_HEADERS),
  },
};

// คอลัมน์ที่ต้องเก็บเป็น "ข้อความ" เสมอ (กันเลข 0 นำหน้าหาย / เลขพัสดุกลายเป็น 1.2E+15 / วันที่ถูกแปลง)
const TEXT_COLUMNS = {
  phone: 1, supplierPhone: 1, postalCode: 1, trackingNo: 1, promoCode: 1,
  username: 1, passwordHash: 1, createDate: 1, updatedAt: 1, date: 1,
};

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

    if (action === "ping") return jsonResponse({ ok: true, data: { secured: true } });
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
      return upsertRow(SHEET_NAMES.USERS, normalizeUser(payload));
    case "updateUser":
      return updateById(SHEET_NAMES.USERS, payload.userId || payload.id, normalizeUser(payload));
    default:
      throw new Error("UNKNOWN_ACTION: " + action);
  }
}

// ============================================================
// SHEET ACCESS (อ่านครั้งเดียวต่อคำขอ แล้วใช้ cache ในหน่วยความจำ)
// ============================================================

let _tables = {};

function getUserSpreadsheet() {
  return SpreadsheetApp.openById(USER_SPREADSHEET_ID);
}

function getThureanSpreadsheet() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(THUREAN_SPREADSHEET_ID);
  } catch (e) {
    return SpreadsheetApp.openById(THUREAN_SPREADSHEET_ID);
  }
}

function getSpreadsheetFor(sheetName) {
  return sheetName === SHEET_NAMES.USERS ? getUserSpreadsheet() : getThureanSpreadsheet();
}

function styleHeader(sheet, color) {
  const cols = sheet.getLastColumn();
  if (cols === 0) return;
  sheet.getRange(1, 1, 1, cols).setBackground(color).setFontColor("#ffffff").setFontWeight("bold");
  sheet.setFrozenRows(1);
}

/** สร้างชีต/เติมหัวคอลัมน์ที่ขาดให้อัตโนมัติ (ไม่ลบหรือย้ายคอลัมน์เดิม) */
function ensureSheet(name) {
  const def = SHEET_DEFS[name];
  const ss = getSpreadsheetFor(name);
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
    styleHeader(sheet, def.color);
    return sheet;
  }

  const current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const missing = def.headers.filter((h) => current.indexOf(h) === -1);
  if (missing.length > 0) {
    const startCol = current.length + 1;
    const needCols = startCol + missing.length - 1 - sheet.getMaxColumns();
    if (needCols > 0) sheet.insertColumnsAfter(sheet.getMaxColumns(), needCols);
    sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
    styleHeader(sheet, def.color);
  }
  return sheet;
}

function normalizeCell(v) {
  if (v instanceof Date) return v.toISOString();
  return v;
}

function readTable(name) {
  if (_tables[name]) return _tables[name];
  const def = SHEET_DEFS[name];
  const sheet = ensureSheet(name);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  let idIdx = headers.indexOf(def.idCol);
  if (idIdx === -1 && def.idCol === "userId") idIdx = headers.indexOf("id");
  if (idIdx === -1) idIdx = 0;

  const rows = [];
  for (let r = 1; r < values.length; r++) {
    if (values[r][idIdx] === "" || values[r][idIdx] === null) continue;
    const obj = { _row: r + 1 };
    headers.forEach((h, i) => {
      obj[h] = normalizeCell(values[r][i]);
    });
    obj._id = String(values[r][idIdx]);
    rows.push(obj);
  }
  const table = { name: name, def: def, sheet: sheet, headers: headers, rows: rows, lastRow: values.length };
  _tables[name] = table;
  return table;
}

function normalizeActive(v) {
  return v === 0 || v === "0" || v === false || String(v).toUpperCase() === "FALSE" ? 0 : 1;
}

function toCell(header, val) {
  if (val === undefined || val === null) return "";
  if (header === "isActive") return normalizeActive(val);
  if (typeof val === "object") return JSON.stringify(val);
  if (TEXT_COLUMNS[header] && val !== "") return "'" + String(val);
  return val;
}

function findRow(table, idValue, lineUserId) {
  const id = String(idValue || "").toUpperCase();
  let found = id ? table.rows.find((r) => r._id.toUpperCase() === id) : null;
  if (!found && lineUserId && table.name === SHEET_NAMES.USERS) {
    found = table.rows.find((r) => r.lineUserId && String(r.lineUserId) === String(lineUserId));
  }
  return found || null;
}

/** เพิ่มแถวใหม่ — ถ้ารหัสซ้ำจะ error (ไม่เขียนทับ ไม่เกิดแถวซ้ำ) */
function insertRow(name, obj) {
  const table = readTable(name);
  const idVal = obj[table.def.idCol];
  if (idVal === undefined || idVal === null || idVal === "") {
    throw new Error("MISSING_ID: ไม่มีรหัส " + table.def.idCol + " สำหรับตาราง " + name);
  }
  if (findRow(table, idVal)) {
    throw new Error("DUPLICATE_ID: รหัส " + idVal + " มีอยู่แล้วในตาราง " + name);
  }

  const now = new Date().toISOString();
  const row = Object.assign({}, obj);
  row.isActive = row.isActive === undefined || row.isActive === "" ? 1 : normalizeActive(row.isActive);
  row.createDate = row.createDate || row.createdAt || now;
  row.createdBy = row.createdBy || row.userId || row.lineUserId || "system";
  row.updatedAt = row.updatedAt || now;
  row.updatedBy = row.updatedBy || row.createdBy;

  table.sheet.appendRow(table.headers.map((h) => toCell(h, row[h])));
  table.lastRow = table.sheet.getLastRow();

  const cached = { _row: table.lastRow, _id: String(idVal) };
  table.headers.forEach((h) => {
    cached[h] = row[h] === undefined || row[h] === null ? "" : row[h];
  });
  table.rows.push(cached);
  return row;
}

/** เขียนเฉพาะช่องที่ค่าเปลี่ยนจริง (ไม่แตะช่องอื่น/สูตรที่แอดมินใส่เอง) */
function applyUpdates(table, rowObj, updates, touchAudit) {
  const changes = Object.assign({}, updates);
  delete changes[table.def.idCol];
  delete changes.createDate;
  delete changes.createdBy;
  if (touchAudit !== false) changes.updatedAt = new Date().toISOString();

  let changed = 0;
  table.headers.forEach((h, c) => {
    if (changes[h] === undefined) return;
    const next = h === "isActive" ? normalizeActive(changes[h]) : changes[h];
    const nextComparable = next !== null && typeof next === "object" ? JSON.stringify(next) : String(next === null ? "" : next);
    if (String(rowObj[h]) === nextComparable) return;
    table.sheet.getRange(rowObj._row, c + 1).setValue(toCell(h, next));
    rowObj[h] = next === null ? "" : next;
    changed++;
  });
  return changed;
}

function updateById(name, idValue, updates) {
  const table = readTable(name);
  const row = findRow(table, idValue, updates && updates.lineUserId);
  if (!row) return null;
  applyUpdates(table, row, updates);
  return Object.assign({}, updates, { updatedAt: row.updatedAt });
}

/** มีแล้วอัปเดต ไม่มีค่อยเพิ่ม */
function upsertRow(name, obj, touchAudit) {
  const table = readTable(name);
  const row = findRow(table, obj[table.def.idCol], obj.lineUserId);
  if (row) {
    applyUpdates(table, row, obj, touchAudit);
    return obj;
  }
  return insertRow(name, obj);
}

// ============================================================
// แปลง object จากเว็บให้ตรงกับคอลัมน์ในชีต
// ============================================================

function normalizeUser(u) {
  const out = Object.assign({}, u);
  const id = u.userId || u.id;
  if (id) out.userId = id;
  delete out.id;
  delete out.orderCount;
  delete out.totalSpent;
  return out;
}

function flattenProduct(p, isNew) {
  const out = {};
  Object.keys(p || {}).forEach((k) => {
    if (k === "specs") {
      const s = p.specs || {};
      if (s.maturity !== undefined) out.maturity = s.maturity;
      if (s.texture !== undefined) out.texture = s.texture;
      if (s.flavor !== undefined) out.flavor = s.flavor;
    } else {
      out[k] = p[k];
    }
  });
  if (out.price !== undefined) out.price = Number(out.price) || 0;
  if (out.isAvailable !== undefined) {
    out.isAvailable = out.isAvailable === true || String(out.isAvailable).toUpperCase() === "TRUE";
  }
  if (isNew) {
    if (out.isAvailable === undefined) out.isAvailable = true;
    if (!out.stockUnit) out.stockUnit = out.type === "flesh" ? "qty" : "kg";
    if (!out.createdBy) out.createdBy = "admin";
  }
  return out;
}

function flattenOrder(o) {
  const out = {};
  Object.keys(o || {}).forEach((k) => {
    if (k === "items") {
      const items = Array.isArray(o.items) ? o.items : [];
      out.itemsJson = JSON.stringify(items);
      out.itemSummary = items.map((it) => it.productName + " x" + it.qty).join(", ");
    } else if (k !== "createdAt") {
      out[k] = o[k];
    }
  });
  if (!out.createDate && o.createdAt) out.createDate = o.createdAt;
  if (out.totalPrice !== undefined) out.totalPrice = Number(out.totalPrice) || 0;
  if (out.shippingCost !== undefined) out.shippingCost = Number(out.shippingCost) || 0;
  return out;
}

// ============================================================
// ORDERS: บันทึกออเดอร์ + ตัดสต็อก + ตัดโควต้ารอบ ในล็อกเดียวกัน
// ============================================================

function hasNumber(v) {
  return v !== "" && v !== undefined && v !== null && !isNaN(Number(v));
}

/** คืนแผนตัดสต็อกของสินค้า 1 ตัว หรือ error ถ้าของไม่พอ (ช่องสต็อกว่าง = ไม่นับสต็อก) */
function planStockDeduction(p, qty) {
  const updates = {};
  const isQtyBased = p.stockUnit === "qty" || p.type === "flesh";
  const avg = Number(p.avgWeightKg) > 0 ? Number(p.avgWeightKg) : isQtyBased ? 1 : 3;
  const unit = p.unit || "ชิ้น";

  if (isQtyBased && hasNumber(p.stockQty)) {
    const left = Number(p.stockQty);
    if (qty > left) return { error: "เหลือ " + Math.max(0, left) + " " + unit };
    updates.stockQty = left - qty;
    if (updates.stockQty <= 0) updates.isAvailable = false;
    if (hasNumber(p.stockKg)) {
      updates.stockKg = Math.max(0, Number((Number(p.stockKg) - qty * avg).toFixed(1)));
    }
    return { updates: updates };
  }

  if (hasNumber(p.stockKg)) {
    const kg = Number(p.stockKg);
    const available = kg <= 0 ? 0 : Math.max(1, Math.floor(kg / avg));
    if (qty > available) return { error: "เหลือประมาณ " + available + " " + unit };
    updates.stockKg = Math.max(0, Number((kg - qty * avg).toFixed(1)));
    if (updates.stockKg <= 0) updates.isAvailable = false;
  }
  return { updates: updates };
}

function createOrder(order) {
  if (!order || !order.id) throw new Error("MISSING_ID: ออเดอร์ไม่มีรหัส");
  const orders = readTable(SHEET_NAMES.ORDERS);
  if (findRow(orders, order.id)) {
    throw new Error("DUPLICATE_ID: รหัสออเดอร์ " + order.id + " ถูกใช้แล้ว");
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const need = {};
  items.forEach((it) => {
    const pid = String(it.productId);
    need[pid] = (need[pid] || 0) + Math.max(1, Math.floor(Number(it.qty) || 1));
  });

  // 1) เช็กสต็อกทุกรายการก่อน ถ้าไม่พอแม้รายการเดียวจะไม่บันทึกอะไรเลย
  const products = readTable(SHEET_NAMES.PRODUCTS);
  const plans = [];
  Object.keys(need).forEach((pid) => {
    const p = findRow(products, pid);
    if (!p) return;
    const plan = planStockDeduction(p, need[pid]);
    if (plan.error) throw new Error("OUT_OF_STOCK: " + p.name + " " + plan.error);
    plans.push({ row: p, updates: plan.updates });
  });

  // 2) บันทึกออเดอร์
  const flat = flattenOrder(order);
  flat.grandTotal = (Number(flat.totalPrice) || 0) + (Number(flat.shippingCost) || 0);
  flat.paymentStatus = flat.paymentStatus || "pending";
  flat.orderStatus = flat.orderStatus || "received";
  flat.createdBy = flat.createdBy || flat.userId || "customer";
  insertRow(SHEET_NAMES.ORDERS, flat);

  // 3) ตัดสต็อก + โควต้ารอบ
  plans.forEach((pl) => {
    if (Object.keys(pl.updates).length > 0) applyUpdates(products, pl.row, pl.updates);
  });
  if (order.roundId) {
    const rounds = readTable(SHEET_NAMES.ROUNDS);
    const round = findRow(rounds, order.roundId);
    if (round) {
      const qtySum = Object.keys(need).reduce((s, k) => s + need[k], 0);
      applyUpdates(rounds, round, {
        quotaRemaining: Math.max(0, (Number(round.quotaRemaining) || 0) - qtySum),
      });
    }
  }
  return order;
}

function updateOrder(payload) {
  const table = readTable(SHEET_NAMES.ORDERS);
  const row = findRow(table, payload.id);
  if (!row) return null;
  const flat = flattenOrder(payload);
  if (flat.totalPrice !== undefined || flat.shippingCost !== undefined) {
    const total = flat.totalPrice !== undefined ? flat.totalPrice : Number(row.totalPrice) || 0;
    const ship = flat.shippingCost !== undefined ? flat.shippingCost : Number(row.shippingCost) || 0;
    flat.grandTotal = total + ship;
  }
  applyUpdates(table, row, flat);
  return Object.assign({}, payload, { updatedAt: row.updatedAt });
}

// ============================================================
// SETUP / RESET / SYNC
// ============================================================

function setupDurianWinkinSheets() {
  _tables = {};
  Object.keys(SHEET_DEFS).forEach((name) => {
    const def = SHEET_DEFS[name];
    const sheet = ensureSheet(name);
    styleHeader(sheet, def.color);

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    const dataRows = Math.max(1, sheet.getMaxRows() - 1);

    // คอลัมน์ข้อความ: ตั้งรูปแบบเป็น Plain text ทั้งคอลัมน์
    headers.forEach((h, i) => {
      if (TEXT_COLUMNS[h]) sheet.getRange(2, i + 1, dataRows, 1).setNumberFormat("@");
    });

    // แถวเก่าที่ isActive ว่าง ให้เป็น 1
    const lastRow = sheet.getLastRow();
    const activeIdx = headers.indexOf("isActive");
    if (lastRow > 1 && activeIdx !== -1) {
      const range = sheet.getRange(2, activeIdx + 1, lastRow - 1, 1);
      const values = range.getValues();
      let dirty = false;
      values.forEach((v) => {
        if (v[0] === "" || v[0] === null) {
          v[0] = 1;
          dirty = true;
        }
      });
      if (dirty) range.setValues(values);
    }
  });
  return "ตรวจโครงสร้างตารางครบทั้ง 7 ตารางแล้ว";
}

/** ล้างข้อมูลเฉพาะตารางของระบบ (ไม่แตะชีตอื่นที่สร้างไว้เอง) */
function resetAndRebuildAllSheets() {
  _tables = {};
  Object.keys(SHEET_DEFS).forEach((name) => {
    const sheet = ensureSheet(name);
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    }
  });
  _tables = {};
  return setupDurianWinkinSheets();
}

/** ส่งข้อมูลจากเว็บขึ้นชีตแบบ upsert — ไม่ตัดสต็อก ไม่เกิดแถวซ้ำ */
function syncSeedData(seed) {
  let count = 0;
  const each = (list, fn) => {
    (Array.isArray(list) ? list : []).forEach((item) => {
      fn(item);
      count++;
    });
  };

  each(seed.products, (p) => upsertRow(SHEET_NAMES.PRODUCTS, flattenProduct(p, true), false));
  each(seed.rounds, (r) => upsertRow(SHEET_NAMES.ROUNDS, r, false));
  each(seed.orders, (o) => {
    const flat = flattenOrder(o);
    flat.grandTotal = (Number(flat.totalPrice) || 0) + (Number(flat.shippingCost) || 0);
    upsertRow(SHEET_NAMES.ORDERS, flat, false);
  });
  each(seed.lots, (l) => upsertRow(SHEET_NAMES.LOTS, l, false));
  each(seed.claims, (c) => {
    const flat = Object.assign({}, c);
    if (!flat.createDate && flat.createdAt) flat.createDate = flat.createdAt;
    upsertRow(SHEET_NAMES.CLAIMS, flat, false);
  });
  each(seed.promotions, (pr) => upsertRow(SHEET_NAMES.PROMOTIONS, pr, false));
  each(seed.users, (u) => upsertRow(SHEET_NAMES.USERS, normalizeUser(u), false));
  return { syncedItems: count };
}

// ============================================================
// READ ALL
// ============================================================

function cleanDigits(val) {
  return String(val || "").replace(/[^\d]/g, "");
}

function optStr(v) {
  return v === "" || v === undefined || v === null ? undefined : String(v);
}

function optNum(v) {
  return hasNumber(v) ? Number(v) : undefined;
}

function readAllDatabase() {
  const products = readTable(SHEET_NAMES.PRODUCTS).rows.map((p) => ({
    id: String(p.id),
    name: String(p.name),
    variety: String(p.variety),
    type: p.type === "flesh" ? "flesh" : "whole",
    ripeness: String(p.ripeness || ""),
    weight: String(p.weight || ""),
    price: Number(p.price) || 0,
    marketPrice: optNum(p.marketPrice),
    unit: String(p.unit || "ลูก"),
    origin: String(p.origin || ""),
    brix: String(p.brix || ""),
    image: String(p.image || ""),
    badge: optStr(p.badge),
    isAvailable: p.isAvailable === true || String(p.isAvailable).toUpperCase() === "TRUE",
    description: String(p.description || ""),
    stockUnit: p.stockUnit === "qty" ? "qty" : "kg",
    stockKg: optNum(p.stockKg),
    avgWeightKg: optNum(p.avgWeightKg),
    stockQty: optNum(p.stockQty),
    specs: {
      maturity: String(p.maturity || ""),
      texture: String(p.texture || ""),
      flavor: String(p.flavor || ""),
    },
    isActive: normalizeActive(p.isActive),
    createDate: String(p.createDate || ""),
    createdBy: String(p.createdBy || "admin"),
    updatedAt: String(p.updatedAt || ""),
    updatedBy: String(p.updatedBy || ""),
  }));

  const rounds = readTable(SHEET_NAMES.ROUNDS).rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    truckRoute: String(r.truckRoute || ""),
    harvestDate: String(r.harvestDate || ""),
    closeDate: String(r.closeDate || ""),
    deliveryDate: String(r.deliveryDate || ""),
    status: String(r.status || "open"),
    quotaRemaining: Number(r.quotaRemaining) || 0,
    totalQuota: Number(r.totalQuota) || 0,
    isActive: normalizeActive(r.isActive),
    createDate: String(r.createDate || ""),
    createdBy: String(r.createdBy || "admin"),
    updatedAt: String(r.updatedAt || ""),
    updatedBy: String(r.updatedBy || ""),
  }));

  const users = readTable(SHEET_NAMES.USERS).rows.map((u) => {
    const idVal = String(u.userId || u.id || "");
    return {
      id: idVal,
      userId: idVal,
      username: String(u.username || (u.lineUserId ? "line_" + u.lineUserId : idVal)),
      lineUserId: optStr(u.lineUserId),
      displayName: optStr(u.displayName),
      passwordHash: optStr(u.passwordHash),
      firstName: String(u.firstName || ""),
      lastName: String(u.lastName || ""),
      phone: String(u.phone || ""),
      address: String(u.address || ""),
      postalCode: String(u.postalCode || ""),
      avatarUrl: optStr(u.avatarUrl),
      role: String(u.role || "user"),
      source: optStr(u.source),
      notes: optStr(u.notes),
      isActive: normalizeActive(u.isActive),
      createDate: String(u.createDate || ""),
      createdBy: String(u.createdBy || "system"),
      createdAt: String(u.createDate || ""),
      updatedAt: String(u.updatedAt || ""),
      updatedBy: String(u.updatedBy || ""),
    };
  });

  const orders = readTable(SHEET_NAMES.ORDERS).rows.map((o) => {
    let items = [];
    try {
      items = JSON.parse(o.itemsJson || "[]");
    } catch (e) {
      items = [];
    }
    const phoneClean = cleanDigits(o.phone);
    const matchedUser = users.find(
      (u) =>
        (o.userId && u.id === String(o.userId)) ||
        (o.lineUserId && u.lineUserId === String(o.lineUserId)) ||
        (phoneClean && u.phone && cleanDigits(u.phone) === phoneClean)
    );
    return {
      id: String(o.id),
      createdAt: String(o.createDate || ""),
      createDate: String(o.createDate || ""),
      createdBy: String(o.createdBy || o.userId || "customer"),
      roundId: String(o.roundId || ""),
      userId: o.userId ? String(o.userId) : matchedUser ? matchedUser.id : undefined,
      customerName: String(o.customerName || ""),
      phone: String(o.phone || ""),
      address: String(o.address || ""),
      lineUserId: o.lineUserId ? String(o.lineUserId) : matchedUser ? matchedUser.lineUserId : undefined,
      ripenessPref: optStr(o.ripenessPref),
      items: items,
      totalPrice: Number(o.totalPrice) || 0,
      shippingMethod: String(o.shippingMethod || ""),
      shippingCost: Number(o.shippingCost) || 0,
      paymentStatus: String(o.paymentStatus || "pending"),
      orderStatus: String(o.orderStatus || "received"),
      trackingNo: optStr(o.trackingNo),
      courier: optStr(o.courier),
      slipUrl: optStr(o.slipUrl),
      lotId: optStr(o.lotId),
      notes: optStr(o.notes),
      isActive: normalizeActive(o.isActive),
      updatedAt: String(o.updatedAt || ""),
      updatedBy: String(o.updatedBy || ""),
    };
  });

  const claims = readTable(SHEET_NAMES.CLAIMS).rows.map((c) => {
    const phoneClean = cleanDigits(c.phone);
    const matchedOrder = orders.find((o) => o.id === String(c.orderId));
    const matchedUser = users.find(
      (u) =>
        (c.userId && u.id === String(c.userId)) ||
        (phoneClean && u.phone && cleanDigits(u.phone) === phoneClean)
    );
    return {
      claimId: String(c.claimId),
      createdAt: String(c.createDate || ""),
      createDate: String(c.createDate || ""),
      createdBy: String(c.createdBy || c.userId || "customer"),
      orderId: String(c.orderId || ""),
      userId: c.userId
        ? String(c.userId)
        : (matchedOrder && matchedOrder.userId) || (matchedUser && matchedUser.id) || undefined,
      phone: String(c.phone || ""),
      reason: String(c.reason || ""),
      description: String(c.description || ""),
      evidenceName: optStr(c.evidenceName),
      status: String(c.status || "pending"),
      resolutionNote: optStr(c.resolutionNote),
      lotId: optStr(c.lotId),
      isActive: normalizeActive(c.isActive),
      updatedAt: String(c.updatedAt || ""),
      updatedBy: String(c.updatedBy || ""),
    };
  });

  const usersWithStats = users.map((u) => {
    const userOrders = orders.filter(
      (o) =>
        (o.userId && o.userId === u.id) ||
        (u.lineUserId && o.lineUserId === u.lineUserId) ||
        (u.phone && cleanDigits(u.phone) === cleanDigits(o.phone))
    );
    return Object.assign({}, u, {
      orderCount: userOrders.length,
      totalSpent: userOrders.reduce((sum, o) => sum + o.totalPrice + o.shippingCost, 0),
    });
  });

  const lots = readTable(SHEET_NAMES.LOTS).rows.map((l) => ({
    lotId: String(l.lotId),
    roundId: String(l.roundId || ""),
    date: String(l.date || ""),
    supplierName: String(l.supplierName || ""),
    supplierPhone: optStr(l.supplierPhone),
    variety: String(l.variety || ""),
    weightKg: Number(l.weightKg) || 0,
    costPerKg: Number(l.costPerKg) || 0,
    totalFruitCost: Number(l.totalFruitCost) || 0,
    packagingCost: Number(l.packagingCost) || 0,
    truckFuelCost: Number(l.truckFuelCost) || 0,
    notes: optStr(l.notes),
    isActive: normalizeActive(l.isActive),
    createDate: String(l.createDate || l.date || ""),
    createdBy: String(l.createdBy || "admin"),
    updatedAt: String(l.updatedAt || ""),
    updatedBy: String(l.updatedBy || ""),
  }));

  const promotions = readTable(SHEET_NAMES.PROMOTIONS).rows.map((pr) => ({
    id: String(pr.id),
    title: String(pr.title || ""),
    badge: optStr(pr.badge),
    discountText: String(pr.discountText || ""),
    conditionText: String(pr.conditionText || ""),
    promoCode: optStr(pr.promoCode),
    isActive: normalizeActive(pr.isActive),
    createDate: String(pr.createDate || ""),
    createdBy: String(pr.createdBy || "admin"),
    updatedAt: String(pr.updatedAt || ""),
    updatedBy: String(pr.updatedBy || ""),
  }));

  return {
    products: products,
    rounds: rounds,
    orders: orders,
    lots: lots,
    claims: claims,
    promotions: promotions,
    users: usersWithStats,
  };
}
