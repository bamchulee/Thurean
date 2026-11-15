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
 * - รหัสทุกตารางเป็นเลขรัน ออกโดยสคริปต์นี้เท่านั้น (ดู ID_FORMATS) ไม่มีวันชนกัน
 * - สร้างออเดอร์: เช็กสต็อกก่อน ของไม่พอจะไม่บันทึกอะไรเลย แล้วค่อยตัดสต็อก
 * - สมาชิก: คน LINE เดิมจะอัปเดตแถวเดิม ไม่เกิดแถวซ้ำ / บันทึกเวลาล็อกอินล่าสุด (lastLoginAt)
 * - syncSeed: upsert ตามรหัส กดซ้ำกี่ครั้งก็ไม่เกิดแถวซ้ำและไม่ตัดสต็อกซ้ำ
 *
 * โค้ดแบ่งเป็น 7 ไฟล์ (ทุกไฟล์ต้องอยู่ในโปรเจกต์ Apps Script เดียวกัน มองเห็นกันเอง):
 *   1_Config.gs        ค่าคงที่: รหัสชีต, โครงตาราง, รูปแบบรหัสเลขรัน
 *   2_Api.gs           API key และจุดรับคำขอจากเว็บ (doGet / doPost)
 *   3_SheetAccess.gs   อ่าน/เขียนแถว, ออกเลขรัน, เพิ่ม/แก้/upsert
 *   4_Orders.gs        แปลงข้อมูลจากเว็บ + สร้างออเดอร์และตัดสต็อก
 *   5_Setup.gs         ตั้งค่าตาราง / ล้างข้อมูล / ซิงก์ข้อมูลตั้งต้น
 *   6_ReadAll.gs       อ่านข้อมูลทั้งหมดส่งกลับให้เว็บ
 *   7_Migrate.gs       จัดระเบียบข้อมูลเก่า (รันเองครั้งเดียว)
 *
 * ติดตั้ง/อัปเดต:
 * 1. ใน Apps Script ลบไฟล์ Code.gs เดิมทิ้ง (หรือลบโค้ดข้างในให้ว่าง) — ถ้าเหลือของเดิมไว้ชื่อฟังก์ชันจะชนกัน
 *    แล้วกด + (Add a file) > Script สร้างไฟล์ตามชื่อด้านบนทีละไฟล์ (ไม่ต้องพิมพ์ .gs) วางโค้ดให้ตรงไฟล์ แล้วกดบันทึก
 * 2. เลือกฟังก์ชัน generateApiKey แล้วกด Run (ครั้งเดียว) คัดลอก key จาก Execution log
 * 3. นำ key ไปใส่ที่เว็บ: ตัวแปร GOOGLE_SHEETS_API_KEY แล้ว redeploy เว็บ
 * 4. Deploy > Manage deployments > แก้ไข > Version: New version > Deploy (URL เดิม)
 * 5. เลือกฟังก์ชัน migrateToRunningIds แล้วกด Run (ครั้งเดียว) เพื่อจัดระเบียบข้อมูลเก่า
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

// รูปแบบรหัสเลขรัน (ต้องตรงกับ src/lib/ids.ts ฝั่งเว็บ)
// เลขใหม่ = เลขสูงสุดที่ตรงรูปแบบในตาราง + 1 — รหัสเก่าที่ไม่ตรงรูปแบบจะถูกข้าม
const ID_FORMATS = {
  Users: { prefix: "USR-", pad: 5 },
  Orders: { prefix: "WK-", pad: 4 },
  Claims: { prefix: "CLM-", pad: 5 },
  Products: { prefix: "WK-", pad: 2 },
  Rounds: { prefix: "WK-ROUND-", pad: 2 },
  Lots_Cost: { prefix: "LOT-", pad: 3 },
  Promotions: { prefix: "PROMO-", pad: 2 },
};

// ชื่อหัวคอลัมน์รุ่นเก่า → ชื่อปัจจุบัน (เปลี่ยนชื่อให้อัตโนมัติ ข้อมูลในคอลัมน์ไม่หาย)
const HEADER_ALIASES = { createdAt: "createDate", id: "userId" };

const SHEET_DEFS = {
  Users: {
    color: "#1e3a8a",
    idCol: "userId",
    headers: [
      "userId", "lineUserId", "username", "displayName", "firstName", "lastName",
      "phone", "address", "postalCode", "avatarUrl", "role", "source", "notes",
      "passwordHash", "lastLoginAt",
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
  username: 1, passwordHash: 1, createDate: 1, updatedAt: 1, date: 1, lastLoginAt: 1,
};
