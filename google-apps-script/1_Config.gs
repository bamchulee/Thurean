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
 * 5. เลือกฟังก์ชัน setupDurianWinkinSheets แล้วกด Run — จัดลำดับคอลัมน์ตาม SHEET_DEFS ใส่โน้ตภาษาไทยที่หัวคอลัมน์
 *    และลบคอลัมน์เลิกใช้ (สำรองชีตเป็น <ชื่อ>_backup_<วันเวลา> ก่อนถ้ามีข้อมูล) กดซ้ำได้ ไม่ทำข้อมูลหาย
 * ============================================================
 */

const USER_SPREADSHEET_ID = "16Np4KAWCGv9RGIrj3hAqUCeNK1EXjiHLXmBfg849yHQ";
const THUREAN_SPREADSHEET_ID = "1QQcCxxnuHg9nmAQ-JHmTdIaC2kA-vnJEJpmOvWlgMb8";
// โฟลเดอร์ Google Drive เก็บรูปสลิป — แยกโฟลเดอร์ตามเดือน/วัน ชื่อไฟล์ขึ้นต้นด้วยเลขออเดอร์
const SLIP_ROOT_FOLDER_ID = "1TfV3HA_ez8WvUCnEacitbECyh1WDmxz8";

const SHEET_NAMES = {
  PRODUCTS: "Products",
  ROUNDS: "Rounds",
  ORDERS: "Orders",
  LOTS: "Lots_Cost",
  CLAIMS: "Claims",
  PROMOTIONS: "Promotions",
  USERS: "Users",
  // แท็บสรุปการตั้งค่า (ไฟล์ USER) — ค่าลับแสดงแบบปิดบังเท่านั้น ค่าจริงอยู่ใน Script Properties
  SETTINGS: "Settings",
};

// คอลัมน์ท้ายตารางทุกตาราง (ใครสร้าง/แก้ล่าสุด เมื่อไร)
const AUDIT_HEADERS = ["isActive", "createDate", "createdBy", "updatedAt", "updatedBy"];
// ตารางที่โชว์วันที่สร้างไว้คอลัมน์ที่ 2 (ออเดอร์/เคลม ต้องดูวันที่ก่อน)
const AUDIT_NO_DATE = ["isActive", "createdBy", "updatedAt", "updatedBy"];

// รูปแบบรหัสเลขรัน (ต้องตรงกับ src/lib/ids.ts ฝั่งเว็บ)
// เลขใหม่ = เลขสูงสุดที่ตรงรูปแบบในตาราง + 1 — รหัสเก่าที่ไม่ตรงรูปแบบจะถูกข้าม
const ID_FORMATS = {
  Users: { prefix: "USR-", pad: 5 },
  Orders: { prefix: "OD", pad: 6 },
  Claims: { prefix: "CLM-", pad: 5 },
  Products: { prefix: "WK-", pad: 2 },
  Rounds: { prefix: "WK-ROUND-", pad: 2 },
  Lots_Cost: { prefix: "LOT-", pad: 3 },
  Promotions: { prefix: "PROMO-", pad: 2 },
};

// ชื่อหัวคอลัมน์รุ่นเก่า → ชื่อปัจจุบัน (เปลี่ยนชื่อให้อัตโนมัติ ข้อมูลในคอลัมน์ไม่หาย)
const HEADER_ALIASES = { createdAt: "createDate", id: "userId" };

