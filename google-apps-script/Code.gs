/**
 * ============================================================
 * Google Apps Script สำหรับระบบหลังบ้าน "ทุเรียนวินคิน" (โมเดลรับมาขายออก)
 * ============================================================
 * วิธีใช้งาน:
 * 1. สร้าง Google Sheet เปล่า 1 ไฟล์
 * 2. ไปที่เมนู ส่วนขยาย (Extensions) > Apps Script
 * 3. ลบโค้ดเดิมออก แล้ววางโค้ดนี้ทั้งหมดลงไป กด Save
 * 4. เลือกฟังก์ชัน "setupDurianWinkinSheets" ด้านบนแล้วกด "Run" (1 ครั้ง)
 *    -> ระบบจะสร้างแท็บทั้ง 6 แท็บ + หัวตาราง + สูตรสรุปกำไรให้อัตโนมัติ!
 * 5. กด "Deploy" > "New deployment" > Type: "Web app"
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. คัดลอก Web App URL มาใส่ในหน้า Admin ของเว็บไซต์ (แท็บ เชื่อมต่อ Google Sheet)
 * ============================================================
 */

const SHEET_NAMES = {
  PRODUCTS: "Products",
  ROUNDS: "Rounds",
  ORDERS: "Orders",
  LOTS: "Lots_Cost",
  CLAIMS: "Claims",
  PROMOTIONS: "Promotions",
  SUMMARY: "Summary",
};

/**
 * 1-Click Auto Setup: สร้างโครงสร้าง 6 แท็บ + สีหัวตาราง + สูตรคำนวณกำไร
 */
function setupDurianWinkinSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const definitions = [
    {
      name: SHEET_NAMES.PRODUCTS,
      color: "#15803d",
      headers: [
        "id",
        "name",
        "variety",
        "type",
        "ripeness",
        "weight",
        "price",
        "marketPrice",
        "unit",
        "origin",
        "brix",
        "image",
        "badge",
        "isAvailable",
        "description",
        "maturity",
        "texture",
        "flavor",
        "stockUnit",
        "stockKg",
        "avgWeightKg",
        "stockQty",
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
        "courier",
        "slipUrl",
        "lotId",
        "notes",
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

  definitions.forEach((def) => {
    let sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(def.headers);
      const headerRange = sheet.getRange(1, 1, 1, def.headers.length);
      headerRange.setBackground(def.color);
      headerRange.setFontColor("#ffffff");
      headerRange.setFontWeight("bold");
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, def.headers.length);
    }
  });

  // สร้างแท็บ Summary พร้อมสูตรคำนวณอัตโนมัติ
  let summarySheet = ss.getSheetByName(SHEET_NAMES.SUMMARY);
  if (!summarySheet) {
    summarySheet = ss.insertSheet(SHEET_NAMES.SUMMARY);
  }
  summarySheet.clear();
  summarySheet.getRange("A1:B1").setValues([["รายงานสรุปยอด ทุเรียนวินคิน", "มูลค่า / จำนวน"]]);
  summarySheet.getRange("A1:B1").setBackground("#14532d").setFontColor("#fde047").setFontWeight("bold");

  const summaryRows = [
    ["จำนวนออเดอร์ทั้งหมด (Orders)", "=COUNTA(Orders!A2:A)"],
    ["ออเดอร์ที่ชำระเงินแล้ว", '=COUNTIF(Orders!O2:O, "confirmed")'],
    ["ยอดขายค่าสินค้าทั้งหมด (บาท)", "=SUM(Orders!K2:K)"],
    ["ค่าจัดส่งที่เก็บจากลูกค้า (บาท)", "=SUM(Orders!M2:M)"],
    ["ต้นทุนทุเรียนรับมาจากล้ง/สวน (บาท)", "=SUM(Lots_Cost!I2:I)"],
    ["ค่ากล่อง/อุปกรณ์แพ็ก (บาท)", "=SUM(Lots_Cost!J2:J)"],
    ["ค่าน้ำมันรถกระบะ/วิ่งรับของ (บาท)", "=SUM(Lots_Cost!K2:K)"],
    ["กำไรสุทธิโดยประมาณ (บาท)", "=B4-(B6+B7+B8)"],
    ["จำนวนคำร้องแจ้งเคลมทั้งหมด", "=COUNTA(Claims!A2:A)"],
  ];
  summarySheet.getRange(2, 1, summaryRows.length, 2).setValues(summaryRows);
  summarySheet.getRange("B4:B9").setNumberFormat("#,##0");
  summarySheet.getRange("A9:B9").setBackground("#dcfce7").setFontWeight("bold");
  summarySheet.setColumnWidth(1, 280);
  summarySheet.setColumnWidth(2, 180);

  // ลบ Sheet1 / ชีต1 เดิมถ้ายังว่างอยู่
  const defaultSheet =
    ss.getSheetByName("Sheet1") ||
    ss.getSheetByName("ชีต1") ||
    ss.getSheetByName("แผ่น1");
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
  }

  return "Setup Complete!";
}

