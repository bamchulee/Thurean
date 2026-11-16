// 4_Orders.gs — แปลงข้อมูลจากเว็บ + สร้างออเดอร์และตัดสต็อก
// (ส่วนหนึ่งของโปรเจกต์ Apps Script ทุเรียนวินคิน ดูวิธีติดตั้งใน 1_Config.gs)

// ============================================================
// แปลง object จากเว็บให้ตรงกับคอลัมน์ในชีต
// ============================================================

function normalizeUser(u) {
  const out = Object.assign({}, u);
  const id = u.userId || u.id;
  if (id) out.userId = id;
  delete out.id;
  delete out.orderCount;
  delete out.totalSpent;
  return out;
}

function flattenProduct(p, isNew) {
  const out = {};
  Object.keys(p || {}).forEach((k) => {
    if (k === "specs") {
      const s = p.specs || {};
      if (s.maturity !== undefined) out.maturity = s.maturity;
      if (s.texture !== undefined) out.texture = s.texture;
      if (s.flavor !== undefined) out.flavor = s.flavor;
    } else {
      out[k] = p[k];
    }
  });
  if (out.price !== undefined) out.price = Number(out.price) || 0;
  if (out.isAvailable !== undefined) {
    out.isAvailable = out.isAvailable === true || String(out.isAvailable).toUpperCase() === "TRUE";
  }
  if (isNew) {
    if (out.isAvailable === undefined) out.isAvailable = true;
    if (!out.stockUnit) out.stockUnit = out.type === "flesh" ? "qty" : "kg";
    if (!out.createdBy) out.createdBy = "admin";
  }
  return out;
}

function flattenOrder(o) {
  const out = {};
  Object.keys(o || {}).forEach((k) => {
    if (k === "items") {
      const items = Array.isArray(o.items) ? o.items : [];
      out.itemsJson = JSON.stringify(items);
      out.itemSummary = items.map((it) => it.productName + " x" + it.qty).join(", ");
      if (items.length > 0) {
        if (!out.productType && items[0].productType) out.productType = items[0].productType;
        if (!out.productId && items[0].productId) out.productId = items[0].productId;
        if (!out.productName && items[0].productName) out.productName = items[0].productName;
        if (!out.pricePerItem && items[0].price) out.pricePerItem = Number(items[0].price) || 0;
        if (!out.weightPerItem && items[0].weightPerItem) out.weightPerItem = items[0].weightPerItem;
        if (!out.quantity && items[0].qty) out.quantity = Number(items[0].qty) || 1;
      }
    } else if (k !== "createdAt") {
      out[k] = o[k];
    }
  });
  if (!out.createDate && o.createdAt) out.createDate = o.createdAt;
  if (out.totalPrice !== undefined) out.totalPrice = Number(out.totalPrice) || 0;
  if (out.shippingCost !== undefined) out.shippingCost = Number(out.shippingCost) || 0;
  if (out.pricePerItem !== undefined) out.pricePerItem = Number(out.pricePerItem) || 0;
  if (out.quantity !== undefined) out.quantity = Number(out.quantity) || 1;
  if (!out.channel) out.channel = out.lineUserId ? "LINE Official" : "หน้าร้าน / Web";
  if (!out.courier) out.courier = "Flash Express";
  if (!out.vehicleType) out.vehicleType = "รถห้องเย็นปรับอุณหภูมิ";
  if (!out.orderStatus) out.orderStatus = "รอชั่งน้ำหนัก/สรุปยอด";
  return out;
}

// ============================================================
// ORDERS: บันทึกออเดอร์ + ตัดสต็อก + ตัดโควต้ารอบ ในล็อกเดียวกัน
// ============================================================

function hasNumber(v) {
  return v !== "" && v !== undefined && v !== null && !isNaN(Number(v));
}

