// ============================================================
// Google Sheets <-> Local Files Synchronization Tool
// ============================================================
// Supports:
//   node scripts/sheets-sync.js pull      (Download latest from Google Sheets -> sheets/*.csv)
//   node scripts/sheets-sync.js push      (Upload edited sheets/*.csv -> Google Sheets)
//   node scripts/sheets-sync.js to-local  (Convert sheets/*.csv -> data/local-db.json)
//   node scripts/sheets-sync.js from-local(Convert data/local-db.json -> sheets/*.csv)
// ============================================================

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SPREADSHEET_ID =
  process.env.THUREAN_SPREADSHEET_ID || "1QQcCxxnuHg9nmAQ-JHmTdIaC2kA-vnJEJpmOvWlgMb8";

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

function toCsv(rows) {
  if (!rows || rows.length === 0) return "";
  const headers = Array.from(
    new Set(rows.flatMap((r) => Object.keys(r || {})))
  );
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
  return [headerLine, ...dataLines].join("\n");
}

function pullFromSheets() {
  ensureDir(SHEETS_DIR);
  console.log(`📥 Pulling from Google Sheets [${SPREADSHEET_ID}]...`);
  for (const tab of TABS) {
    const outPath = path.join(SHEETS_DIR, tab.file);
    console.log(`  -> Exporting tab "${tab.name}" to ${tab.file}...`);
    try {
      execSync(
        `gsheets readonly export ${SPREADSHEET_ID} "${outPath}" --sheet "${tab.name}" --format csv`,
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
  console.log(`📤 Pushing local /sheets/*.csv to Google Sheets [${SPREADSHEET_ID}]...`);
  for (const tab of TABS) {
    const inPath = path.join(SHEETS_DIR, tab.file);
    if (!fs.existsSync(inPath)) {
      console.log(`  ⏩ Skipping ${tab.file} (file not found)`);
      continue;
    }
    // ไฟล์ที่มีแต่หัวคอลัมน์ (แม่แบบ schema) ห้ามอัปโหลด ไม่งั้นข้อมูลจริงในแท็บจะถูกล้าง
    if (parseCsv(fs.readFileSync(inPath, "utf8")).length === 0) {
      console.log(`  ⏩ Skipping ${tab.file} (header only, no data rows)`);
      continue;
    }
    console.log(`  -> Importing ${tab.file} into tab "${tab.name}"...`);
    try {
      execSync(
        `gsheets mutate import-csv ${SPREADSHEET_ID} "${inPath}" --sheet "${tab.name}"`,
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
    const csvStr = toCsv(rows);
    const outPath = path.join(SHEETS_DIR, tab.file);
    fs.writeFileSync(outPath, csvStr, "utf8");
    console.log(`  -> Exported ${rows.length} rows to ${tab.file}`);
  }
  console.log("✅ Exported local-db.json to /sheets/*.csv");
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
  default:
    console.log(`
Usage:
  node scripts/sheets-sync.js pull        ดึงข้อมูลล่าสุดจาก Google Sheets ลงไฟล์ sheets/*.csv
  node scripts/sheets-sync.js push        อัปโหลดไฟล์ sheets/*.csv กลับขึ้น Google Sheets จริง
  node scripts/sheets-sync.js to-local    แปลงไฟล์ sheets/*.csv ลง data/local-db.json
  node scripts/sheets-sync.js from-local  แปลง data/local-db.json ออกมาเป็น sheets/*.csv
`);
}