// ============================================================
// โครงตาราง — ลำดับคอลัมน์ในชีตเป็นไปตามนี้เสมอ (setupDurianWinkinSheets จัดเรียงให้)
// ============================================================
const SHEET_DEFS = {
  Users: {
    color: "#1e3a8a",
    idCol: "userId",
    headers: [
      "userId", "role", "displayName", "firstName", "lastName", "phone", "email",
      "address", "postalCode", "mapsUrl", "latitude", "longitude",
      "lineUserId", "googleId", "loginProviders", "avatarUrl", "source", "lastLoginAt", "notes",
    ].concat(AUDIT_HEADERS),
  },
  Products: {
    color: "#15803d",
    idCol: "id",
    headers: [
      "id", "name", "variety", "productType", "grade", "maturity", "texture", "flavor",
      "weight", "avgWeightKg", "pricePerKg", "marketPrice",
      "isAvailable", "stockQty", "stockKg", "unit", "stockUnit", "type",
      "badge", "origin", "brix", "image", "description",
    ].concat(AUDIT_HEADERS),
  },
  Rounds: {
    color: "#b45309",
    idCol: "id",
    headers: [
      "id", "name", "status", "truckRoute", "harvestDate", "closeDate", "deliveryDate",
      "totalQuota", "quotaRemaining",
    ].concat(AUDIT_HEADERS),
  },
  Orders: {
    color: "#166534",
    idCol: "id",
    headers: [
      "id", "createDate", "roundId", "orderStatus", "paymentStatus",
      "customerName", "phone", "address", "mapsUrl", "userId", "lineUserId", "channel",
      "itemSummary", "ripenessPref", "totalKg", "totalPrice", "shippingMethod", "shippingCost", "grandTotal",
      "slipUrl", "slipFileUrl", "slipRef", "slipBank", "slipCheck", "slipAmount", "slipAmountCheck", "slipAccountCheck", "courier", "trackingNo",
      "weighedAt", "slipSubmittedAt", "paidAt", "deliveredAt", "cancelledAt", "cancelReason",
      "lotId", "notes", "bookingKey", "itemsJson",
    ].concat(AUDIT_NO_DATE),
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
      "claimId", "createDate", "status", "orderId", "customerName", "phone", "userId", "lineUserId",
      "reason", "description", "evidencePhotos", "evidenceName", "ripenessType", "deliveredAt", "lotId",
      "resolutionType", "resolutionNote",
    ].concat(AUDIT_NO_DATE),
  },
  Promotions: {
    color: "#b45309",
    idCol: "id",
    headers: [
      "id", "title", "badge", "discountText", "conditionText", "promoCode",
    ].concat(AUDIT_HEADERS),
  },
};

// คอลัมน์รุ่นเก่าที่เลิกใช้แล้ว — setupDurianWinkinSheets ลบทิ้ง (สำรองชีตไว้ก่อนถ้ามีข้อมูล)
// คอลัมน์อื่นที่ไม่อยู่ในโครงและมีข้อมูล (เช่นที่แอดมินเพิ่มเอง) จะถูกย้ายไปท้ายตาราง ไม่ลบ
const RETIRED_COLUMNS = {
  Users: ["username", "passwordHash", "facebookId"],
  Products: ["price", "ripeness"],
  Orders: ["productType", "productId", "productName", "pricePerItem", "weightPerItem", "quantity", "vehicleType"],
};

// ย้ายค่าจากคอลัมน์เลิกใช้ไปคอลัมน์ใหม่ก่อนลบ (เฉพาะช่องปลายทางที่ยังว่าง)
const RETIRED_MOVES = {
  Products: { price: "pricePerKg", ripeness: "maturity" },
};

