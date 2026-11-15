// 3_SheetAccess.gs — อ่าน/เขียนแถว, ออกเลขรัน, เพิ่ม/แก้/upsert
// (ส่วนหนึ่งของโปรเจกต์ Apps Script ทุเรียนวินคิน ดูวิธีติดตั้งใน 1_Config.gs)

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
  Object.keys(HEADER_ALIASES).forEach((oldName) => {
    const target = HEADER_ALIASES[oldName];
    const at = current.indexOf(oldName);
    if (at !== -1 && def.headers.indexOf(target) !== -1 && def.headers.indexOf(oldName) === -1 && current.indexOf(target) === -1) {
      sheet.getRange(1, at + 1).setValue(target);
      current[at] = target;
    }
  });
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

/** รหัสถัดไปของตาราง (เรียกภายใต้ล็อกเท่านั้น) */
function nextId(table) {
  const fmt = ID_FORMATS[table.name];
  const esc = fmt.prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp("^" + esc + "(\\d+)$", "i");
  let max = 0;
  table.rows.forEach((r) => {
    const m = String(r._id).match(re);
    if (m) max = Math.max(max, Number(m[1]));
  });
  let num = String(max + 1);
  while (num.length < fmt.pad) num = "0" + num;
  return fmt.prefix + num;
}

/**
 * เพิ่มแถวใหม่
 * - ไม่มีรหัส หรือส่ง _autoId มา: สคริปต์ออกเลขรันให้เอง
 * - ระบุรหัสมาเอง: ถ้าซ้ำจะ error (ไม่เขียนทับ ไม่เกิดแถวซ้ำ)
 */
function insertRow(name, obj) {
  const table = readTable(name);
  obj = Object.assign({}, obj);
  if (obj._autoId || obj[table.def.idCol] === undefined || obj[table.def.idCol] === null || obj[table.def.idCol] === "") {
    obj[table.def.idCol] = nextId(table);
  }
  delete obj._autoId;
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

/**
 * สมัคร/ล็อกอินครั้งแรก: คน LINE เดิมอัปเดตแถวเดิม นอกนั้นสร้างแถวใหม่พร้อมเลข USR- ใหม่
 * (ไม่จับคู่ด้วย userId ที่เว็บส่งมา เพราะเป็นแค่เลขชั่วคราว)
 */
function createUserRow(user) {
  const table = readTable(SHEET_NAMES.USERS);
  if (user.lineUserId) {
    const row = table.rows.find((r) => r.lineUserId && String(r.lineUserId) === String(user.lineUserId));
    if (row) {
      const updates = Object.assign({}, user);
      delete updates.userId;
      applyUpdates(table, row, updates);
      return Object.assign({}, user, { userId: row._id });
    }
  }
  const fresh = Object.assign({}, user, { _autoId: true });
  return insertRow(SHEET_NAMES.USERS, fresh);
}
