// ============================================================
// Google Sheets <-> Local Files Synchronization Tool
// ============================================================
// Supports:
//   node scripts/sheets-sync.js pull      (Download latest from Google Sheets -> sheets/*.csv)
//   node scripts/sheets-sync.js push      (Upload edited sheets/*.csv -> Google Sheets)
//   node scripts/sheets-sync.js to-local  (Convert sheets/*.csv -> data/local-db.json)
//   node scripts/sheets-sync.js from-local(Convert data/local-db.json -> sheets/*.csv)
//   node scripts/sheets-sync.js schema    (Re-order sheets/*.csv + sheets/README.md to SHEET_DEFS)
//
// โครงตารางต้นฉบับมีที่เดียว: SHEET_DEFS ใน google-apps-script/1_Config.gs
// ============================================================

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const vm = require("vm");

const CONFIG_GS = path.join(__dirname, "..", "google-apps-script", "1_Config.gs");

/** อ่านโครงตารางจาก 1_Config.gs (ไฟล์เดียวกับที่ deploy ขึ้น Apps Script) */
function loadSchema() {
  const ctx = {};
  vm.createContext(ctx);
  const src = fs.readFileSync(CONFIG_GS, "utf8").replace(/^const /gm, "var ");
  vm.runInContext(src, ctx, { filename: "1_Config.gs" });
  return ctx;
}
const SCHEMA = loadSchema();

const THUREAN_ID = process.env.THUREAN_SPREADSHEET_ID || SCHEMA.THUREAN_SPREADSHEET_ID;
const USER_ID = process.env.USER_SPREADSHEET_ID || SCHEMA.USER_SPREADSHEET_ID;
// ตาราง Users อยู่ไฟล์ USER นอกนั้นอยู่ไฟล์ THUREAN
const spreadsheetFor = (tabName) => (tabName === "Users" ? USER_ID : THUREAN_ID);

/** หัวคอลัมน์ตามโครง + คอลัมน์อื่นที่มีในข้อมูล (ต่อท้าย) — ตัดคอลัมน์เลิกใช้ออก */
function headersFor(tabName, rows) {
  const def = SCHEMA.SHEET_DEFS[tabName].headers;
  const retired = SCHEMA.RETIRED_COLUMNS[tabName] || [];
  const extras = Array.from(new Set((rows || []).flatMap((r) => Object.keys(r || {})))).filter(
    (h) => h && !def.includes(h) && !retired.includes(h)
  );
  return def.concat(extras);
}

const SHEETS_DIR = path.join(__dirname, "..", "sheets");
const LOCAL_DB_PATH = path.join(__dirname, "..", "data", "local-db.json");

const TABS = [
  { name: "Products", file: "Products.csv", dbKey: "products" },
  { name: "Orders", file: "Orders.csv", dbKey: "orders" },
  { name: "Users", file: "Users.csv", dbKey: "users" },
  { name: "Rounds", file: "Rounds.csv", dbKey: "rounds" },
  { name: "Lots_Cost", file: "Lots_Cost.csv", dbKey: "lots" },
  { name: "Claims", file: "Claims.csv", dbKey: "claims" },
  { name: "Promotions", file: "Promotions.csv", dbKey: "promotions" },
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const parseLine = (line) => {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] !== undefined ? vals[idx] : "";
    });
    rows.push(obj);
  }
  return rows;
}

function toCsv(rows, tabName) {
  rows = rows || [];
  const headers = headersFor(tabName, rows);
  const escapeCell = (val) => {
    if (val === null || val === undefined) return "";
    const str = typeof val === "object" ? JSON.stringify(val) : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCell).join(",");
  const dataLines = rows.map((r) => headers.map((h) => escapeCell(r[h])).join(","));
  return [headerLine, ...dataLines].join("\n") + "\n";
}

function parseCsvHeader(content) {
  const first = content.split(/\r?\n/)[0] || "";
  return first.split(",").map((h) => h.replace(/^"|"$/g, "").trim());
}

