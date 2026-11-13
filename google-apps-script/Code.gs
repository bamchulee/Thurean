/**
 * ============================================================
 * Google Apps Script สำหรับระบบหลังบ้าน "ทุเรียนวินคิน" (โมเดลรับมาขายออก)
 * ============================================================
 * ระบบฐานข้อมูล 2 ลิงก์เชื่อมโยง (Relational Join):
 * 1. USER Sheet (16Np4KAWCGv9RGIrj3hAqUCeNK1EXjiHLXmBfg849yHQ)
 *    - จัดเก็บข้อมูลสมาชิก / ผู้ลงทะเบียนผ่าน LINE (userId, ที่อยู่, เบอร์โทร, ชื่อ-สกุล)
 * 2. THUREAN Sheet (1QQcCxxnuHg9nmAQ-JHmTdIaC2kA-vnJEJpmOvWlgMb8)
 *    - จัดเก็บข้อมูลสินค้า, สต็อก, ออเดอร์ (Orders), แจ้งเคลม (Claims), รอบส่ง (Rounds)
 *    - ทุก Order และ Claim มี foreign key "userId" เชื่อมกลับไปหา User Sheet
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
  SUMMARY: "Summary",
};

function getUserSpreadsheet() {
  return SpreadsheetApp.openById(USER_SPREADSHEET_ID);
}

function getThureanSpreadsheet() {
  try {
    return (
      SpreadsheetApp.getActiveSpreadsheet() ||
      SpreadsheetApp.openById(THUREAN_SPREADSHEET_ID)
    );
  } catch (e) {
    return SpreadsheetApp.openById(THUREAN_SPREADSHEET_ID);
  }
}

function getTargetSpreadsheetForSheet(sheetName) {
  if (sheetName === SHEET_NAMES.USERS) {
    return getUserSpreadsheet();
  }
  return getThureanSpreadsheet();
}

/**
 * 1-Click Auto Setup / Auto-Migrate: สร้างและปรับโครงสร้างตารางใหม่ทั้งหมด
 * พร้อมคอลัมน์ Audit Log: createDate, createdBy, isActive (0/1), updatedAt, updatedBy
 */
