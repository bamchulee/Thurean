// สร้าง public/data/th-address.json จากแพ็กเกจ thai-address-database (devDependency)
// รูปแบบ: { "จังหวัด": { "อำเภอ/เขต": [["ตำบล/แขวง", "รหัสไปรษณีย์"], ...] } }
// รันใหม่เมื่ออัปเดตแพ็กเกจ:  node scripts/build-thai-address.js
const fs = require("fs");
const path = require("path");
const db = require("thai-address-database");

const provinces = new Set();
// ดึงรายชื่อจังหวัดจากรหัสไปรษณีย์ 1-9 (ครอบคลุมทุกจังหวัด)
for (let d = 1; d <= 9; d++) db.searchAddressByZipcode(String(d), 100000).forEach((r) => provinces.add(r.province));

const out = {};
let rows = 0;
for (const p of [...provinces].sort((a, b) => a.localeCompare(b, "th"))) {
  const entries = db.searchAddressByProvince(p, 100000).filter((r) => r.province === p);
  const amphoes = {};
  for (const r of entries) {
    const list = (amphoes[r.amphoe] = amphoes[r.amphoe] || []);
    if (!list.some(([d, z]) => d === r.district && z === String(r.zipcode))) list.push([r.district, String(r.zipcode)]);
    rows++;
  }
  const sorted = {};
  for (const a of Object.keys(amphoes).sort((x, y) => x.localeCompare(y, "th"))) {
    sorted[a] = amphoes[a].sort((x, y) => x[0].localeCompare(y[0], "th"));
  }
  out[p] = sorted;
}

const dir = path.join(__dirname, "..", "public", "data");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, "th-address.json");
fs.writeFileSync(file, JSON.stringify(out));
console.log(`provinces=${Object.keys(out).length} rows=${rows} size=${(fs.statSync(file).size / 1024).toFixed(0)}KB`);
