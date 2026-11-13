// ============================================================
// Sync and Format Google Sheets to Match ER Diagram
// ============================================================
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const USER_SHEET_ID = "16Np4KAWCGv9RGIrj3hAqUCeNK1EXjiHLXmBfg849yHQ";
const THUREAN_SHEET_ID = "1QQcCxxnuHg9nmAQ-JHmTdIaC2kA-vnJEJpmOvWlgMb8";

function runGsheets(cmd) {
  console.log(`> gsheets ${cmd}`);
  const output = execSync(`gsheets ${cmd}`, { encoding: "utf-8" });
  console.log(output.trim());
  return output;
}

function runBatch(spreadsheetId, requests) {
  const tmpFile = path.join(__dirname, `batch-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(requests, null, 2), "utf-8");
  try {
    runGsheets(`mutate batch ${spreadsheetId} -f "${tmpFile}"`);
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

async function main() {
  console.log("=== STARTING FULL ER DIAGRAM ALIGNMENT FOR BOTH SHEETS ===");

  // -------------------------------------------------------------
  // 1. UPDATE USER SHEET (16Np4KAWCGv9RGIrj3hAqUCeNK1EXjiHLXmBfg849yHQ)
  // -------------------------------------------------------------
  console.log("\n--- [1] Updating Users tab in User Spreadsheet ---");
  const userHeaders = [
    "userId",
    "lineUserId",
    "displayName",
    "firstName",
    "lastName",
    "phone",
    "address",
    "postalCode",
    "avatarUrl",
    "role",
    "source",
    "notes",
    "createdAt",
    "updatedAt",
  ];

  const userRows = [
    [
      "usr_line_krisada_01",
      "U8921122a0f12c8b7",
      "Krisada W.",
      "กฤษฎา",
      "วัฒนกุล",
      "081-892-1122",
      "123/45 ซอยสุขุมวิท 55 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110",
      "10110",
      "https://api.dicebear.com/7.x/bottts/svg?seed=Krisada&backgroundColor=fef08a",
      "user",
      "line-login",
      "ลูกค้าประจำ ชอบหมอนทองไก่ฉีก",
      "2026-11-10T14:30:00Z",
      "2026-11-13T10:00:00Z",
    ],
    [
      "usr_line_somying_02",
      "U8765432b1e23d9c8",
      "Somying Jaidee",
      "สมหญิง",
      "ใจดี",
      "089-876-5432",
      "88/12 หมู่บ้านพฤกษา ถ.รังสิต-นครนายก ปทุมธานี 12130",
      "12130",
      "https://api.dicebear.com/7.x/bottts/svg?seed=Somying&backgroundColor=fef08a",
      "user",
      "line-chat",
      "กรอกที่อยู่ผ่านแชท LINE OA",
      "2026-11-10T16:10:00Z",
      "2026-11-13T12:00:00Z",
    ],
    [
      "usr_wichai_03",
      "",
      "คุณวิชัย มั่งมี",
      "วิชัย",
      "มั่งมี",
      "062-111-2222",
      "45/9 ถ.นิมมานเหมินท์ ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200",
      "50200",
      "https://api.dicebear.com/7.x/bottts/svg?seed=Wichai&backgroundColor=fef08a",
      "user",
      "web",
      "ลูกค้าเก่า สั่ง 2 ลูก",
      "2026-11-09T11:20:00Z",
      "2026-11-13T10:00:00Z",
    ],
    [
      "usr_guest_3582",
      "",
      "คุณลูกค้า (ออเดอร์ 3582)",
      "ลูกค้า",
      "หน้าเว็บ",
      "089-999-3582",
      "กรุงเทพมหานคร",
      "10100",
      "https://api.dicebear.com/7.x/bottts/svg?seed=guest3582&backgroundColor=fef08a",
      "user",
      "web",
      "ออเดอร์หน้าเว็บ WK-3582",
      "2026-11-13T16:00:17Z",
      "2026-11-13T16:00:17Z",
    ],
    [
      "usr_admin_winkin",
      "",
      "แอดมิน ทุเรียนวินคิน",
      "แอดมิน",
      "วินคิน",
      "082-282-4238",
      "ร้านทุเรียนวินคิน ถ.สุขุมวิท ต.แกลง อ.เมือง จ.ระยอง 21000",
      "21000",
      "https://api.dicebear.com/7.x/bottts/svg?seed=Admin&backgroundColor=15803d",
      "admin",
      "system",
      "ผู้ดูแลระบบร้านค้าทุเรียนวินคิน",
      "2026-11-01T00:00:00Z",
      "2026-11-13T00:00:00Z",
    ],
  ];

  runBatch(USER_SHEET_ID, [
    {
      op: "write",
      range: "Users!A1:N6",
      data: [userHeaders, ...userRows],
    },
  ]);

  // Format Users in User Sheet
  try {
    runGsheets(
      `mutate format ${USER_SHEET_ID} --sheet-id 1808987887 --start-row 0 --end-row 1 --start-col 0 --end-col 14 --bold --align CENTER --bg-color "#1e3a8a" --fg-color "#ffffff"`
    );
    runGsheets(
      `mutate freeze ${USER_SHEET_ID} --sheet-id 1808987887 --rows 1 --cols 1`
    );
    runGsheets(
      `mutate autosize ${USER_SHEET_ID} --sheet-id 1808987887 --start-col 0 --end-col 14`
    );
  } catch (err) {
    console.warn("Formatting Users warning:", err.message);
  }

  // -------------------------------------------------------------
  // 2. UPDATE THUREAN SHEET (1QQcCxxnuHg9nmAQ-JHmTdIaC2kA-vnJEJpmOvWlgMb8)
  // -------------------------------------------------------------
  console.log("\n--- [2] Updating Products tab in THUREAN Spreadsheet ---");
  const productHeaders = [
    "id",
    "name",
    "variety",
    "type",
    "price",
    "marketPrice",
    "unit",
    "isAvailable",
    "stockQty",
    "stockKg",
    "stockUnit",
    "avgWeightKg",
    "ripeness",
    "weight",
    "origin",
    "brix",
    "image",
    "badge",
    "description",
    "maturity",
    "texture",
    "flavor",
  ];

  const productRows = [
    [
      "WK-01",
      "หมอนทองระยอง คัดเกรดพรีเมียม A+",
      "หมอนทอง",
      "whole",
      890,
      1050,
      "ลูก",
      "TRUE",
      12,
      44.8,
      "kg",
      3.7,
      "กรอบนอกนุ่มใน (ไก่ฉีก)",
      "3.5 - 4.0 กก.",
      "สวนระยองแท้ (วิ่งรับตรงจากสวน)",
      "32° - 34° Brix",
      "https://images.unsplash.com/photo-1519544442-93857b48665e?auto=format&fit=crop&w=800&q=80",
      "ยอดนิยม",
      "หมอนทองคัดผลแก่จัด 85%+ เปลือกบาง หนามแห้ง ทรงสวย พูใหญ่ เนื้อสีเหลืองทองเนียนละเอียด หวานมันกลมกล่อม เม็ดลีบ",
      "แก่จัด 85%+",
      "กรอบนอก นุ่มใน เนื้อไก่ฉีก ไม่เละ",
      "หวานมันเข้มข้น หอมละมุน",
    ],
    [
      "WK-02",
      "หมอนทองแกะเนื้อพร้อมทาน 1,000 กรัม",
      "หมอนทอง",
      "flesh",
      790,
      950,
      "กล่อง",
      "TRUE",
      18,
      18.0,
      "qty",
      1.0,
      "สุกพอดีกิน (เนื้อเนียนครีม)",
      "1 กก. (เนื้อล้วนไม่รวมเปลือก)",
      "สวนจันทบุรี คัดเกรดพรีเมียม",
      "33° Brix",
      "https://images.unsplash.com/photo-1587132137056-bfbf0166836e?auto=format&fit=crop&w=800&q=80",
      "พร้อมทาน",
      "แกะสดใหม่วันต่อวัน คัดเฉพาะพูใหญ่เกรดสวย แพ็กใส่กล่องล็อกสุญญากาศอย่างดี ส่งรถเย็นถึงบ้านพร้อมเปิดทานทันที",
      "สุกธรรมชาติ 100%",
      "เนียนนุ่ม สัมผัสเหมือนคัสตาร์ด",
      "หวานมันจัดเต็ม อร่อยถูกใจ",
    ],
    [
      "WK-03",
      "ก้านยาวจันทบุรี คัดพิเศษต้นเก่าแก่",
      "ก้านยาว",
      "whole",
      1390,
      1650,
      "ลูก",
      "TRUE",
      7,
      22.0,
      "kg",
      2.8,
      "กรอบนอกนุ่มใน",
      "2.5 - 3.2 กก.",
      "สวนจันทบุรี ดั้งเดิม",
      "34° - 36° Brix",
      "https://images.unsplash.com/photo-1546548970-71785318a17b?auto=format&fit=crop&w=800&q=80",
      "หายาก",
      "ก้านยาวแท้ ก้านใหญ่สมบูรณ์ เนื้อเนียนละเอียด ไร้เสี้ยน กลิ่นหอมสะอาด รสชาติหวานมันลึก สำหรับคนรักก้านยาวตัวจริง",
      "แก่จัด 88%",
      "เนื้อเนียนละเอียด ละมุนลิ้น",
      "หวานมันนำ กลิ่นหอมเป็นเอกลักษณ์",
    ],
    [
      "WK-04",
      "พวงมณี ระยอง คัดเนื้อเข้มหวานจัด",
      "พวงมณี",
      "whole",
      650,
      790,
      "ลูก",
      "TRUE",
      7,
      16.5,
      "kg",
      2.1,
      "สุกพอดีกิน",
      "1.8 - 2.4 กก.",
      "สวนระยอง",
      "35° Brix",
      "https://images.unsplash.com/photo-1579613832125-5d34a13ffe0a?auto=format&fit=crop&w=800&q=80",
      "หวานจัด",
      "พวงมณีแท้ เม็ดเล็ก เนื้อสีเหลืองจำปาเข้ม รสหวานฉ่ำสะใจ คนชอบทุเรียนหวานเข้มข้นต้องไม่พลาด",
      "แก่จัด 85%",
      "เนื้อนุ่มละเอียด เม็ดเล็กลีบ",
      "หวานจัดจ้าน ละมุนลิ้น",
    ],
    [
      "WK-05",
      "ชะนีไข่ระยอง สดจากสวน",
      "ชะนี",
      "whole",
      550,
      690,
      "ลูก",
      "TRUE",
      7,
      19.5,
      "kg",
      2.7,
      "เนื้อสุกพอดี (ไม่เละ)",
      "2.5 - 3.0 กก.",
      "สวนระยอง",
      "33° Brix",
      "https://images.unsplash.com/photo-1519544442-93857b48665e?auto=format&fit=crop&w=800&q=80",
      "",
      "ชะนีไข่เนื้อเหลืองทอง กลิ่นหอมเข้ม รสชาติหวานมันลึกสไตล์ทุเรียนแท้ดั้งเดิม คัดเนื้อไม่ให้เละ",
      "แก่จัด 85%",
      "เหนียวหนึบ รสเข้ม",
      "หวานมันลึก หอมดั้งเดิม",
    ],
    [
      "WK-06",
      "มูซานคิง คัดพิเศษ (รอบส่งจำกัด)",
      "มูซานคิง",
      "whole",
      1790,
      2100,
      "ลูก",
      "TRUE",
      4,
      8.0,
      "kg",
      2.0,
      "สุกหล่นธรรมชาติ",
      "1.8 - 2.2 กก.",
      "เบตง จ.ยะลา",
      "36° Brix",
      "https://images.unsplash.com/photo-1552623770-3881998abc5f?auto=format&fit=crop&w=800&q=80",
      "นำเข้าพิเศษ",
      "มูซานคิงแท้ เนื้อสีทองเข้ม เนื้อเนียนนุ่มละลายในปาก รสชาติหวานมันซับซ้อน อมขมปลายลิ้นนิดๆ",
      "สุกธรรมชาติ 100%",
      "เนื้อเนียนละเอียด ละลายในปาก",
      "หวานมันเข้มข้น อมขมปลาย",
    ],
  ];

  runBatch(THUREAN_SHEET_ID, [
    {
      op: "write",
      range: "Products!A1:V7",
      data: [productHeaders, ...productRows],
    },
  ]);

  // Format Products in THUREAN Sheet
  try {
    runGsheets(
      `mutate format ${THUREAN_SHEET_ID} --sheet-id 0 --start-row 0 --end-row 1 --start-col 0 --end-col 22 --bold --align CENTER --bg-color "#15803d" --fg-color "#ffffff"`
    );
    runGsheets(
      `mutate freeze ${THUREAN_SHEET_ID} --sheet-id 0 --rows 1 --cols 2`
    );
    runGsheets(
      `mutate autosize ${THUREAN_SHEET_ID} --sheet-id 0 --start-col 0 --end-col 22`
    );
  } catch (err) {
    console.warn("Formatting Products warning:", err.message);
  }

  // Format Orders in THUREAN Sheet (Sheet ID: 1436764779)
  console.log("\n--- [3] Formatting Orders tab in THUREAN Spreadsheet ---");
  try {
    runGsheets(
      `mutate format ${THUREAN_SHEET_ID} --sheet-id 1436764779 --start-row 0 --end-row 1 --start-col 0 --end-col 22 --bold --align CENTER --bg-color "#166534" --fg-color "#ffffff"`
    );
    runGsheets(
      `mutate freeze ${THUREAN_SHEET_ID} --sheet-id 1436764779 --rows 1 --cols 1`
    );
    runGsheets(
      `mutate autosize ${THUREAN_SHEET_ID} --sheet-id 1436764779 --start-col 0 --end-col 22`
    );
  } catch (err) {
    console.warn("Formatting Orders warning:", err.message);
  }

  // Format Claims in THUREAN Sheet (Sheet ID: 531618702)
  console.log("\n--- [4] Formatting Claims tab in THUREAN Spreadsheet ---");
  try {
    runGsheets(
      `mutate format ${THUREAN_SHEET_ID} --sheet-id 531618702 --start-row 0 --end-row 1 --start-col 0 --end-col 11 --bold --align CENTER --bg-color "#991b1b" --fg-color "#ffffff"`
    );
    runGsheets(
      `mutate freeze ${THUREAN_SHEET_ID} --sheet-id 531618702 --rows 1 --cols 1`
    );
    runGsheets(
      `mutate autosize ${THUREAN_SHEET_ID} --sheet-id 531618702 --start-col 0 --end-col 11`
    );
  } catch (err) {
    console.warn("Formatting Claims warning:", err.message);
  }

  // Format Rounds in THUREAN Sheet (Sheet ID: 1048401306)
  console.log("\n--- [5] Formatting Rounds tab in THUREAN Spreadsheet ---");
  try {
    runGsheets(
      `mutate format ${THUREAN_SHEET_ID} --sheet-id 1048401306 --start-row 0 --end-row 1 --start-col 0 --end-col 9 --bold --align CENTER --bg-color "#b45309" --fg-color "#ffffff"`
    );
    runGsheets(
      `mutate freeze ${THUREAN_SHEET_ID} --sheet-id 1048401306 --rows 1 --cols 1`
    );
    runGsheets(
      `mutate autosize ${THUREAN_SHEET_ID} --sheet-id 1048401306 --start-col 0 --end-col 9`
    );
  } catch (err) {
    console.warn("Formatting Rounds warning:", err.message);
  }

  // Format Lots_Cost in THUREAN Sheet (Sheet ID: 889982812)
  console.log("\n--- [6] Formatting Lots_Cost tab in THUREAN Spreadsheet ---");
  try {
    runGsheets(
      `mutate format ${THUREAN_SHEET_ID} --sheet-id 889982812 --start-row 0 --end-row 1 --start-col 0 --end-col 12 --bold --align CENTER --bg-color "#7c2d12" --fg-color "#ffffff"`
    );
    runGsheets(
      `mutate freeze ${THUREAN_SHEET_ID} --sheet-id 889982812 --rows 1 --cols 1`
    );
    runGsheets(
      `mutate autosize ${THUREAN_SHEET_ID} --sheet-id 889982812 --start-col 0 --end-col 12`
    );
  } catch (err) {
    console.warn("Formatting Lots_Cost warning:", err.message);
  }

  // Format Promotions in THUREAN Sheet (Sheet ID: 1555331741)
  console.log("\n--- [7] Formatting Promotions tab in THUREAN Spreadsheet ---");
  try {
    runGsheets(
      `mutate format ${THUREAN_SHEET_ID} --sheet-id 1555331741 --start-row 0 --end-row 1 --start-col 0 --end-col 7 --bold --align CENTER --bg-color "#0f766e" --fg-color "#ffffff"`
    );
    runGsheets(
      `mutate freeze ${THUREAN_SHEET_ID} --sheet-id 1555331741 --rows 1 --cols 1`
    );
    runGsheets(
      `mutate autosize ${THUREAN_SHEET_ID} --sheet-id 1555331741 --start-col 0 --end-col 7`
    );
  } catch (err) {
    console.warn("Formatting Promotions warning:", err.message);
  }

  // Format Summary in THUREAN Sheet (Sheet ID: 1024473189)
  console.log("\n--- [8] Formatting Summary tab in THUREAN Spreadsheet ---");
  try {
    runGsheets(
      `mutate format ${THUREAN_SHEET_ID} --sheet-id 1024473189 --start-row 0 --end-row 1 --start-col 0 --end-col 2 --bold --align CENTER --bg-color "#1e293b" --fg-color "#ffffff"`
    );
    runGsheets(
      `mutate freeze ${THUREAN_SHEET_ID} --sheet-id 1024473189 --rows 1 --cols 0`
    );
    runGsheets(
      `mutate autosize ${THUREAN_SHEET_ID} --sheet-id 1024473189 --start-col 0 --end-col 2`
    );
  } catch (err) {
    console.warn("Formatting Summary warning:", err.message);
  }

  console.log("\n=== ALL SHEETS SUCCESSFULLY ALIGNED AND FORMATTED! ===");
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