function setupDurianWinkinSheets() {
  const userSs = getUserSpreadsheet();
  const thureanSs = getThureanSpreadsheet();

  const userDefinitions = [
    {
      name: SHEET_NAMES.USERS,
      color: "#1e3a8a",
      headers: [
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
        "isActive",
        "createDate",
        "createdBy",
        "updatedAt",
        "updatedBy",
      ],
    },
  ];

  const thureanDefinitions = [
    {
      name: SHEET_NAMES.PRODUCTS,
      color: "#15803d",
      headers: [
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
        "isActive",
        "createDate",
        "createdBy",
        "updatedAt",
        "updatedBy",
      ],
    },
    {
      name: SHEET_NAMES.ROUNDS,
      color: "#b45309",
      headers: [
        "id",
        "name",
        "truckRoute",
        "harvestDate",
        "closeDate",
        "deliveryDate",
        "status",
        "quotaRemaining",
        "totalQuota",
        "isActive",
        "createDate",
        "createdBy",
        "updatedAt",
        "updatedBy",
      ],
    },
    {
      name: SHEET_NAMES.ORDERS,
      color: "#166534",
      headers: [
        "id",
        "createDate",
        "roundId",
        "userId",
        "customerName",
        "phone",
        "address",
        "lineUserId",
        "ripenessPref",
        "itemsJson",
        "itemSummary",
        "totalPrice",
        "shippingMethod",
        "shippingCost",
        "grandTotal",
        "paymentStatus",
        "orderStatus",
        "trackingNo",
        "lotId",
        "notes",
        "courier",
        "slipUrl",
        "isActive",
        "createdBy",
        "updatedAt",
        "updatedBy",
      ],
    },
    {
      name: SHEET_NAMES.LOTS,
      color: "#7c2d12",
      headers: [
        "lotId",
        "roundId",
        "date",
        "supplierName",
        "supplierPhone",
        "variety",
        "weightKg",
        "costPerKg",
        "totalFruitCost",
        "packagingCost",
        "truckFuelCost",
        "notes",
        "isActive",
        "createDate",
        "createdBy",
        "updatedAt",
        "updatedBy",
      ],
    },
    {
      name: SHEET_NAMES.CLAIMS,
      color: "#991b1b",
      headers: [
        "claimId",
        "createDate",
        "orderId",
        "userId",
        "phone",
        "reason",
        "description",
        "evidenceName",
        "status",
        "resolutionNote",
        "lotId",
        "isActive",
        "createdBy",
        "updatedAt",
        "updatedBy",
      ],
    },
    {
      name: SHEET_NAMES.PROMOTIONS,
      color: "#b45309",
      headers: [
        "id",
        "title",
        "badge",
        "discountText",
        "conditionText",
        "promoCode",
        "isActive",
        "createDate",
        "createdBy",
        "updatedAt",
        "updatedBy",
      ],
    },
  ];

  function applyHeadersToSpreadsheet(ss, definitions) {
    definitions.forEach((def) => {
      let sheet = ss.getSheetByName(def.name);
      if (!sheet) sheet = ss.insertSheet(def.name);

      if (sheet.getLastRow() === 0) {
        sheet.appendRow(def.headers);
      } else {
        // Upgrade existing sheet headers if new columns were added
        const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        def.headers.forEach((h) => {
          if (currentHeaders.indexOf(h) === -1) {
            sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h);
          }
        });
      }

      const totalCols = sheet.getLastColumn();
      if (totalCols > 0) {
        const headerRange = sheet.getRange(1, 1, 1, totalCols);
        headerRange.setBackground(def.color).setFontColor("#ffffff").setFontWeight("bold");
        sheet.setFrozenRows(1);
      }

      // Default isActive = 1 for any existing rows that have blank isActive
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const activeIdx = headers.indexOf("isActive");
        if (activeIdx !== -1) {
          const values = sheet.getRange(2, activeIdx + 1, lastRow - 1, 1).getValues();
          let needsUpdate = false;
          for (let i = 0; i < values.length; i++) {
            if (values[i][0] === "" || values[i][0] === undefined || values[i][0] === null) {
              values[i][0] = 1;
              needsUpdate = true;
            }
          }
          if (needsUpdate) {
            sheet.getRange(2, activeIdx + 1, lastRow - 1, 1).setValues(values);
          }
        }
      }
    });
  }

  applyHeadersToSpreadsheet(userSs, userDefinitions);
  applyHeadersToSpreadsheet(thureanSs, thureanDefinitions);

  return "Dual-Sheet Structure Redesigned with Audit Logs (createDate, createdBy, isActive 0/1, updatedAt, updatedBy) Complete!";
}

/**
 * ลื้อตารางและสร้างใหม่ทั้งหมด (Wipe and Rebuild)
 */
function resetAndRebuildAllSheets() {
  const userSs = getUserSpreadsheet();
  const thureanSs = getThureanSpreadsheet();

  // Clear existing data rows except headers
  const userSheets = userSs.getSheets();
  userSheets.forEach((s) => {
    if (s.getLastRow() > 1) {
      s.deleteRows(2, s.getLastRow() - 1);
    }
  });

  const thureanSheets = thureanSs.getSheets();
  thureanSheets.forEach((s) => {
    if (s.getLastRow() > 1) {
      s.deleteRows(2, s.getLastRow() - 1);
    }
  });

  setupDurianWinkinSheets();
  return "Database Overhauled & Reset Cleanly!";
}

