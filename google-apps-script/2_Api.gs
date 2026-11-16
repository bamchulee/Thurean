// 2_Api.gs — API key และจุดรับคำขอจากเว็บ (doGet / doPost)
// (ส่วนหนึ่งของโปรเจกต์ Apps Script ทุเรียนวินคิน ดูวิธีติดตั้งใน 1_Config.gs)

// ============================================================
// API KEY
// ============================================================

/** รันครั้งเดียวจากหน้า Apps Script editor เพื่อสร้าง key แล้วดูค่าใน Execution log */
function generateApiKey() {
  const key = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
  PropertiesService.getScriptProperties().setProperty("API_KEY", key);
  Logger.log("API key ใหม่ (นำไปใส่ GOOGLE_SHEETS_API_KEY ที่เว็บ): " + key);
  return key;
}

function getApiKey() {
  return PropertiesService.getScriptProperties().getProperty("API_KEY") || "";
}

// ============================================================
// HTTP HANDLERS
// ============================================================

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function errorResponse(err) {
  const msg = String((err && err.message) || err);
  const m = msg.match(/^([A-Z_]+):/);
  return jsonResponse({ ok: false, error: msg, code: m ? m[1] : "ERROR" });
}

/** GET ใช้เช็กสถานะเท่านั้น ไม่คืนข้อมูลและไม่แก้ไขอะไร */
function doGet() {
  return jsonResponse({
    ok: true,
    message: "Durian Winkin Sheets API is ready. Use POST with an API key.",
    secured: Boolean(getApiKey()),
  });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const expectedKey = getApiKey();
    if (!expectedKey) {
      throw new Error("API_KEY_NOT_SET: ยังไม่ได้ตั้ง API key — รันฟังก์ชัน generateApiKey ใน Apps Script ก่อน");
    }
    if (String(body.key || "") !== expectedKey) {
      throw new Error("UNAUTHORIZED: API key ไม่ถูกต้อง");
    }

    const action = body.action;
    const payload = body.payload || {};

    if (action === "ping") return jsonResponse({ ok: true, data: { secured: true } });
    if (action === "getAll") return jsonResponse({ ok: true, data: readAllDatabase() });

    const lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      const data = handleWrite(action, payload);
      SpreadsheetApp.flush();
      return jsonResponse({ ok: true, data: data });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return errorResponse(err);
  }
}

function handleWrite(action, payload) {
  switch (action) {
    case "setupSheets":
      return { message: setupDurianWinkinSheets() };
    case "rebuildSheets":
      if (payload.confirm !== "RESET") {
        throw new Error("CONFIRM_REQUIRED: ต้องส่ง confirm = RESET เพื่อยืนยันการล้างข้อมูล");
      }
      return { message: resetAndRebuildAllSheets() };
    case "syncSeed":
      return syncSeedData(payload);
    case "createOrder":
      return createOrder(payload);
    case "updateOrder":
      return updateOrder(payload);
    case "createProduct":
      return insertRow(SHEET_NAMES.PRODUCTS, flattenProduct(payload, true));
    case "updateProduct":
      return updateById(SHEET_NAMES.PRODUCTS, payload.id, flattenProduct(payload, false));
    case "createRound":
      return insertRow(SHEET_NAMES.ROUNDS, payload);
    case "updateRound":
      return updateById(SHEET_NAMES.ROUNDS, payload.id, payload);
    case "createLot":
      return insertRow(SHEET_NAMES.LOTS, payload);
    case "createClaim":
      return insertRow(SHEET_NAMES.CLAIMS, payload);
    case "updateClaim":
      return updateById(SHEET_NAMES.CLAIMS, payload.claimId, payload);
    case "createPromotion":
      return insertRow(SHEET_NAMES.PROMOTIONS, payload);
    case "updatePromotion":
      return updateById(SHEET_NAMES.PROMOTIONS, payload.id, payload);
    case "createUser":
      return createUserRow(normalizeUser(payload));
    case "updateUser":
      return updateById(SHEET_NAMES.USERS, payload.userId || payload.id, normalizeUser(payload));
    case "setConfig":
      if (payload.lineAdminGroupId !== undefined) {
        PropertiesService.getScriptProperties().setProperty("LINE_ADMIN_GROUP_ID", String(payload.lineAdminGroupId || ""));
      }
      return {
        lineAdminGroupId: PropertiesService.getScriptProperties().getProperty("LINE_ADMIN_GROUP_ID") || ""
      };
    default:
      throw new Error("UNKNOWN_ACTION: " + action);
  }
}
