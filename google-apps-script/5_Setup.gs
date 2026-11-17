// 5_Setup.gs — ตั้งค่าตาราง / ล้างข้อมูล / ซิงก์ข้อมูลตั้งต้น
// (ส่วนหนึ่งของโปรเจกต์ Apps Script ทุเรียนวินคิน ดูวิธีติดตั้งใน 1_Config.gs)

// ============================================================
// SETUP / RESET / SYNC
// ============================================================

function setupDurianWinkinSheets() {
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
