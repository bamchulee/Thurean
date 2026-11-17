// 3_SheetAccess.gs — อ่าน/เขียนแถว, ออกเลขรัน, เพิ่ม/แก้/upsert
// (ส่วนหนึ่งของโปรเจกต์ Apps Script ทุเรียนวินคิน ดูวิธีติดตั้งใน 1_Config.gs)

// ============================================================
// SHEET ACCESS (อ่านครั้งเดียวต่อคำขอ แล้วใช้ cache ในหน่วยความจำ)
// ============================================================

let _tables = {};

function getUserSpreadsheet() {
  return SpreadsheetApp.openById(USER_SPREADSHEET_ID);
}

// เปิดตามรหัสไฟล์เสมอ (ไม่ใช้ getActiveSpreadsheet) — ถ้าสคริปต์ผูกอยู่กับไฟล์ USER ตารางร้านจะได้ไม่ไปงอกในไฟล์ USER
function getThureanSpreadsheet() {
  return SpreadsheetApp.openById(THUREAN_SPREADSHEET_ID);
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

/** สร้างชีต / เปลี่ยนชื่อหัวคอลัมน์รุ่นเก่า / ถ้าคอลัมน์ขาดจะจัดเรียงทั้งตารางใหม่ตาม SHEET_DEFS */
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
  if (def.headers.some((h) => current.indexOf(h) === -1)) arrangeColumns(sheet, name);
  return sheet;
}

/**
 * จัดคอลัมน์ให้ตรง SHEET_DEFS (ย้ายข้อมูลตามชื่อหัวคอลัมน์ ไม่ใช่ตามตำแหน่ง)
 * - คอลัมน์ใน RETIRED_COLUMNS ถูกลบ
 * - คอลัมน์อื่นที่ไม่อยู่ในโครง: ว่าง = ลบ, มีข้อมูล = ย้ายไปท้ายตาราง
 * - ถ้าจะลบคอลัมน์ที่มีข้อมูล สำรองชีตไว้ก่อนเป็น <ชื่อ>_backup_<วันเวลา>
 * คืนข้อความสรุปสิ่งที่ทำ หรือ "" ถ้าเรียงถูกอยู่แล้ว
 */
function arrangeColumns(sheet, name) {
  const def = SHEET_DEFS[name];
  const retired = RETIRED_COLUMNS[name] || [];
  const values = sheet.getDataRange().getValues();
  const header = values[0].map(String);
  const rows = values.slice(1).filter((r) => r.some((v) => v !== "" && v !== null));
  const hasData = (col) => rows.some((r) => r[col] !== "" && r[col] !== null);

  const extras = [];
  const dropped = [];
  let dropsData = false;
  header.forEach((h, i) => {
    if (!h || def.headers.indexOf(h) !== -1 || extras.indexOf(h) !== -1) return;
    if (retired.indexOf(h) === -1 && hasData(i)) {
      extras.push(h);
    } else {
      dropped.push(h);
      if (hasData(i)) dropsData = true;
    }
  });
  const target = def.headers.concat(extras);
  if (target.length === header.length && target.every((h, i) => h === header[i])) return "";

  if (dropsData) {
    const stamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd_HHmm");
    sheet.copyTo(sheet.getParent()).setName(name + "_backup_" + stamp);
  }

  const idx = {};
  header.forEach((h, i) => {
    if (h && idx[h] === undefined) idx[h] = i;
  });
  const moves = RETIRED_MOVES[name] || {};
  const out = rows.map((r) => {
    const next = target.map((h) => (idx[h] === undefined ? "" : r[idx[h]]));
    Object.keys(moves).forEach((from) => {
      const to = target.indexOf(moves[from]);
      if (idx[from] !== undefined && to !== -1 && (next[to] === "" || next[to] === null)) next[to] = r[idx[from]];
    });
    return next;
  });

  sheet.clear();
  sheet.clearNotes();
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations();
  if (sheet.getMaxColumns() < target.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), target.length - sheet.getMaxColumns());
  const bodyRows = Math.max(1, sheet.getMaxRows() - 1);
  // ตั้งคอลัมน์ข้อความก่อนเขียน กันเบอร์โทร 0 นำหน้าหาย / รหัสยาวกลายเป็นตัวเลข
  target.forEach((h, i) => {
    if (TEXT_COLUMNS[h]) sheet.getRange(2, i + 1, bodyRows, 1).setNumberFormat("@");
  });
  sheet.getRange(1, 1, 1, target.length).setValues([target]);
  if (out.length > 0) sheet.getRange(2, 1, out.length, target.length).setValues(out);
  if (sheet.getMaxColumns() > target.length) {
    sheet.deleteColumns(target.length + 1, sheet.getMaxColumns() - target.length);
  }
  styleHeader(sheet, def.color);
  _tables[name] = undefined;

  const parts = [name + ": จัดเรียงคอลัมน์ใหม่"];
  if (dropped.length) parts.push("ลบ " + dropped.join(", "));
  if (extras.length) parts.push("ย้ายไปท้าย " + extras.join(", "));
  if (dropsData) parts.push("สำรองชีตเดิมไว้แล้ว");
  return parts.join(" / ");
}

/** โน้ตภาษาไทยที่หัวคอลัมน์ (เอาเมาส์ชี้ดูความหมาย) */
function applyHeaderNotes(sheet) {
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  sheet.getRange(1, 1, 1, header.length).setNotes([header.map((h) => HEADER_NOTES[h] || "")]);
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