// ============================================================
// HTTP HANDLERS (GET & POST)
// ============================================================

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "getAll";
  try {
    if (action === "ping") {
      return jsonResponse({
        ok: true,
        message: "Durian Winkin Dual-Sheet Relational API is ready!",
        userSpreadsheetId: USER_SPREADSHEET_ID,
        thureanSpreadsheetId: THUREAN_SPREADSHEET_ID,
      });
    }
    if (action === "setup") {
      return jsonResponse({ ok: true, message: setupDurianWinkinSheets() });
    }
    if (action === "rebuild") {
      return jsonResponse({ ok: true, message: resetAndRebuildAllSheets() });
    }
    if (action === "getAll") {
      return jsonResponse({ ok: true, data: readAllDatabase() });
    }
    return jsonResponse({ ok: false, error: "Unknown GET action: " + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const action = body.action;
    const payload = body.payload || {};

    switch (action) {
      case "setupSheets":
        return jsonResponse({ ok: true, message: setupDurianWinkinSheets() });
      case "rebuildSheets":
        return jsonResponse({ ok: true, message: resetAndRebuildAllSheets() });
      case "syncSeed":
        return jsonResponse({ ok: true, data: syncSeedData(payload) });
      case "createOrder":
        return jsonResponse({ ok: true, data: createOrderRow(payload) });
      case "updateOrder":
        return jsonResponse({ ok: true, data: updateRowById(SHEET_NAMES.ORDERS, "id", payload.id, payload) });
      case "createProduct":
        return jsonResponse({ ok: true, data: createProductRow(payload) });
      case "updateProduct":
        return jsonResponse({ ok: true, data: updateRowById(SHEET_NAMES.PRODUCTS, "id", payload.id, payload) });
      case "createRound":
        return jsonResponse({ ok: true, data: createRoundRow(payload) });
      case "updateRound":
        return jsonResponse({ ok: true, data: updateRowById(SHEET_NAMES.ROUNDS, "id", payload.id, payload) });
      case "createLot":
        return jsonResponse({ ok: true, data: appendObjectRow(SHEET_NAMES.LOTS, payload) });
      case "createClaim":
        return jsonResponse({ ok: true, data: appendObjectRow(SHEET_NAMES.CLAIMS, payload) });
      case "updateClaim":
        return jsonResponse({ ok: true, data: updateRowById(SHEET_NAMES.CLAIMS, "claimId", payload.claimId, payload) });
      case "createPromotion":
        return jsonResponse({ ok: true, data: appendObjectRow(SHEET_NAMES.PROMOTIONS, payload) });
      case "updatePromotion":
        return jsonResponse({ ok: true, data: updateRowById(SHEET_NAMES.PROMOTIONS, "id", payload.id, payload) });
      case "createUser": {
        const userPayload = {
          ...payload,
          userId: payload.userId || payload.id || ("usr_" + new Date().getTime()),
        };
        return jsonResponse({ ok: true, data: appendObjectRow(SHEET_NAMES.USERS, userPayload) });
      }
      case "updateUser": {
        const targetId = payload.userId || payload.id;
        const updated = updateRowById(
          SHEET_NAMES.USERS,
          "userId",
          targetId,
          payload
        );
        return jsonResponse({
          ok: true,
          data: updated,
        });
      }
      default:
        return jsonResponse({ ok: false, error: "Unknown POST action: " + action });
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

// ============================================================
// INTERNAL DATA HELPERS
// ============================================================

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function getSheetOrInit(name) {
  const ss = getTargetSpreadsheetForSheet(name);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    setupDurianWinkinSheets();
    sheet = ss.getSheetByName(name);
  }
  return sheet;
}

function readSheetObjects(sheetName) {
  const sheet = getSheetOrInit(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  return values.slice(1).filter((r) => r[0] !== "").map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });
}

function cleanDigits(val) {
  return String(val || "").replace(/[^\d]/g, "");
}

function readAllDatabase() {
  const rawProducts = readSheetObjects(SHEET_NAMES.PRODUCTS);
  const products = rawProducts.map((p) => ({
    id: String(p.id),
    name: String(p.name),
    variety: String(p.variety),
    type: p.type === "flesh" ? "flesh" : "whole",
    ripeness: String(p.ripeness),
    weight: String(p.weight),
    price: Number(p.price) || 0,
    marketPrice: p.marketPrice ? Number(p.marketPrice) : undefined,
    unit: String(p.unit || "ลูก"),
    origin: String(p.origin || ""),
    brix: String(p.brix || ""),
    image: String(p.image || ""),
    badge: p.badge ? String(p.badge) : undefined,
    isAvailable: p.isAvailable === true || String(p.isAvailable).toUpperCase() === "TRUE",
    description: String(p.description || ""),
    stockUnit: p.stockUnit === "qty" ? "qty" : "kg",
    stockKg: p.stockKg !== "" && p.stockKg !== undefined ? Number(p.stockKg) : undefined,
    avgWeightKg: p.avgWeightKg !== "" && p.avgWeightKg !== undefined ? Number(p.avgWeightKg) : undefined,
    stockQty: p.stockQty !== "" && p.stockQty !== undefined ? Number(p.stockQty) : undefined,
    specs: {
      maturity: String(p.maturity || ""),
      texture: String(p.texture || ""),
      flavor: String(p.flavor || ""),
    },
    isActive: (p.isActive === 0 || p.isActive === "0" || p.isActive === false) ? 0 : 1,
    createDate: String(p.createDate || p.createdAt || ""),
    createdBy: String(p.createdBy || "admin"),
    updatedAt: String(p.updatedAt || ""),
    updatedBy: String(p.updatedBy || ""),
  }));

  const rawRounds = readSheetObjects(SHEET_NAMES.ROUNDS);
  const rounds = rawRounds.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    truckRoute: String(r.truckRoute || ""),
    harvestDate: String(r.harvestDate || ""),
    closeDate: String(r.closeDate || ""),
    deliveryDate: String(r.deliveryDate || ""),
    status: String(r.status || "open"),
    quotaRemaining: Number(r.quotaRemaining) || 0,
    totalQuota: Number(r.totalQuota) || 0,
    isActive: (r.isActive === 0 || r.isActive === "0" || r.isActive === false) ? 0 : 1,
    createDate: String(r.createDate || r.createdAt || ""),
    createdBy: String(r.createdBy || "admin"),
    updatedAt: String(r.updatedAt || ""),
    updatedBy: String(r.updatedBy || ""),
  }));

  // 1. Read Users from USER Sheet
  const rawUsers = readSheetObjects(SHEET_NAMES.USERS);
  const users = rawUsers.map((u) => {
    const idVal = String(u.userId || u.id || "");
    return {
      id: idVal,
      userId: idVal,
      username: String(u.username || (u.lineUserId ? `line_${u.lineUserId}` : idVal)),
      lineUserId: u.lineUserId ? String(u.lineUserId) : undefined,
      displayName: u.displayName ? String(u.displayName) : undefined,
      firstName: String(u.firstName || ""),
      lastName: String(u.lastName || ""),
      phone: String(u.phone || ""),
      address: String(u.address || ""),
      postalCode: String(u.postalCode || ""),
      avatarUrl: u.avatarUrl ? String(u.avatarUrl) : undefined,
      role: String(u.role || "user"),
      source: u.source ? String(u.source) : undefined,
      notes: u.notes ? String(u.notes) : undefined,
      isActive: (u.isActive === 0 || u.isActive === "0" || u.isActive === false) ? 0 : 1,
      createDate: String(u.createDate || u.createdAt || ""),
      createdBy: String(u.createdBy || "system"),
      createdAt: String(u.createdAt || u.createDate || ""),
      updatedAt: String(u.updatedAt || ""),
      updatedBy: String(u.updatedBy || ""),
    };
  });

  // 2. Read Orders from THUREAN Sheet and JOIN with Users
  const rawOrders = readSheetObjects(SHEET_NAMES.ORDERS);
  const orders = rawOrders.map((o) => {
    let items = [];
    try {
      items = JSON.parse(o.itemsJson || "[]");
    } catch (e) {
      items = [];
    }

    // Relational Join to Users sheet
    const orderPhoneClean = cleanDigits(o.phone);
    const matchedUser = users.find(
      (u) =>
        (o.userId && (u.id === String(o.userId) || u.userId === String(o.userId))) ||
        (o.lineUserId && u.lineUserId === String(o.lineUserId)) ||
        (orderPhoneClean && u.phone && cleanDigits(u.phone) === orderPhoneClean)
    );
    const userId = o.userId ? String(o.userId) : (matchedUser ? matchedUser.id : undefined);

    return {
      id: String(o.id),
      createdAt: String(o.createdAt || o.createDate || ""),
      createDate: String(o.createDate || o.createdAt || ""),
      createdBy: String(o.createdBy || o.userId || "customer"),
      roundId: String(o.roundId),
      userId: userId,
      customerName: String(o.customerName),
      phone: String(o.phone),
      address: String(o.address || ""),
      lineUserId: o.lineUserId ? String(o.lineUserId) : (matchedUser ? matchedUser.lineUserId : undefined),
      ripenessPref: o.ripenessPref ? String(o.ripenessPref) : undefined,
      items: items,
      totalPrice: Number(o.totalPrice) || 0,
      shippingMethod: String(o.shippingMethod || ""),
      shippingCost: Number(o.shippingCost) || 0,
      paymentStatus: String(o.paymentStatus || "pending"),
      orderStatus: String(o.orderStatus || "received"),
      trackingNo: o.trackingNo ? String(o.trackingNo) : undefined,
      courier: o.courier ? String(o.courier) : undefined,
      slipUrl: o.slipUrl ? String(o.slipUrl) : undefined,
      lotId: o.lotId ? String(o.lotId) : undefined,
      notes: o.notes ? String(o.notes) : undefined,
      isActive: (o.isActive === 0 || o.isActive === "0" || o.isActive === false) ? 0 : 1,
      updatedAt: String(o.updatedAt || ""),
      updatedBy: String(o.updatedBy || ""),
    };
  });

  // 3. Read Claims and JOIN with Orders & Users
  const rawClaims = readSheetObjects(SHEET_NAMES.CLAIMS);
  const claims = rawClaims.map((c) => {
    const claimPhoneClean = cleanDigits(c.phone);
    const matchedOrder = orders.find((o) => o.id === String(c.orderId));
    const matchedUser = users.find(
      (u) =>
        (c.userId && (u.id === String(c.userId) || u.userId === String(c.userId))) ||
        (claimPhoneClean && u.phone && cleanDigits(u.phone) === claimPhoneClean)
    );
    const userId = c.userId
      ? String(c.userId)
      : (matchedOrder?.userId || matchedUser?.id || undefined);

    return {
      claimId: String(c.claimId),
      createdAt: String(c.createdAt || c.createDate || ""),
      createDate: String(c.createDate || c.createdAt || ""),
      createdBy: String(c.createdBy || c.userId || "customer"),
      orderId: String(c.orderId),
      userId: userId,
      phone: String(c.phone),
      reason: String(c.reason),
      description: String(c.description || ""),
      evidenceName: c.evidenceName ? String(c.evidenceName) : undefined,
      status: String(c.status || "pending"),
      resolutionNote: c.resolutionNote ? String(c.resolutionNote) : undefined,
      lotId: c.lotId ? String(c.lotId) : undefined,
      isActive: (c.isActive === 0 || c.isActive === "0" || c.isActive === false) ? 0 : 1,
      updatedAt: String(c.updatedAt || ""),
      updatedBy: String(c.updatedBy || ""),
    };
  });

  // 4. Calculate Aggregate Stats on Users (Order count & total spent)
  const usersWithStats = users.map((u) => {
    const userOrders = orders.filter(
      (o) =>
        (o.userId && (o.userId === u.id || o.userId === u.userId)) ||
        (u.lineUserId && o.lineUserId === u.lineUserId) ||
        (u.phone && cleanDigits(u.phone) === cleanDigits(o.phone))
    );
    const totalSpent = userOrders.reduce((sum, o) => sum + (Number(o.totalPrice) || 0) + (Number(o.shippingCost) || 0), 0);
    return {
      ...u,
      orderCount: userOrders.length,
      totalSpent: totalSpent,
    };
  });

  const rawLots = readSheetObjects(SHEET_NAMES.LOTS);
  const lots = rawLots.map((l) => ({
    lotId: String(l.lotId),
    roundId: String(l.roundId),
    date: String(l.date),
    supplierName: String(l.supplierName),
    supplierPhone: l.supplierPhone ? String(l.supplierPhone) : undefined,
    variety: String(l.variety),
    weightKg: Number(l.weightKg) || 0,
    costPerKg: Number(l.costPerKg) || 0,
    totalFruitCost: Number(l.totalFruitCost) || 0,
    packagingCost: Number(l.packagingCost) || 0,
    truckFuelCost: Number(l.truckFuelCost) || 0,
    notes: l.notes ? String(l.notes) : undefined,
    isActive: (l.isActive === 0 || l.isActive === "0" || l.isActive === false) ? 0 : 1,
    createDate: String(l.createDate || l.date || ""),
    createdBy: String(l.createdBy || "admin"),
    updatedAt: String(l.updatedAt || ""),
    updatedBy: String(l.updatedBy || ""),
  }));

  const rawPromos = readSheetObjects(SHEET_NAMES.PROMOTIONS);
  const promotions = rawPromos.map((pr) => ({
    id: String(pr.id),
    title: String(pr.title),
    badge: pr.badge ? String(pr.badge) : undefined,
    discountText: String(pr.discountText || ""),
    conditionText: String(pr.conditionText || ""),
    promoCode: pr.promoCode ? String(pr.promoCode) : undefined,
    isActive: (pr.isActive === 0 || pr.isActive === "0" || pr.isActive === false) ? 0 : 1,
    createDate: String(pr.createDate || ""),
    createdBy: String(pr.createdBy || "admin"),
    updatedAt: String(pr.updatedAt || ""),
    updatedBy: String(pr.updatedBy || ""),
  }));

  return {
    products,
    rounds,
    orders,
    lots,
    claims,
    promotions,
    users: usersWithStats,
  };
}

