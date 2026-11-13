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
 * 1-Click Auto Setup: สร้างโครงสร้างแท็บ + สีหัวตาราง + สูตรคำนวณกำไรของทั้ง 2 ชีต
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
        "createdAt",
        "updatedAt",
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
      ],
    },
    {
      name: SHEET_NAMES.ORDERS,
      color: "#166534",
      headers: [
        "id",
        "createdAt",
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
      ],
    },
    {
      name: SHEET_NAMES.CLAIMS,
      color: "#991b1b",
      headers: [
        "claimId",
        "createdAt",
        "orderId",
        "userId",
        "phone",
        "reason",
        "description",
        "evidenceName",
        "status",
        "resolutionNote",
        "lotId",
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
      ],
    },
  ];

  // Setup User Sheet
  userDefinitions.forEach((def) => {
    let sheet = userSs.getSheetByName(def.name);
    if (!sheet) sheet = userSs.insertSheet(def.name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(def.headers);
      const headerRange = sheet.getRange(1, 1, 1, def.headers.length);
      headerRange.setBackground(def.color).setFontColor("#ffffff").setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
  });

  // Setup THUREAN Sheet
  thureanDefinitions.forEach((def) => {
    let sheet = thureanSs.getSheetByName(def.name);
    if (!sheet) sheet = thureanSs.insertSheet(def.name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(def.headers);
      const headerRange = sheet.getRange(1, 1, 1, def.headers.length);
      headerRange.setBackground(def.color).setFontColor("#ffffff").setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
  });

  return "Dual-Sheet Setup Complete!";
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
      createdAt: String(u.createdAt || ""),
      updatedAt: String(u.updatedAt || ""),
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
      createdAt: String(o.createdAt),
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
      createdAt: String(c.createdAt),
      orderId: String(c.orderId),
      userId: userId,
      phone: String(c.phone),
      reason: String(c.reason),
      description: String(c.description || ""),
      evidenceName: c.evidenceName ? String(c.evidenceName) : undefined,
      status: String(c.status || "pending"),
      resolutionNote: c.resolutionNote ? String(c.resolutionNote) : undefined,
      lotId: c.lotId ? String(c.lotId) : undefined,
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
  }));

  const rawPromos = readSheetObjects(SHEET_NAMES.PROMOTIONS);
  const promotions = rawPromos.map((pr) => ({
    id: String(pr.id),
    title: String(pr.title),
    badge: pr.badge ? String(pr.badge) : undefined,
    discountText: String(pr.discountText || ""),
    conditionText: String(pr.conditionText || ""),
    promoCode: pr.promoCode ? String(pr.promoCode) : undefined,
    isActive: pr.isActive === true || String(pr.isActive).toUpperCase() === "TRUE",
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
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map((h) => (obj[h] !== undefined && obj[h] !== null ? obj[h] : ""));
  sheet.appendRow(row);
  return obj;
}

function createOrderRow(order) {
  const itemSummary = (order.items || []).map((it) => `${it.productName} x${it.qty}`).join(", ");
  const flat = {
    id: order.id,
    createdAt: order.createdAt,
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
  };
  return appendObjectRow(SHEET_NAMES.PRODUCTS, flat);
}

function createRoundRow(round) {
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

  for (let r = 1; r < data.length; r++) {
    const rowId = idIdx !== -1 ? String(data[r][idIdx]) : "";
    const rowLineId = lineUserIdx !== -1 ? String(data[r][lineUserIdx]) : "";
    const isMatch =
      (idValue && rowId === String(idValue)) ||
      (updates.lineUserId && rowLineId && rowLineId === String(updates.lineUserId));

    if (isMatch) {
      headers.forEach((h, c) => {
        if (updates[h] !== undefined) {
          let val = updates[h];
          if (h === "phone") val = "'" + String(val);
          sheet.getRange(r + 1, c + 1).setValue(val);
        }
      });
      return updates;
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