function pullFromSheets() {
  ensureDir(SHEETS_DIR);
  console.log("📥 Pulling from Google Sheets (USER + THUREAN)...");
  for (const tab of TABS) {
    const outPath = path.join(SHEETS_DIR, tab.file);
    console.log(`  -> Exporting tab "${tab.name}" to ${tab.file}...`);
    try {
      execSync(
        `gsheets readonly export ${spreadsheetFor(tab.name)} "${outPath}" --sheet "${tab.name}" --format csv`,
        { stdio: "inherit" }
      );
    } catch (err) {
      console.warn(`  ⚠️ Failed to export tab "${tab.name}":`, err.message);
    }
  }
  console.log("✅ Successfully exported all tabs to /sheets/*.csv");
  console.log("🔄 Updating data/local-db.json...");
  csvToLocalDb();
}

function pushToSheets() {
  ensureDir(SHEETS_DIR);
  console.log("📤 Pushing local /sheets/*.csv to Google Sheets (USER + THUREAN)...");
  for (const tab of TABS) {
    const inPath = path.join(SHEETS_DIR, tab.file);
    if (!fs.existsSync(inPath)) {
      console.log(`  ⏩ Skipping ${tab.file} (file not found)`);
      continue;
    }
    // ไฟล์ที่มีแต่หัวคอลัมน์ (แม่แบบ schema) ห้ามอัปโหลด ไม่งั้นข้อมูลจริงในแท็บจะถูกล้าง
    const content = fs.readFileSync(inPath, "utf8");
    if (parseCsv(content).length === 0) {
      console.log(`  ⏩ Skipping ${tab.file} (header only, no data rows)`);
      continue;
    }
    // หัวคอลัมน์ต้องตรงโครงใน 1_Config.gs ไม่งั้นคอลัมน์บนชีตจริงจะกลับไปเรียงผิด
    const header = parseCsvHeader(content);
    const expected = SCHEMA.SHEET_DEFS[tab.name].headers;
    if (expected.some((h, i) => header[i] !== h)) {
      console.log(`  ⛔ Skipping ${tab.file}: columns differ from SHEET_DEFS — run "npm run sheets:schema" first`);
      continue;
    }
    console.log(`  -> Importing ${tab.file} into tab "${tab.name}"...`);
    try {
      execSync(
        `gsheets mutate import-csv ${spreadsheetFor(tab.name)} "${inPath}" --sheet "${tab.name}"`,
        { stdio: "inherit" }
      );
    } catch (err) {
      console.warn(`  ⚠️ Failed to import tab "${tab.name}":`, err.message);
    }
  }
  console.log("✅ Successfully pushed all CSVs to Google Sheets!");
}

function csvToLocalDb() {
  ensureDir(path.dirname(LOCAL_DB_PATH));
  let currentDb = {};
  if (fs.existsSync(LOCAL_DB_PATH)) {
    try {
      currentDb = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, "utf8"));
    } catch {}
  }

  for (const tab of TABS) {
    const filePath = path.join(SHEETS_DIR, tab.file);
    if (fs.existsSync(filePath)) {
      const csvContent = fs.readFileSync(filePath, "utf8");
      const parsedRows = parseCsv(csvContent);
      currentDb[tab.dbKey] = parsedRows;
    }
  }

  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(currentDb, null, 2), "utf8");
  console.log(`✅ Updated ${LOCAL_DB_PATH} from CSVs.`);
}

function localDbToCsv() {
  ensureDir(SHEETS_DIR);
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    console.error(`❌ ${LOCAL_DB_PATH} not found.`);
    return;
  }
  const db = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, "utf8"));
  for (const tab of TABS) {
    const rows = db[tab.dbKey] || [];
    const csvStr = toCsv(rows, tab.name);
    const outPath = path.join(SHEETS_DIR, tab.file);
    fs.writeFileSync(outPath, csvStr, "utf8");
    console.log(`  -> Exported ${rows.length} rows to ${tab.file}`);
  }
  console.log("✅ Exported local-db.json to /sheets/*.csv");
}

