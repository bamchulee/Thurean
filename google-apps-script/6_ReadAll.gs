// 6_ReadAll.gs — อ่านข้อมูลทั้งหมดส่งกลับให้เว็บ
// (ส่วนหนึ่งของโปรเจกต์ Apps Script ทุเรียนวินคิน ดูวิธีติดตั้งใน 1_Config.gs)

// ============================================================
// READ ALL
// ============================================================

function cleanDigits(val) {
  return String(val || "").replace(/[^\d]/g, "");
}

function optStr(v) {
  return v === "" || v === undefined || v === null ? undefined : String(v);
}

function optNum(v) {
  return hasNumber(v) ? Number(v) : undefined;
}

function readAllDatabase() {
  const products = readTable(SHEET_NAMES.PRODUCTS).rows.map((p) => ({
    id: String(p.id),
    productType: String(p.productType || "รับคัดลูก"),
    name: String(p.name),
    variety: String(p.variety || "หมอนทอง"),
    type: p.type === "flesh" ? "flesh" : "whole",
    maturity: String(p.maturity || p.ripeness || "แก่จัด 85%+"),
    texture: String(p.texture || "กรอบนอกนุ่มใน"),
    grade: String(p.grade || "เกรด A+ พรีเมียม"),
    weight: String(p.weight || "3.0 - 3.5 กก."),
    pricePerKg: Number(p.pricePerKg) || Number(p.price) || 0,
    price: Number(p.price) || Number(p.pricePerKg) || 0,
    marketPrice: optNum(p.marketPrice),
    unit: String(p.unit || "ลูก"),
    origin: String(p.origin || ""),
    brix: String(p.brix || ""),
    image: String(p.image || ""),
    badge: optStr(p.badge),
    isAvailable: p.isAvailable === true || String(p.isAvailable).toUpperCase() === "TRUE",
    description: String(p.description || ""),
    stockUnit: p.stockUnit === "qty" ? "qty" : "kg",
    stockKg: optNum(p.stockKg),
    avgWeightKg: optNum(p.avgWeightKg),
    stockQty: optNum(p.stockQty) ?? 0,
    specs: {
      maturity: String(p.maturity || p.ripeness || "แก่จัด 85%+"),
      texture: String(p.texture || "กรอบนอกนุ่มใน"),
      flavor: String(p.flavor || ""),
    },
    isActive: normalizeActive(p.isActive),
    createDate: String(p.createDate || ""),
    createdBy: String(p.createdBy || "admin"),
    updatedAt: String(p.updatedAt || ""),
    updatedBy: String(p.updatedBy || ""),
  }));

  const rounds = readTable(SHEET_NAMES.ROUNDS).rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    truckRoute: String(r.truckRoute || ""),
    harvestDate: String(r.harvestDate || ""),
    closeDate: String(r.closeDate || ""),
    deliveryDate: String(r.deliveryDate || ""),
    status: String(r.status || "open"),
    quotaRemaining: Number(r.quotaRemaining) || 0,
    totalQuota: Number(r.totalQuota) || 0,
    isActive: normalizeActive(r.isActive),
    createDate: String(r.createDate || ""),
    createdBy: String(r.createdBy || "admin"),
    updatedAt: String(r.updatedAt || ""),
    updatedBy: String(r.updatedBy || ""),
  }));

  const users = readTable(SHEET_NAMES.USERS).rows.map((u) => {
    const idVal = String(u.userId || u.id || "");
    return {
      id: idVal,
      userId: idVal,
      username: String(u.username || (u.lineUserId ? "line_" + u.lineUserId : idVal)),
      lineUserId: optStr(u.lineUserId),
      displayName: optStr(u.displayName),
      passwordHash: optStr(u.passwordHash),
      firstName: String(u.firstName || ""),
      lastName: String(u.lastName || ""),
      phone: String(u.phone || ""),
      address: String(u.address || ""),
      postalCode: String(u.postalCode || ""),
      mapsUrl: optStr(u.mapsUrl),
      latitude: optNum(u.latitude),
      longitude: optNum(u.longitude),
      avatarUrl: optStr(u.avatarUrl),
      role: String(u.role || "user"),
      source: optStr(u.source),
      notes: optStr(u.notes),
      lastLoginAt: optStr(u.lastLoginAt),
      isActive: normalizeActive(u.isActive),
      createDate: String(u.createDate || ""),
      createdBy: String(u.createdBy || "system"),
      createdAt: String(u.createDate || ""),
      updatedAt: String(u.updatedAt || ""),
      updatedBy: String(u.updatedBy || ""),
    };
  });

  const orders = readTable(SHEET_NAMES.ORDERS).rows.map((o) => {
    let items = [];
    try {
      items = JSON.parse(o.itemsJson || "[]");
    } catch (e) {
      items = [];
    }
    const phoneClean = cleanDigits(o.phone);
    const matchedUser = users.find(
      (u) =>
        (o.userId && u.id === String(o.userId)) ||
        (o.lineUserId && u.lineUserId === String(o.lineUserId)) ||
        (phoneClean && u.phone && cleanDigits(u.phone) === phoneClean)
    );
    return {
      id: String(o.id),
      createdAt: String(o.createDate || ""),
      createDate: String(o.createDate || ""),
      createdBy: String(o.createdBy || o.userId || "customer"),
      roundId: String(o.roundId || ""),
      userId: o.userId ? String(o.userId) : matchedUser ? matchedUser.id : undefined,
      customerName: String(o.customerName || ""),
      phone: String(o.phone || ""),
      address: String(o.address || ""),
      mapsUrl: optStr(o.mapsUrl),
      lineUserId: o.lineUserId ? String(o.lineUserId) : matchedUser ? matchedUser.lineUserId : undefined,
      ripenessPref: optStr(o.ripenessPref),
      items: items,
      totalPrice: Number(o.totalPrice) || 0,
      shippingMethod: String(o.shippingMethod || ""),
      shippingCost: Number(o.shippingCost) || 0,
      paymentStatus: String(o.paymentStatus || "pending"),
      orderStatus: String(o.orderStatus || "received"),
      deliveredAt: optStr(o.deliveredAt),
      trackingNo: optStr(o.trackingNo),
      courier: optStr(o.courier),
      slipUrl: optStr(o.slipUrl),
      lotId: optStr(o.lotId),
      notes: optStr(o.notes),
      isActive: normalizeActive(o.isActive),
      updatedAt: String(o.updatedAt || ""),
      updatedBy: String(o.updatedBy || ""),
    };
  });

  const claims = readTable(SHEET_NAMES.CLAIMS).rows.map((c) => {
    const phoneClean = cleanDigits(c.phone);
    const matchedOrder = orders.find((o) => o.id === String(c.orderId));
    const matchedUser = users.find(
      (u) =>
        (c.userId && u.id === String(c.userId)) ||
        (phoneClean && u.phone && cleanDigits(u.phone) === phoneClean)
    );
    return {
      claimId: String(c.claimId),
      createdAt: String(c.createDate || ""),
      createDate: String(c.createDate || ""),
      createdBy: String(c.createdBy || c.userId || "customer"),
      orderId: String(c.orderId || ""),
      userId: c.userId
        ? String(c.userId)
        : (matchedOrder && matchedOrder.userId) || (matchedUser && matchedUser.id) || undefined,
      lineUserId: optStr(c.lineUserId) || (matchedOrder ? optStr(matchedOrder.lineUserId) : undefined),
      customerName: optStr(c.customerName) || (matchedOrder ? optStr(matchedOrder.customerName) : undefined),
      phone: String(c.phone || ""),
      ripenessType: optStr(c.ripenessType),
      deliveredAt: optStr(c.deliveredAt) || (matchedOrder ? optStr(matchedOrder.deliveredAt) : undefined),
      reason: String(c.reason || ""),
      description: String(c.description || ""),
      evidencePhotos: optStr(c.evidencePhotos),
      evidenceName: optStr(c.evidenceName),
      status: String(c.status || "pending"),
      resolutionType: optStr(c.resolutionType),
      resolutionNote: optStr(c.resolutionNote),
      lotId: optStr(c.lotId),
      isActive: normalizeActive(c.isActive),
      updatedAt: String(c.updatedAt || ""),
      updatedBy: String(c.updatedBy || ""),
    };
  });

  const usersWithStats = users.map((u) => {
    const userOrders = orders.filter(
      (o) =>
        (o.userId && o.userId === u.id) ||
        (u.lineUserId && o.lineUserId === u.lineUserId) ||
        (u.phone && cleanDigits(u.phone) === cleanDigits(o.phone))
    );
    return Object.assign({}, u, {
      orderCount: userOrders.length,
      totalSpent: userOrders.reduce((sum, o) => sum + o.totalPrice + o.shippingCost, 0),
    });
  });

  const lots = readTable(SHEET_NAMES.LOTS).rows.map((l) => ({
    lotId: String(l.lotId),
    roundId: String(l.roundId || ""),
    date: String(l.date || ""),
    supplierName: String(l.supplierName || ""),
    supplierPhone: optStr(l.supplierPhone),
    variety: String(l.variety || ""),
    weightKg: Number(l.weightKg) || 0,
    costPerKg: Number(l.costPerKg) || 0,
    totalFruitCost: Number(l.totalFruitCost) || 0,
    packagingCost: Number(l.packagingCost) || 0,
    truckFuelCost: Number(l.truckFuelCost) || 0,
    notes: optStr(l.notes),
    isActive: normalizeActive(l.isActive),
    createDate: String(l.createDate || l.date || ""),
    createdBy: String(l.createdBy || "admin"),
    updatedAt: String(l.updatedAt || ""),
    updatedBy: String(l.updatedBy || ""),
  }));

  const promotions = readTable(SHEET_NAMES.PROMOTIONS).rows.map((pr) => ({
    id: String(pr.id),
    title: String(pr.title || ""),
    badge: optStr(pr.badge),
    discountText: String(pr.discountText || ""),
    conditionText: String(pr.conditionText || ""),
    promoCode: optStr(pr.promoCode),
    isActive: normalizeActive(pr.isActive),
    createDate: String(pr.createDate || ""),
    createdBy: String(pr.createdBy || "admin"),
    updatedAt: String(pr.updatedAt || ""),
    updatedBy: String(pr.updatedBy || ""),
  }));

  return {
    products: products,
    rounds: rounds,
    orders: orders,
    lots: lots,
    claims: claims,
    promotions: promotions,
    users: usersWithStats,
  };
}