function appendObjectRow(sheetName, obj) {
  const sheet = getSheetOrInit(sheetName);
  const now = new Date().toISOString();
  const enriched = Object.assign({}, obj);

  if (enriched.isActive === undefined || enriched.isActive === null || enriched.isActive === "") {
    enriched.isActive = 1;
  } else {
    enriched.isActive = (enriched.isActive === 0 || enriched.isActive === "0" || enriched.isActive === false) ? 0 : 1;
  }

  if (!enriched.createDate && !enriched.createdAt) {
    enriched.createDate = now;
    enriched.createdAt = now;
  } else {
    enriched.createDate = enriched.createDate || enriched.createdAt;
    enriched.createdAt = enriched.createdAt || enriched.createDate;
  }

  if (!enriched.createdBy) {
    enriched.createdBy = enriched.userId || enriched.lineUserId || "system";
  }

  if (!enriched.updatedAt) {
    enriched.updatedAt = now;
  }
  if (!enriched.updatedBy) {
    enriched.updatedBy = enriched.createdBy || "system";
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map((h) => {
    let val = enriched[h];
    if (val === undefined || val === null) return "";
    if (h === "phone" && val !== "") return "'" + String(val);
    return val;
  });
  sheet.appendRow(row);
  return enriched;
}

function createOrderRow(order) {
  const itemSummary = (order.items || []).map((it) => `${it.productName} x${it.qty}`).join(", ");
  const now = new Date().toISOString();
  const flat = {
    id: order.id,
    createDate: order.createDate || order.createdAt || now,
    roundId: order.roundId,
    userId: order.userId || "",
    customerName: order.customerName,
    phone: "'" + String(order.phone || ""),
    address: order.address || "",
    lineUserId: order.lineUserId || "",
    ripenessPref: order.ripenessPref || "",
    itemsJson: JSON.stringify(order.items || []),
    itemSummary: itemSummary,
    totalPrice: Number(order.totalPrice) || 0,
    shippingMethod: order.shippingMethod || "",
    shippingCost: Number(order.shippingCost) || 0,
    grandTotal: (Number(order.totalPrice) || 0) + (Number(order.shippingCost) || 0),
    paymentStatus: order.paymentStatus || "pending",
    orderStatus: order.orderStatus || "received",
    trackingNo: order.trackingNo || "",
    lotId: order.lotId || "",
    notes: order.notes || "",
    courier: order.courier || "",
    slipUrl: order.slipUrl || "",
    isActive: (order.isActive === 0 || order.isActive === "0" || order.isActive === false) ? 0 : 1,
    createdBy: order.createdBy || order.userId || "customer",
    updatedAt: order.updatedAt || now,
    updatedBy: order.updatedBy || order.createdBy || "customer",
  };

  appendObjectRow(SHEET_NAMES.ORDERS, flat);

  // ตัดโควต้ารอบส่ง + ตัดสต็อก กก./กล่อง ของสินค้า
  if (order.roundId && order.items) {
    const qtySum = order.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
    const rounds = readSheetObjects(SHEET_NAMES.ROUNDS);
    const target = rounds.find((r) => String(r.id) === String(order.roundId));
    if (target) {
      const nextQuota = Math.max(0, (Number(target.quotaRemaining) || 0) - qtySum);
      updateRowById(SHEET_NAMES.ROUNDS, "id", order.roundId, { quotaRemaining: nextQuota });
    }
  }
  if (Array.isArray(order.items)) {
    const prodRows = readSheetObjects(SHEET_NAMES.PRODUCTS);
    order.items.forEach((it) => {
      const p = prodRows.find((row) => String(row.id) === String(it.productId));
      if (!p) return;
      const updates = {};
      const qty = Math.max(1, Number(it.qty) || 1);
      if (p.stockUnit === "qty" && p.stockQty !== "" && p.stockQty !== undefined) {
        updates.stockQty = Math.max(0, (Number(p.stockQty) || 0) - qty);
        if (updates.stockQty <= 0) updates.isAvailable = false;
      }
      if (p.stockKg !== "" && p.stockKg !== undefined) {
        const avg = Number(p.avgWeightKg) > 0 ? Number(p.avgWeightKg) : (p.stockUnit === "qty" ? 1 : 3);
        updates.stockKg = Math.max(0, Number(((Number(p.stockKg) || 0) - qty * avg).toFixed(1)));
        if (updates.stockKg <= 0) updates.isAvailable = false;
      }
      if (Object.keys(updates).length > 0) {
        updateRowById(SHEET_NAMES.PRODUCTS, "id", p.id, updates);
      }
    });
  }
  return order;
}

function createProductRow(product) {
  const now = new Date().toISOString();
  const flat = {
    id: product.id,
    name: product.name,
    variety: product.variety,
    type: product.type,
    price: Number(product.price) || 0,
    marketPrice: product.marketPrice || "",
    unit: product.unit,
    isAvailable: product.isAvailable === true,
    stockQty: product.stockQty || "",
    stockKg: product.stockKg || "",
    stockUnit: product.stockUnit || (product.type === "flesh" ? "qty" : "kg"),
    avgWeightKg: product.avgWeightKg || "",
    ripeness: product.ripeness,
    weight: product.weight,
    origin: product.origin,
    brix: product.brix,
    image: product.image,
    badge: product.badge || "",
    description: product.description,
    maturity: product.specs ? product.specs.maturity : "",
    texture: product.specs ? product.specs.texture : "",
    flavor: product.specs ? product.specs.flavor : "",
    isActive: (product.isActive === 0 || product.isActive === "0" || product.isActive === false) ? 0 : 1,
    createDate: product.createDate || now,
    createdBy: product.createdBy || "admin",
    updatedAt: product.updatedAt || now,
    updatedBy: product.updatedBy || "admin",
  };
  return appendObjectRow(SHEET_NAMES.PRODUCTS, flat);
}

function createRoundRow(round) {
  const now = new Date().toISOString();
  const flat = {
    id: round.id,
    name: round.name,
    truckRoute: round.truckRoute,
    harvestDate: round.harvestDate,
    closeDate: round.closeDate,
    deliveryDate: round.deliveryDate,
    status: round.status || "open",
    quotaRemaining: Number(round.quotaRemaining) || 0,
    totalQuota: Number(round.totalQuota) || 0,
    isActive: (round.isActive === 0 || round.isActive === "0" || round.isActive === false) ? 0 : 1,
    createDate: round.createDate || now,
    createdBy: round.createdBy || "admin",
    updatedAt: round.updatedAt || now,
    updatedBy: round.updatedBy || "admin",
  };
  return appendObjectRow(SHEET_NAMES.ROUNDS, flat);
}

function updateRowById(sheetName, idColName, idValue, updates) {
  const sheet = getSheetOrInit(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;
  const headers = data[0];
  let idIdx = headers.indexOf(idColName);
  if (idIdx === -1 && idColName === "userId") {
    idIdx = headers.indexOf("id");
  }
  const lineUserIdx = headers.indexOf("lineUserId");
  if (idIdx === -1 && lineUserIdx === -1) return null;

  const enrichedUpdates = Object.assign({}, updates);
  enrichedUpdates.updatedAt = new Date().toISOString();
  if (enrichedUpdates.isActive !== undefined) {
    enrichedUpdates.isActive = (enrichedUpdates.isActive === 0 || enrichedUpdates.isActive === "0" || enrichedUpdates.isActive === false) ? 0 : 1;
  }

  for (let r = 1; r < data.length; r++) {
    const rowId = idIdx !== -1 ? String(data[r][idIdx]) : "";
    const rowLineId = lineUserIdx !== -1 ? String(data[r][lineUserIdx]) : "";
    const isMatch =
      (idValue && rowId === String(idValue)) ||
      (enrichedUpdates.lineUserId && rowLineId && rowLineId === String(enrichedUpdates.lineUserId));

    if (isMatch) {
      headers.forEach((h, c) => {
        if (enrichedUpdates[h] !== undefined) {
          let val = enrichedUpdates[h];
          if (h === "phone" && val !== "") val = "'" + String(val);
          sheet.getRange(r + 1, c + 1).setValue(val);
        }
      });
      return enrichedUpdates;
    }
  }
  return null;
}

function syncSeedData(seed) {
  let count = 0;
  if (seed.products) {
    seed.products.forEach((p) => {
      createProductRow(p);
      count++;
    });
  }
  if (seed.rounds) {
    seed.rounds.forEach((r) => {
      createRoundRow(r);
      count++;
    });
  }
  if (seed.orders) {
    seed.orders.forEach((o) => {
      createOrderRow(o);
      count++;
    });
  }
  if (seed.lots) {
    seed.lots.forEach((l) => {
      appendObjectRow(SHEET_NAMES.LOTS, l);
      count++;
    });
  }
  if (seed.claims) {
    seed.claims.forEach((c) => {
      appendObjectRow(SHEET_NAMES.CLAIMS, c);
      count++;
    });
  }
  if (seed.promotions) {
    seed.promotions.forEach((pr) => {
      appendObjectRow(SHEET_NAMES.PROMOTIONS, pr);
      count++;
    });
  }
  if (seed.users) {
    seed.users.forEach((u) => {
      appendObjectRow(SHEET_NAMES.USERS, {
        ...u,
        userId: u.userId || u.id,
      });
      count++;
    });
  }
  return { syncedItems: count };
}
