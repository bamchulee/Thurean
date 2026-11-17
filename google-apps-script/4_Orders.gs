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
    if (k === "custom") {
      // คอลัมน์ที่แอดมินเพิ่มเอง: เขียนลงคอลัมน์ชื่อเดียวกัน
      Object.keys(p.custom || {}).forEach((c) => {
        out[c] = p.custom[c];
      });
    } else if (k === "specs") {
      const s = p.specs || {};
      if (s.maturity !== undefined) out.maturity = s.maturity;
      if (s.texture !== undefined) out.texture = s.texture;
      if (s.flavor !== undefined) out.flavor = s.flavor;
    } else {
      out[k] = p[k];
    }
  });
  // ร้านขายตามน้ำหนักจริงเท่านั้น: price จากเว็บ = ราคาต่อกิโล เก็บในคอลัมน์ pricePerKg คอลัมน์เดียว
  if (out.price !== undefined) {
    if (out.pricePerKg === undefined || out.pricePerKg === "") out.pricePerKg = Number(out.price) || 0;
    delete out.price;
  }
  if (out.ripeness !== undefined) {
    if (out.maturity === undefined) out.maturity = out.ripeness;
    delete out.ripeness;
  }
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

/** น้ำหนักที่ชั่งได้ของรายการ (กก.) — 0 = ยังไม่ชั่ง */
function itemKg(it) {
  const kgs = Array.isArray(it.fruitKgs) ? it.fruitKgs.map(Number).filter((n) => n > 0) : [];
  if (kgs.length > 0) return kgs.reduce((a, b) => a + b, 0);
  return Number(it.actualWeightKg) > 0 ? Number(it.actualWeightKg) : 0;
}

/** ข้อความอ่านง่ายในชีต เช่น "หมอนทอง 2 ลูก: 3.2 + 3.4 = 6.6 กก. × 180 = 1,188 บาท" */
function summarizeItem(it) {
  const perKg = Number(it.pricePerKg) || Number(it.price) || 0;
  const unit = it.unit || "ลูก";
  let text = String(it.productName || it.productId || "") + " " + (Number(it.qty) || 1) + " " + unit;
  const kgs = Array.isArray(it.fruitKgs) ? it.fruitKgs.map(Number).filter((n) => n > 0) : [];
  const kg = itemKg(it);
  if (kg > 0) {
    text += ": " + (kgs.length > 1 ? kgs.join(" + ") + " = " : "") + Number(kg.toFixed(2)) + " กก.";
    if (perKg > 0) text += " × " + perKg + " = " + Math.round(kg * perKg).toLocaleString("en-US") + " บาท";
  } else if (perKg > 0) {
    text += " (" + perKg + " บาท/กก. รอชั่ง)";
  }
  return text;
}

