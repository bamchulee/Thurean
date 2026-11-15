// 7_Migrate.gs — จัดระเบียบข้อมูลเก่า (รันเองครั้งเดียว)
// (ส่วนหนึ่งของโปรเจกต์ Apps Script ทุเรียนวินคิน ดูวิธีติดตั้งใน 1_Config.gs)

// ============================================================
// จัดระเบียบข้อมูลเก่า — รันเองครั้งเดียวจากหน้า Apps Script editor
// ============================================================

/**
 * 1. ลบแถวที่รหัสซ้ำในทุกตาราง (เก็บแถวแรก เติมช่องว่างจากแถวที่ซ้ำ)
 * 2. เปลี่ยนรหัสสมาชิกที่ไม่ใช่รูปแบบ USR-00001 ให้เป็นเลขรัน เรียงตามวันที่สมัคร
 *    แล้วแก้ userId ใน Orders / Claims ให้ตรงด้วย
 * 3. ไม่เปลี่ยนเลขออเดอร์/เลขเคลมเดิม เพราะลูกค้าถือเลขนั้นอยู่
 * รันซ้ำได้ ไม่เสียหาย (รอบที่สองจะไม่มีอะไรเปลี่ยน)
 */
function migrateToRunningIds() {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    _tables = {};
    setupDurianWinkinSheets();
    _tables = {};
    const report = { duplicatesRemoved: {}, usersRenumbered: 0, ordersRelinked: 0, claimsRelinked: 0 };

    Object.keys(SHEET_DEFS).forEach((name) => {
      report.duplicatesRemoved[name] = removeDuplicateRows(name);
    });
    _tables = {};

    const users = readTable(SHEET_NAMES.USERS);
    const fmt = ID_FORMATS.Users;
    const isRunning = (id) => new RegExp("^" + fmt.prefix + "\\d+$").test(id);
    const legacy = users.rows
      .filter((r) => !isRunning(r._id))
      .sort((a, b) => String(a.createDate || "").localeCompare(String(b.createDate || "")) || a._row - b._row);

    const idMap = {};
    const idCol = users.headers.indexOf("userId") + 1;
    legacy.forEach((r) => {
      const newId = nextId(users);
      idMap[r._id] = newId;
      users.sheet.getRange(r._row, idCol).setValue(newId);
      r._id = newId;
      r.userId = newId;
      report.usersRenumbered++;
    });

    [[SHEET_NAMES.ORDERS, "ordersRelinked"], [SHEET_NAMES.CLAIMS, "claimsRelinked"]].forEach((pair) => {
      const t = readTable(pair[0]);
      const col = t.headers.indexOf("userId");
      if (col === -1) return;
      t.rows.forEach((r) => {
        const mapped = idMap[String(r.userId)];
        if (mapped) {
          t.sheet.getRange(r._row, col + 1).setValue(mapped);
          report[pair[1]]++;
        }
      });
    });

    SpreadsheetApp.flush();
    _tables = {};
    Logger.log(JSON.stringify(report, null, 2));
    return report;
  } finally {
    lock.releaseLock();
  }
}

function removeDuplicateRows(name) {
  _tables = {};
  const table = readTable(name);
  const seen = {};
  const toDelete = [];
  table.rows.forEach((r) => {
    const key = r._id.toUpperCase();
    const keep = seen[key];
    if (!keep) {
      seen[key] = r;
      return;
    }
    // เติมช่องที่แถวแรกว่างจากแถวที่ซ้ำ ก่อนลบแถวที่ซ้ำทิ้ง
    table.headers.forEach((h, c) => {
      if ((keep[h] === "" || keep[h] === undefined) && r[h] !== "" && r[h] !== undefined) {
        table.sheet.getRange(keep._row, c + 1).setValue(toCell(h, r[h]));
        keep[h] = r[h];
      }
    });
    toDelete.push(r._row);
  });
  toDelete.sort((a, b) => b - a).forEach((row) => table.sheet.deleteRow(row));
  _tables = {};
  return toDelete.length;
}