// คำอธิบายภาษาไทย — ขึ้นเป็นโน้ตเมื่อเอาเมาส์ชี้หัวคอลัมน์
const HEADER_NOTES = {
  // ใช้ร่วมกัน
  isActive: "1 = ใช้งาน, 0 = ปิด/ลบแล้ว (ไม่ลบแถวจริง)",
  createDate: "วันเวลาที่สร้าง (ระบบใส่ให้)",
  createdBy: "ใครสร้าง (ระบบใส่ให้)",
  updatedAt: "แก้ไขล่าสุดเมื่อ (ระบบใส่ให้)",
  updatedBy: "ใครแก้ล่าสุด (ระบบใส่ให้)",
  notes: "หมายเหตุ",
  phone: "เบอร์โทร",
  address: "ที่อยู่จัดส่ง",
  mapsUrl: "ลิงก์ Google Maps",
  userId: "รหัสสมาชิก (USR-xxxxx)",
  lineUserId: "รหัส LINE ของลูกค้า (ใช้ส่งข้อความหา)",
  customerName: "ชื่อลูกค้า",
  roundId: "รอบส่ง (WK-ROUND-xx)",
  lotId: "ล็อตต้นทุนที่ใช้ (LOT-xxx)",
  status: "สถานะ",
  variety: "สายพันธุ์ เช่น หมอนทอง",
  badge: "ป้ายบนการ์ด เช่น ขายดี",
  // Users
  role: "สิทธิ์: user = ลูกค้า, staff = พนักงาน (ชั่ง/สลิป/ส่งของ), admin = เจ้าของร้าน",
  displayName: "ชื่อที่แสดง (จาก LINE/Google)",
  firstName: "ชื่อจริง",
  lastName: "นามสกุล",
  email: "อีเมล (จาก Google)",
  postalCode: "รหัสไปรษณีย์",
  latitude: "ละติจูดที่ปักหมุด",
  longitude: "ลองจิจูดที่ปักหมุด",
  googleId: "รหัสบัญชี Google (ถ้าเคยเข้าด้วย Google)",
  loginProviders: "ช่องทางที่ผูกไว้ เช่น line,google",
  avatarUrl: "รูปโปรไฟล์",
  source: "สมัครจากไหน: line-login / line-chat / web",
  lastLoginAt: "เข้าระบบล่าสุด",
  // Products
  name: "ชื่อสินค้า",
  productType: "รับคัดลูก / รับมาเป็นโลแล้วขายเลย",
  grade: "เกรด/ไซส์",
  maturity: "ความสุก",
  texture: "เนื้อสัมผัส",
  flavor: "รสชาติ",
  weight: "น้ำหนักต่อลูก (ข้อความ เช่น 3-4 กก.)",
  avgWeightKg: "น้ำหนักเฉลี่ยต่อลูก (ตัวเลข กก.) ใช้คิดสต็อกจาก stockKg",
  pricePerKg: "ราคาต่อกิโล (บาท) — ร้านขายตามน้ำหนักจริงเท่านั้น",
  marketPrice: "ราคาตลาดต่อกิโล (โชว์ขีดฆ่า) — ว่างได้",
  isAvailable: "TRUE = เปิดขาย, FALSE = ปิดขาย",
  stockQty: "สต็อกเป็นลูก (ว่าง = ไม่นับสต็อก)",
  stockKg: "สต็อกเป็นกิโล (ใช้เมื่อไม่ได้นับเป็นลูก)",
  unit: "หน่วยขาย เช่น ลูก / กล่อง",
  stockUnit: "kg = นับสต็อกเป็นกิโล, qty = นับเป็นชิ้น",
  type: "whole = ทั้งลูก, flesh = แกะเนื้อ",
  origin: "แหล่งปลูก",
  brix: "ความหวาน (brix)",
  image: "ลิงก์รูปสินค้า",
  description: "รายละเอียดสินค้า",
  // Rounds
  truckRoute: "เส้นทางรถ",
  harvestDate: "วันตัด",
  closeDate: "ปิดรับจอง",
  deliveryDate: "วันส่ง",
  totalQuota: "โควต้าทั้งหมด (ลูก)",
  quotaRemaining: "โควต้าคงเหลือ (ระบบหักให้)",
  // Orders
  id: "รหัส",
  orderStatus: "สั่งจอง → รอชำระเงิน → ชำระเงินแล้ว/เตรียมจัดส่ง → กำลังจัดส่ง → จัดส่งสำเร็จ (หรือ ยกเลิก)",
  paymentStatus: "pending = ยังไม่จ่าย, slip_submitted = ส่งสลิปแล้ว, confirmed = ยืนยันแล้ว, refunded = คืนเงิน",
  channel: "สั่งผ่าน LINE หรือเว็บ",
  itemSummary: "สรุปรายการ + น้ำหนักที่ชั่ง (อ่านง่าย ระบบเขียนให้)",
  ripenessPref: "ความสุกที่ลูกค้าต้องการ",
  totalKg: "น้ำหนักรวมที่ชั่งได้ (กก.)",
  totalPrice: "ค่าทุเรียน = น้ำหนัก × ราคาต่อกิโล (0 = ยังไม่ชั่ง)",
  shippingMethod: "วิธีจัดส่ง",
  shippingCost: "ค่าส่ง",
  grandTotal: "ยอดที่ต้องจ่าย = ค่าทุเรียน + ค่าส่ง",
  slipUrl: "รูปสลิป",
  slipRef: "เลขอ้างอิงรายการโอน (อ่านจาก QR บนสลิป) — ใช้กันสลิปซ้ำ",
  slipBank: "ธนาคารผู้โอน (จาก QR สลิป)",
  slipFileUrl: "รูปสลิปที่เก็บถาวรใน Google Drive ของร้าน",
  slipAmount: "ยอดที่อ่านได้จากสลิป (OCR)",
  slipAmountCheck: "match = ยอดตรง / mismatch = ยอดไม่ตรง / unknown = อ่านไม่ได้",
  slipAccountCheck: "match = โอนเข้าบัญชีร้าน / mismatch = บัญชีผู้รับไม่ใช่ร้าน / unknown = อ่านไม่ได้",
  slipCheck: "ผลตรวจ QR สลิป: ok / no_qr = ไม่พบ QR / not_slip / duplicate:เลขออเดอร์ที่ใช้สลิปนี้แล้ว",
  courier: "ขนส่ง",
  trackingNo: "เลขพัสดุ",
  weighedAt: "ชั่งเสร็จเมื่อ",
  slipSubmittedAt: "ลูกค้าส่งสลิปเมื่อ",
  paidAt: "ยืนยันยอดเมื่อ",
  deliveredAt: "ส่งถึงเมื่อ",
  cancelledAt: "ยกเลิกเมื่อ",
  cancelReason: "เหตุผลที่ยกเลิก",
  bookingKey: "กันออเดอร์ซ้ำจากปุ่มใน LINE (ระบบใช้)",
  itemsJson: "รายการสินค้าแบบเต็ม (ระบบใช้ — ไม่ต้องแก้เอง)",
  // Lots_Cost
  date: "วันที่รับของ",
  supplierName: "สวน/ผู้ขาย",
  supplierPhone: "เบอร์ผู้ขาย",
  weightKg: "น้ำหนักที่รับมา (กก.)",
  costPerKg: "ต้นทุนต่อกิโล",
  totalFruitCost: "ค่าทุเรียนรวม",
  packagingCost: "ค่ากล่อง/แพ็ก",
  truckFuelCost: "ค่ารถ/น้ำมัน",
  // Claims
  claimId: "รหัสเคลม (CLM-xxxxx)",
  orderId: "ออเดอร์ที่เคลม",
  reason: "เหตุผล",
  evidencePhotos: "รูปหลักฐาน",
  evidenceName: "ชื่อไฟล์หลักฐาน",
  ripenessType: "ready_to_eat = สุกพร้อมทาน, ripen_at_home = บ่มเอง",
  resolutionType: "replacement = ส่งใหม่, refund = คืนเงิน",
  resolutionNote: "บันทึกการแก้ไข",
  // Promotions
  title: "ชื่อโปรโมชัน",
  discountText: "ข้อความส่วนลด",
  conditionText: "เงื่อนไข",
  promoCode: "โค้ด",
};

// คอลัมน์ที่ต้องเก็บเป็น "ข้อความ" เสมอ (กันเลข 0 นำหน้าหาย / เลขพัสดุกลายเป็น 1.2E+15 / วันที่ถูกแปลง)
const TEXT_COLUMNS = {
  phone: 1, supplierPhone: 1, postalCode: 1, trackingNo: 1, promoCode: 1,
  createDate: 1, updatedAt: 1, date: 1, lastLoginAt: 1,
  mapsUrl: 1, deliveredAt: 1, ripenessType: 1, evidencePhotos: 1, resolutionType: 1,
  weighedAt: 1, slipSubmittedAt: 1, paidAt: 1, cancelledAt: 1,
  // รหัสบัญชี Google เป็นตัวเลขยาว — ถ้าชีตแปลงเป็นตัวเลขจะเพี้ยน
  googleId: 1, lineUserId: 1, slipRef: 1,
};