/** จัด sheets/*.csv ให้ตรงโครง (ย้ายข้อมูลตามชื่อคอลัมน์) และเขียนตารางคอลัมน์ใน sheets/README.md ใหม่ */
function syncSchema() {
  ensureDir(SHEETS_DIR);
  for (const tab of TABS) {
    const p = path.join(SHEETS_DIR, tab.file);
    const rows = fs.existsSync(p) ? parseCsv(fs.readFileSync(p, "utf8")) : [];
    const moves = (SCHEMA.RETIRED_MOVES || {})[tab.name] || {};
    rows.forEach((r) => {
      Object.keys(moves).forEach((from) => {
        if (r[from] !== undefined && r[from] !== "" && !r[moves[from]]) r[moves[from]] = r[from];
      });
    });
    fs.writeFileSync(p, toCsv(rows, tab.name), "utf8");
    console.log("  -> " + tab.file + ": " + headersFor(tab.name, rows).length + " columns, " + rows.length + " rows");
  }

  const readme = path.join(SHEETS_DIR, "README.md");
  const START = "<!-- schema:start -->";
  const END = "<!-- schema:end -->";
  const titles = {
    Users: "👤 Users — สมาชิก (ไฟล์ USER)",
    Products: "🍈 Products — สินค้า (ไฟล์ THUREAN)",
    Rounds: "🚚 Rounds — รอบตัด/รอบส่ง (ไฟล์ THUREAN)",
    Orders: "📦 Orders — ออเดอร์ (ไฟล์ THUREAN)",
    Lots_Cost: "💰 Lots_Cost — ต้นทุนล็อต (ไฟล์ THUREAN)",
    Claims: "🛠️ Claims — เคลม (ไฟล์ THUREAN)",
    Promotions: "🎁 Promotions — โปรโมชัน (ไฟล์ THUREAN)",
  };
  const code = (x) => String.fromCharCode(96) + x + String.fromCharCode(96);
  const lines = [
    START,
    "",
    "> สร้างอัตโนมัติจาก " + code("SHEET_DEFS") + " + " + code("HEADER_NOTES") + " ใน " + code("google-apps-script/1_Config.gs") +
      " ด้วย " + code("npm run sheets:schema") + " — แก้โครงที่ 1_Config.gs แล้วรันคำสั่งนี้ อย่าแก้ตรงนี้ด้วยมือ",
    "",
  ];
  for (const name of Object.keys(SCHEMA.SHEET_DEFS)) {
    const def = SCHEMA.SHEET_DEFS[name];
    lines.push("### " + (titles[name] || name), "", "รหัสหลัก: " + code(def.idCol), "", "| # | คอลัมน์ | ความหมาย |", "|---|---|---|");
    def.headers.forEach((h, i) => lines.push("| " + (i + 1) + " | " + code(h) + " | " + String(SCHEMA.HEADER_NOTES[h] || "").replace(/\|/g, "\\|") + " |"));
    const retired = SCHEMA.RETIRED_COLUMNS[name];
    if (retired && retired.length) lines.push("", "เลิกใช้แล้ว (ระบบลบออกจากชีตให้): " + retired.map(code).join(", "));
    lines.push("");
  }
  lines.push(END);
  let md = fs.readFileSync(readme, "utf8").replace(/\r\n/g, "\n");
  const a = md.indexOf(START);
  const b = md.indexOf(END);
  if (a !== -1 && b !== -1) {
    md = md.slice(0, a) + lines.join("\n") + md.slice(b + END.length);
  } else {
    const marker = "## 📋 แผนโครงสร้างคอลัมน์ใหม่ (Schema Definition)";
    const at = md.indexOf(marker);
    if (at === -1) throw new Error("README: schema heading not found");
    md = md.slice(0, at) + "## 📋 โครงสร้างคอลัมน์ (Schema)\n\n" + lines.join("\n") + "\n";
  }
  fs.writeFileSync(readme, md, "utf8");
  console.log("✅ sheets/*.csv + sheets/README.md ตรงกับ SHEET_DEFS แล้ว");
}

const action = (process.argv[2] || "").toLowerCase();
switch (action) {
  case "pull":
    pullFromSheets();
    break;
  case "push":
    pushToSheets();
    break;
  case "to-local":
    csvToLocalDb();
    break;
  case "from-local":
    localDbToCsv();
    break;
  case "schema":
    syncSchema();
    break;
  default:
    console.log(`
Usage:
  node scripts/sheets-sync.js pull        ดึงข้อมูลล่าสุดจาก Google Sheets ลงไฟล์ sheets/*.csv
  node scripts/sheets-sync.js push        อัปโหลดไฟล์ sheets/*.csv กลับขึ้น Google Sheets จริง
  node scripts/sheets-sync.js to-local    แปลงไฟล์ sheets/*.csv ลง data/local-db.json
  node scripts/sheets-sync.js from-local  แปลง data/local-db.json ออกมาเป็น sheets/*.csv
  node scripts/sheets-sync.js schema      จัด sheets/*.csv + sheets/README.md ให้ตรง SHEET_DEFS ใน 1_Config.gs
`);
}