// ============================================================
// HTTP HANDLERS (GET & POST)
// ============================================================

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "getAll";
  try {
    if (action === "ping") {
      return jsonResponse({ ok: true, message: "Durian Winkin Google Sheet API is ready!" });
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

  const rawOrders = readSheetObjects(SHEET_NAMES.ORDERS);
  const orders = rawOrders.map((o) => {
    let items = [];
    try {
      items = JSON.parse(o.itemsJson || "[]");
    } catch (e) {
      items = [];
    }
    return {
      id: String(o.id),
      createdAt: String(o.createdAt),
      roundId: String(o.roundId),
      customerName: String(o.customerName),
      phone: String(o.phone),
      address: String(o.address || ""),
      lineUserId: o.lineUserId ? String(o.lineUserId) : undefined,
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

  const rawClaims = readSheetObjects(SHEET_NAMES.CLAIMS);
  const claims = rawClaims.map((c) => ({
    claimId: String(c.claimId),
    createdAt: String(c.createdAt),
    orderId: String(c.orderId),
    phone: String(c.phone),
    reason: String(c.reason),
    description: String(c.description || ""),
    evidenceName: c.evidenceName ? String(c.evidenceName) : undefined,
    status: String(c.status || "pending"),
    resolutionNote: c.resolutionNote ? String(c.resolutionNote) : undefined,
    lotId: c.lotId ? String(c.lotId) : undefined,
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

  return { products, rounds, orders, lots, claims, promotions };
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
    courier: order.courier || "",
    slipUrl: order.slipUrl || "",
    lotId: order.lotId || "",
    notes: order.notes || "",
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
    ripeness: product.ripeness,
    weight: product.weight,
    price: Number(product.price) || 0,
    marketPrice: product.marketPrice || "",
    unit: product.unit,
    origin: product.origin,
    brix: product.brix,
    image: product.image,
    badge: product.badge || "",
    isAvailable: Boolean(product.isAvailable),
    description: product.description,
    maturity: (product.specs && product.specs.maturity) || "",
    texture: (product.specs && product.specs.texture) || "",
    flavor: (product.specs && product.specs.flavor) || "",
    stockUnit: product.stockUnit || (product.type === "flesh" ? "qty" : "kg"),
    stockKg: product.stockKg !== undefined ? product.stockKg : "",
    avgWeightKg: product.avgWeightKg !== undefined ? product.avgWeightKg : "",
    stockQty: product.stockQty !== undefined ? product.stockQty : "",
  };
  appendObjectRow(SHEET_NAMES.PRODUCTS, flat);
  return product;
}

function createRoundRow(round) {
  return appendObjectRow(SHEET_NAMES.ROUNDS, round);
}

function updateRowById(sheetName, idKey, idValue, updates) {
  const sheet = getSheetOrInit(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;
  const headers = data[0];
  const idIdx = headers.indexOf(idKey);
  if (idIdx === -1) return null;

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idIdx]) === String(idValue)) {
      const flatUpdates = Object.assign({}, updates);
      if (updates.specs) {
        flatUpdates.maturity = updates.specs.maturity;
        flatUpdates.texture = updates.specs.texture;
        flatUpdates.flavor = updates.specs.flavor;
      }
      if (updates.items) {
        flatUpdates.itemsJson = JSON.stringify(updates.items);
        flatUpdates.itemSummary = updates.items.map((it) => `${it.productName} x${it.qty}`).join(", ");
      }
      headers.forEach((h, c) => {
        if (flatUpdates[h] !== undefined && h !== idKey) {
          sheet.getRange(r + 1, c + 1).setValue(flatUpdates[h]);
        }
      });
      return true;
    }
  }
  return false;
}

function syncSeedData(db) {
  setupDurianWinkinSheets();
  const current = readAllDatabase();
  let added = 0;

  if (current.products.length === 0 && Array.isArray(db.products)) {
    db.products.forEach((p) => {
      createProductRow(p);
      added++;
    });
  }
  if (current.rounds.length === 0 && Array.isArray(db.rounds)) {
    db.rounds.forEach((r) => {
      createRoundRow(r);
      added++;
    });
  }
  if (current.orders.length === 0 && Array.isArray(db.orders)) {
    db.orders.forEach((o) => {
      createOrderRow(o);
      added++;
    });
  }
  if (current.lots.length === 0 && Array.isArray(db.lots)) {
    db.lots.forEach((l) => {
      appendObjectRow(SHEET_NAMES.LOTS, l);
      added++;
    });
  }
  if (current.claims.length === 0 && Array.isArray(db.claims)) {
    db.claims.forEach((c) => {
      appendObjectRow(SHEET_NAMES.CLAIMS, c);
      added++;
    });
  }
  if (current.promotions.length === 0 && Array.isArray(db.promotions)) {
    db.promotions.forEach((pr) => {
      appendObjectRow(SHEET_NAMES.PROMOTIONS, pr);
      added++;
    });
  }

  return { syncedItems: added };
}
