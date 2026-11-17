// 5_Setup.gs — ตั้งค่าตาราง / ล้างข้อมูล / ซิงก์ข้อมูลตั้งต้น
// (ส่วนหนึ่งของโปรเจกต์ Apps Script ทุเรียนวินคิน ดูวิธีติดตั้งใน 1_Config.gs)

// ============================================================
// SETUP / RESET / SYNC
// ============================================================

function setupDurianWinkinSheets() {
  ensureCustomColumns();
  _tables = {};
  const log = [];
  Object.keys(SHEET_DEFS).forEach((name) => {
    const def = SHEET_DEFS[name];
    const sheet = ensureSheet(name);
    const arranged = arrangeColumns(sheet, name);
    if (arranged) log.push(arranged);
    styleHeader(sheet, def.color);
    applyHeaderNotes(sheet);

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
  _tables = {};
  log.push("ตรวจโครงสร้างตารางครบทั้ง 7 ตารางแล้ว");
  Logger.log(log.join("\n"));
  return log.join("\n");
}

/**
 * ลบแท็บที่ไม่อยู่ในโครง ทั้ง 2 ไฟล์ (ไฟล์ USER เหลือแค่ Users / ไฟล์ THUREAN เหลือ 6 ตารางร้าน)
 * เช่น ตารางร้านที่ค้างในไฟล์ USER, Users เก่าในไฟล์ THUREAN, ชีต _backup_, ชีตรายงานเก่า
 * กู้คืนได้จาก ไฟล์ → ประวัติเวอร์ชัน ของแต่ละไฟล์
 */
function cleanupExtraSheets() {
  ensureCustomColumns();
  const keepUser = [SHEET_NAMES.USERS];
  const keepThurean = Object.keys(SHEET_DEFS).filter((n) => n !== SHEET_NAMES.USERS);
  const log = [];
  [
    { label: "USER", ss: getUserSpreadsheet(), keep: keepUser },
    { label: "THUREAN", ss: getThureanSpreadsheet(), keep: keepThurean },
  ].forEach((file) => {
    // สร้างตารางที่ต้องมีให้ครบก่อน (ไฟล์ต้องเหลืออย่างน้อย 1 แท็บเสมอ)
    file.keep.forEach((name) => ensureSheet(name));
    file.ss.getSheets().forEach((sheet) => {
      const name = sheet.getName();
      if (file.keep.indexOf(name) !== -1) return;
      const rows = Math.max(0, sheet.getLastRow() - 1);
      file.ss.deleteSheet(sheet);
      log.push(file.label + ": ลบแท็บ " + name + " (" + rows + " แถว)");
    });
    // เรียงแท็บตามโครง
    file.keep.forEach((name, i) => {
      const sh = file.ss.getSheetByName(name);
      file.ss.setActiveSheet(sh);
      file.ss.moveActiveSheet(i + 1);
    });
  });
  _tables = {};
  if (log.length === 0) log.push("ไม่มีแท็บเกิน ทั้ง 2 ไฟล์ตรงโครงแล้ว");
  Logger.log(log.join("\n"));
  return log.join("\n");
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
    const flat = flattenOrder(o, true);
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