/** คืนแผนตัดสต็อกของสินค้า 1 ตัว หรือ error ถ้าของไม่พอ (ช่องสต็อกว่าง = ไม่นับสต็อก) */
function planStockDeduction(p, qty) {
  const updates = {};
  const isQtyBased = p.stockUnit === "qty" || p.type === "flesh";
  const avg = Number(p.avgWeightKg) > 0 ? Number(p.avgWeightKg) : isQtyBased ? 1 : 3;
  const unit = p.unit || "ชิ้น";

  if (isQtyBased && hasNumber(p.stockQty)) {
    const left = Number(p.stockQty);
    if (qty > left) return { error: "เหลือ " + Math.max(0, left) + " " + unit };
    updates.stockQty = left - qty;
    if (updates.stockQty <= 0) updates.isAvailable = false;
    if (hasNumber(p.stockKg)) {
      updates.stockKg = Math.max(0, Number((Number(p.stockKg) - qty * avg).toFixed(1)));
    }
    return { updates: updates };
  }

  if (hasNumber(p.stockKg)) {
    const kg = Number(p.stockKg);
    const available = kg <= 0 ? 0 : Math.max(1, Math.floor(kg / avg));
    if (qty > available) return { error: "เหลือประมาณ " + available + " " + unit };
    updates.stockKg = Math.max(0, Number((kg - qty * avg).toFixed(1)));
    if (updates.stockKg <= 0) updates.isAvailable = false;
  }
  return { updates: updates };
}

function createOrder(order) {
  if (!order) throw new Error("MISSING_DATA: ไม่มีข้อมูลออเดอร์");
  order = Object.assign({}, order);
  const orders = readTable(SHEET_NAMES.ORDERS);
  if (order._autoId || !order.id) {
    order.id = nextId(orders);
  } else if (findRow(orders, order.id)) {
    throw new Error("DUPLICATE_ID: รหัสออเดอร์ " + order.id + " ถูกใช้แล้ว");
  }
  delete order._autoId;

  const items = Array.isArray(order.items) ? order.items : [];
  const need = {};
  items.forEach((it) => {
    const pid = String(it.productId);
    need[pid] = (need[pid] || 0) + Math.max(1, Math.floor(Number(it.qty) || 1));
  });

  // 1) เช็กสต็อกทุกรายการก่อน ถ้าไม่พอแม้รายการเดียวจะไม่บันทึกอะไรเลย
  const products = readTable(SHEET_NAMES.PRODUCTS);
  const plans = [];
  Object.keys(need).forEach((pid) => {
    const p = findRow(products, pid);
    if (!p) return;
    const plan = planStockDeduction(p, need[pid]);
    if (plan.error) throw new Error("OUT_OF_STOCK: " + p.name + " " + plan.error);
    plans.push({ row: p, updates: plan.updates });
  });

  // 2) บันทึกออเดอร์
  const flat = flattenOrder(order);
  flat.grandTotal = (Number(flat.totalPrice) || 0) + (Number(flat.shippingCost) || 0);
  flat.paymentStatus = flat.paymentStatus || "pending";
  flat.orderStatus = flat.orderStatus || "received";
  flat.createdBy = flat.createdBy || flat.userId || "customer";
  insertRow(SHEET_NAMES.ORDERS, flat);

  // 3) ตัดสต็อก + โควต้ารอบ
  plans.forEach((pl) => {
    if (Object.keys(pl.updates).length > 0) applyUpdates(products, pl.row, pl.updates);
  });
  if (order.roundId) {
    const rounds = readTable(SHEET_NAMES.ROUNDS);
    const round = findRow(rounds, order.roundId);
    if (round) {
      const qtySum = Object.keys(need).reduce((s, k) => s + need[k], 0);
      applyUpdates(rounds, round, {
        quotaRemaining: Math.max(0, (Number(round.quotaRemaining) || 0) - qtySum),
      });
    }
  }
  return order;
}

function updateOrder(payload) {
  const table = readTable(SHEET_NAMES.ORDERS);
  const row = findRow(table, payload.id);
  if (!row) return null;
  const flat = flattenOrder(payload);
  if (flat.totalPrice !== undefined || flat.shippingCost !== undefined) {
    const total = flat.totalPrice !== undefined ? flat.totalPrice : Number(row.totalPrice) || 0;
    const ship = flat.shippingCost !== undefined ? flat.shippingCost : Number(row.shippingCost) || 0;
    flat.grandTotal = total + ship;
  }
  applyUpdates(table, row, flat);
  return Object.assign({}, payload, { updatedAt: row.updatedAt });
}
