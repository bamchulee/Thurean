// ============================================================
// Pure Vanilla JavaScript (ES6+) — ร้าน "ทุเรียนวินคิน" LIFF / Quick Web
// เชื่อมต่อตรงกับ Next.js Backend APIs (/api/shop, /api/orders)
// ============================================================

(function () {
  "use strict";

  const state = {
    products: [],
    currentRound: null,
    shopInfo: null,
    cart: [],
    filter: "all",
    lineProfile: null,
    lastCreatedOrder: null,
  };

  // DOM Elements
  const el = {
    liffBanner: document.getElementById("liff-banner"),
    roundName: document.getElementById("round-name"),
    roundRoute: document.getElementById("round-route"),
    roundHarvest: document.getElementById("round-harvest"),
    roundDelivery: document.getElementById("round-delivery"),
    roundQuota: document.getElementById("round-quota"),
    cdDays: document.getElementById("cd-days"),
    cdHours: document.getElementById("cd-hours"),
    cdMins: document.getElementById("cd-mins"),
    cdSecs: document.getElementById("cd-secs"),
    filters: document.getElementById("variety-filters"),
    grid: document.getElementById("product-grid"),
    cartBadge: document.getElementById("cart-badge"),
    cartModal: document.getElementById("cart-modal"),
    cartItemsBox: document.getElementById("cart-items-box"),
    checkoutForm: document.getElementById("checkout-form"),
    coName: document.getElementById("co-name"),
    coPhone: document.getElementById("co-phone"),
    coAddress: document.getElementById("co-address"),
    coRipeness: document.getElementById("co-ripeness"),
    coShipping: document.getElementById("co-shipping"),
    coTotal: document.getElementById("co-total"),
    coError: document.getElementById("co-error"),
    orderSuccessBox: document.getElementById("order-success-box"),
    resOrderId: document.getElementById("res-order-id"),
    resQrWrap: document.getElementById("res-qr-wrap"),
    trackForm: document.getElementById("track-form"),
    trackInput: document.getElementById("track-input"),
    trackResult: document.getElementById("track-result"),
    toast: document.getElementById("toast"),
  };

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove("hidden");
    setTimeout(() => el.toast.classList.add("hidden"), 2200);
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------- Thai PromptPay EMVCo CRC16-CCITT Payload (Pure JS) ----------
  function tlv(id, val) {
    return id + String(val.length).padStart(2, "0") + val;
  }

  function crc16ccitt(str) {
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }

  function buildPromptPayPayload(phone, amount) {
    const digits = phone.replace(/[^0-9]/g, "");
    const target = digits.startsWith("0") ? "0066" + digits.slice(1) : digits;
    const merchant = tlv("00", "A000000677010111") + tlv("01", target);
    let payload = tlv("00", "01") + tlv("01", "12") + tlv("29", merchant) + tlv("53", "764");
    if (amount > 0) payload += tlv("54", amount.toFixed(2));
    payload += tlv("58", "TH") + "6304";
    return payload + crc16ccitt(payload);
  }

  // ---------- Countdown Timer ----------
  let timerId = null;
  function startCountdown(isoCloseDate) {
    if (timerId) clearInterval(timerId);
    const target = new Date(isoCloseDate).getTime();

    function tick() {
      const diff = Math.max(0, target - Date.now());
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);
      el.cdDays.textContent = String(d).padStart(2, "0");
      el.cdHours.textContent = String(h).padStart(2, "0");
      el.cdMins.textContent = String(m).padStart(2, "0");
      el.cdSecs.textContent = String(s).padStart(2, "0");
    }

    tick();
    timerId = setInterval(tick, 1000);
  }

  // ---------- Load Shop Data ----------
  async function loadShopData() {
    try {
      const res = await fetch("/api/shop");
      const json = await res.json();
      if (!json.ok) return;

      state.products = json.products || [];
      state.currentRound = json.currentRound;
      state.shopInfo = json.shopInfo;

      if (state.currentRound) {
        el.roundName.textContent = state.currentRound.name;
        el.roundRoute.textContent = state.currentRound.truckRoute;
        el.roundHarvest.textContent = state.currentRound.harvestDate;
        el.roundDelivery.textContent = state.currentRound.deliveryDate;
        el.roundQuota.textContent =
          state.currentRound.quotaRemaining + " / " + state.currentRound.totalQuota + " ลูก";
        startCountdown(state.currentRound.closeDate);
      }

      // Shipping dropdown
      if (state.shopInfo && state.shopInfo.shippingMethods) {
        el.coShipping.innerHTML = state.shopInfo.shippingMethods
          .map(
            (s) =>
              `<option value="${escapeHtml(s.name)}" data-price="${s.price}">${escapeHtml(
                s.name
              )} (${s.price === 0 ? "ฟรี" : "+฿" + s.price})</option>`
          )
          .join("");
      }

      if (json.lineLiffId) {
        initLiffIfConfigured(json.lineLiffId);
      }

      renderFilters();
      renderProducts();
      renderCart();
    } catch (err) {
      el.grid.innerHTML = `<p class="error-box">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(err)}</p>`;
    }
  }

  function initLiffIfConfigured(liffId) {
    const s = document.createElement("script");
    s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    s.onload = async () => {
      try {
        await window.liff.init({ liffId });
        if (window.liff.isLoggedIn()) {
          const p = await window.liff.getProfile();
          state.lineProfile = p;
          el.liffBanner.textContent = `สวัสดีคุณ ${p.displayName} (เชื่อมต่อ LINE OA พร้อมรับแจ้งเตือนอัตโนมัติ)`;
          el.liffBanner.classList.remove("hidden");
          if (!el.coName.value) el.coName.value = p.displayName;
        }
      } catch {
        // Outside LINE app
      }
    };
    document.head.appendChild(s);
  }

  // ---------- Render Filters & Products ----------
  function renderFilters() {
    const varieties = ["all", ...new Set(state.products.map((p) => p.variety))];
    el.filters.innerHTML = varieties
      .map(
        (v) =>
          `<button type="button" class="filter-btn ${
            state.filter === v ? "active" : ""
          }" data-variety="${escapeHtml(v)}">${
            v === "all" ? "ทั้งหมด" : "พันธุ์" + escapeHtml(v)
          }</button>`
      )
      .join("");
  }

  function renderProducts() {
    const list =
      state.filter === "all"
        ? state.products
        : state.products.filter((p) => p.variety === state.filter);

    el.grid.innerHTML = list
      .map(
        (p) => `
      <article class="product-card">
        <div>
          <div class="product-img-wrap">
            <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" />
            <span class="origin-tag">${escapeHtml(p.origin)}</span>
          </div>
          <div class="product-body">
            <div class="product-meta">
              <span>พันธุ์${escapeHtml(p.variety)} • ${escapeHtml(p.weight)}</span>
              <span class="brix-tag">${escapeHtml(p.brix)}</span>
            </div>
            <h3 class="product-title">${escapeHtml(p.name)}</h3>
            <p class="product-desc">${escapeHtml(p.description)}</p>
          </div>
        </div>
        <div class="product-footer">
          <div>
            <span class="price">฿${Number(p.price).toLocaleString()}</span>
            <span class="unit">/${escapeHtml(p.unit)}</span>
          </div>
          <button
            type="button"
            class="btn-primary add-to-cart-btn"
            data-id="${escapeHtml(p.id)}"
            ${!p.isAvailable ? "disabled" : ""}
          >
            ${p.isAvailable ? "+ เพิ่มลงตะกร้า" : "หมดชั่วคราว"}
          </button>
        </div>
      </article>`
      )
      .join("");
  }

  // ---------- Cart Logic ----------
  function addToCart(productId) {
    const prod = state.products.find((p) => p.id === productId);
    if (!prod || !prod.isAvailable) return;

    const existing = state.cart.find((c) => c.product.id === productId);
    if (existing) {
      existing.qty += 1;
    } else {
      state.cart.push({ product: prod, qty: 1 });
    }
    renderCart();
    showToast(`เพิ่ม "${prod.name}" ลงตะกร้าแล้ว`);
  }

  function updateCartQty(productId, delta) {
    const item = state.cart.find((c) => c.product.id === productId);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      state.cart = state.cart.filter((c) => c.product.id !== productId);
    }
    renderCart();
  }

  function renderCart() {
    const count = state.cart.reduce((s, c) => s + c.qty, 0);
    el.cartBadge.textContent = String(count);

    if (state.cart.length === 0) {
      el.cartItemsBox.innerHTML = `<p class="muted" style="text-align:center; padding: 18px 0;">ยังไม่มีสินค้าในตะกร้า</p>`;
      el.checkoutForm.classList.add("hidden");
      return;
    }

    el.checkoutForm.classList.remove("hidden");
    el.cartItemsBox.innerHTML = state.cart
      .map(
        (it) => `
      <div class="cart-row">
        <div>
          <strong style="font-size:12px;">${escapeHtml(it.product.name)}</strong>
          <div class="muted">฿${(it.product.price * it.qty).toLocaleString()}</div>
        </div>
        <div class="cart-qty">
          <button type="button" class="qty-btn" data-qty-id="${escapeHtml(it.product.id)}" data-delta="-1">−</button>
          <strong style="font-size:12px; min-width:16px; text-align:center;">${it.qty}</strong>
          <button type="button" class="qty-btn" data-qty-id="${escapeHtml(it.product.id)}" data-delta="1">+</button>
        </div>
      </div>`
      )
      .join("");

    updateTotalDisplay();
  }

  function updateTotalDisplay() {
    const subtotal = state.cart.reduce((s, c) => s + c.product.price * c.qty, 0);
    const opt = el.coShipping.options[el.coShipping.selectedIndex];
    const shipCost = opt ? Number(opt.dataset.price || 0) : 0;
    el.coTotal.textContent = "฿" + (subtotal + shipCost).toLocaleString();
  }

  // ---------- Event Listeners ----------
  document.addEventListener("click", (e) => {
    const target = e.target;

    if (target.closest(".filter-btn")) {
      state.filter = target.closest(".filter-btn").dataset.variety;
      renderFilters();
      renderProducts();
    }

    if (target.closest(".add-to-cart-btn")) {
      addToCart(target.closest(".add-to-cart-btn").dataset.id);
    }

    if (target.closest(".qty-btn")) {
      const btn = target.closest(".qty-btn");
      updateCartQty(btn.dataset.qtyId, Number(btn.dataset.delta));
    }

    if (target.closest(".mode-tab")) {
      const tab = target.closest(".mode-tab").dataset.tab;
      document.querySelectorAll(".mode-tab").forEach((b) => b.classList.remove("active"));
      target.closest(".mode-tab").classList.add("active");
      document.getElementById("tab-shop").classList.toggle("hidden", tab !== "shop");
      document.getElementById("tab-track").classList.toggle("hidden", tab !== "track");
    }
  });

  el.coShipping.addEventListener("change", updateTotalDisplay);

  document.getElementById("btn-open-cart").addEventListener("click", () => {
    el.orderSuccessBox.classList.add("hidden");
    renderCart();
    el.cartModal.classList.remove("hidden");
  });

  document.getElementById("btn-close-cart").addEventListener("click", () => {
    el.cartModal.classList.add("hidden");
  });

  el.cartModal.addEventListener("click", (e) => {
    if (e.target === el.cartModal) el.cartModal.classList.add("hidden");
  });

  document.getElementById("btn-done-order").addEventListener("click", () => {
    el.cartModal.classList.add("hidden");
  });

  // Submit Order via Fetch API
  el.checkoutForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    el.coError.classList.add("hidden");
    const submitBtn = document.getElementById("btn-submit-order");
    submitBtn.disabled = true;
    submitBtn.textContent = "กำลังบันทึกคำสั่งซื้อ...";

    try {
      const rip = el.coRipeness.value;
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: el.coName.value,
          phone: el.coPhone.value,
          address: el.coAddress.value,
          ripenessPref: rip,
          shippingMethod: el.coShipping.value,
          roundId: state.currentRound ? state.currentRound.id : "WK-ROUND-46",
          lineUserId: state.lineProfile ? state.lineProfile.userId : undefined,
          items: state.cart.map((c) => ({
            productId: c.product.id,
            qty: c.qty,
            ripenessPref: rip,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok || !json.order) {
        el.coError.textContent = json.error || "ไม่สามารถบันทึกคำสั่งซื้อได้";
        el.coError.classList.remove("hidden");
      } else {
        state.lastCreatedOrder = json.order;
        state.cart = [];
        renderCart();
        el.checkoutForm.classList.add("hidden");
        el.cartItemsBox.innerHTML = "";
        el.resOrderId.textContent = json.order.id;

        const grandTotal = json.order.totalPrice + json.order.shippingCost;
        const promptPayPhone =
          (state.shopInfo && state.shopInfo.bankAccount && state.shopInfo.bankAccount.promptPay) ||
          "0822824238";
        const payload = buildPromptPayPayload(promptPayPhone, grandTotal);
        el.resQrWrap.innerHTML = `<img alt="PromptPay QR" width="180" height="180" style="border:1px solid #e7e5e4; border-radius:12px;" src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
          payload
        )}" />`;
        el.orderSuccessBox.classList.remove("hidden");
        loadShopData();
      }
    } catch {
      el.coError.textContent = "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์";
      el.coError.classList.remove("hidden");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "ยืนยันสั่งซื้อ";
    }
  });

  document.getElementById("btn-copy-summary").addEventListener("click", () => {
    const o = state.lastCreatedOrder;
    if (!o) return;
    const total = o.totalPrice + o.shippingCost;
    const msg = `สั่งซื้อทุเรียนวินคิน (${o.id})\nผู้รับ: ${o.customerName} (${o.phone})\nยอดโอนสุทธิ: ฿${total.toLocaleString()}\nความสุก: ${o.ripenessPref}`;
    navigator.clipboard.writeText(msg);
    showToast("คัดลอกสรุปออเดอร์แล้ว");
  });

  // Track Form
  el.trackForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = el.trackInput.value.trim();
    if (!id) return;
    el.trackResult.innerHTML = `<p class="muted">กำลังค้นหา...</p>`;
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(id)}`);
      const json = await res.json();
      if (!res.ok || !json.ok || !json.order) {
        el.trackResult.innerHTML = `<p class="error-box">ไม่พบคำสั่งซื้อรหัสนี้ในระบบ</p>`;
        return;
      }
      const o = json.order;
      el.trackResult.innerHTML = `
        <div style="background:#fafaf9; border:1px solid #e7e5e4; border-radius:12px; padding:14px;">
          <p><strong>รหัส:</strong> ${escapeHtml(o.id)} (${escapeHtml(o.customerName)})</p>
          <p><strong>สถานะ:</strong> ${escapeHtml(o.orderStatus)} | <strong>ชำระเงิน:</strong> ${escapeHtml(o.paymentStatus)}</p>
          <p><strong>ยอดรวม:</strong> ฿${(o.totalPrice + o.shippingCost).toLocaleString()}</p>
          ${o.trackingNo ? `<p><strong>Tracking:</strong> ${escapeHtml(o.trackingNo)}</p>` : ""}
        </div>`;
    } catch {
      el.trackResult.innerHTML = `<p class="error-box">เชื่อมต่อไม่สำเร็จ</p>`;
    }
  });

  // Initial Load
  loadShopData();
})();