// isNew = แถวใหม่เท่านั้นที่เติมค่าเริ่มต้น — ตอนอัปเดตบางช่อง ห้ามเขียนทับสถานะ/ขนส่ง/ช่องทางเดิม
function flattenOrder(o, isNew) {
  const out = {};
  Object.keys(o || {}).forEach((k) => {
    if (k === "items") {
      const items = Array.isArray(o.items) ? o.items : [];
      out.itemsJson = JSON.stringify(items);
      out.itemSummary = items.map(summarizeItem).join("\n");
      const kg = items.reduce((sum, it) => sum + itemKg(it), 0);
      out.totalKg = kg > 0 ? Number(kg.toFixed(2)) : "";
    } else if (k !== "createdAt") {
      out[k] = o[k];
    }
  });
  if (!out.createDate && o.createdAt) out.createDate = o.createdAt;
  if (out.totalPrice !== undefined) out.totalPrice = Number(out.totalPrice) || 0;
  if (out.shippingCost !== undefined) out.shippingCost = Number(out.shippingCost) || 0;
  if (isNew) {
    if (!out.channel) out.channel = out.lineUserId ? "LINE Official" : "หน้าร้าน / Web";
    if (!out.courier) out.courier = "Flash Express";
    if (!out.orderStatus) out.orderStatus = "สั่งจอง";
  }
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

  // ตรวจสอบ IS_ACTIVE ก่อน: ถ้า 0 หรือปิดการขาย = หมดสต็อกทันที
  const isActive = p.isActive !== 0 && String(p.isActive) !== "0" && p.isActive !== false;
  if (!isActive || p.isAvailable === false || String(p.isAvailable).toUpperCase() === "FALSE") {
    return { error: "สินค้านี้ปิดการขายหรือหมดสต็อกแล้ว" };
  }

  // ถ้ามีการระบุจำนวนลูก/ชิ้น (stockQty): ต้องมี 1 ขึ้นไป
  if (hasNumber(p.stockQty)) {
    const left = Number(p.stockQty);
    if (left < 1 || qty > left) return { error: "เหลือ " + Math.max(0, left) + " " + unit };
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

  // Idempotency: ถ้ามี bookingKey ซ้ำ ให้ส่งออเดอร์เดิมกลับมา ไม่ตัดสต็อกซ้ำ
  if (order.bookingKey) {
    const existing = orders.rows.find(function (r) {
      return String(r.bookingKey || "").trim() === String(order.bookingKey).trim();
    });
    if (existing) {
      Logger.log("Order with bookingKey already exists: " + existing.id);
      return existing;
    }
  }

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
    // สินค้าที่ไม่มีในชีต ห้ามสั่ง (กันจองสินค้าที่ถูกลบ/ข้อมูลตัวอย่าง)
    if (!p) throw new Error("OUT_OF_STOCK: ไม่พบสินค้า " + pid + " ในชีต Products");
    const plan = planStockDeduction(p, need[pid]);
    if (plan.error) throw new Error("OUT_OF_STOCK: " + p.name + " " + plan.error);
    plans.push({ row: p, updates: plan.updates });
  });

  // 2) บันทึกออเดอร์
  const flat = flattenOrder(order, true);
  flat.grandTotal = (Number(flat.totalPrice) || 0) + (Number(flat.shippingCost) || 0);
  flat.paymentStatus = flat.paymentStatus || "pending";
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
  if ((flat.orderStatus === "จัดส่งสำเร็จ" || flat.orderStatus === "delivered") && !row.deliveredAt && !flat.deliveredAt) {
    flat.deliveredAt = new Date().toISOString();
  }
  const wasCancelled = String(row.orderStatus || "") === "ยกเลิก";
  const itemsBefore = parseItems(row.itemsJson);
  applyUpdates(table, row, flat);
  if (flat.orderStatus === "ยกเลิก" && !wasCancelled) {
    restoreStock(itemsBefore, String(row.roundId || ""));
  }
  return Object.assign({}, payload, { updatedAt: row.updatedAt });
}

function parseItems(json) {
  try {
    const items = JSON.parse(String(json || "[]"));
    return Array.isArray(items) ? items : [];
  } catch (e) {
    return [];
  }
}

/** คืนสต็อก + โควต้ารอบ ของออเดอร์ที่ถูกยกเลิก (กลับด้านของ planStockDeduction) */
function restoreStock(items, roundId) {
  const need = {};
  items.forEach((it) => {
    const pid = String(it.productId || "");
    if (pid) need[pid] = (need[pid] || 0) + Math.max(1, Math.floor(Number(it.qty) || 1));
  });
  const products = readTable(SHEET_NAMES.PRODUCTS);
  let qtySum = 0;
  Object.keys(need).forEach((pid) => {
    const p = findRow(products, pid);
    qtySum += need[pid];
    if (!p) return;
    const isQtyBased = p.stockUnit === "qty" || p.type === "flesh";
    const avg = Number(p.avgWeightKg) > 0 ? Number(p.avgWeightKg) : isQtyBased ? 1 : 3;
    const updates = {};
    let wasSoldOut = false;
    if (hasNumber(p.stockQty)) {
      wasSoldOut = Number(p.stockQty) <= 0;
      updates.stockQty = Number(p.stockQty) + need[pid];
    }
    if (hasNumber(p.stockKg)) {
      if (!hasNumber(p.stockQty)) wasSoldOut = Number(p.stockKg) <= 0;
      updates.stockKg = Number((Number(p.stockKg) + need[pid] * avg).toFixed(1));
    }
    // เปิดขายคืนเฉพาะสินค้าที่ปิดไปเพราะของหมด — ถ้าแอดมินปิดเองตอนยังมีของ ให้คงปิดไว้
    if (wasSoldOut) updates.isAvailable = true;
    if (Object.keys(updates).length > 0) applyUpdates(products, p, updates);
  });
  if (roundId && qtySum > 0) {
    const rounds = readTable(SHEET_NAMES.ROUNDS);
    const round = findRow(rounds, roundId);
    if (round) {
      const total = Number(round.totalQuota) || Infinity;
      applyUpdates(rounds, round, {
        quotaRemaining: Math.min(total, (Number(round.quotaRemaining) || 0) + qtySum),
      });
    }
  }
}
