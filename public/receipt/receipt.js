// ============================================================
// Pure Vanilla JS — Printable Receipt & Shipping Label
// ============================================================
(function () {
  "use strict";

  const sheet = document.getElementById("sheet");
  const printBtn = document.getElementById("btn-print");

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  printBtn.addEventListener("click", () => window.print());

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") || "WK-9521";

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(id)}`);
      const json = await res.json();
      if (!res.ok || !json.ok || !json.order) {
        sheet.innerHTML = `<p class="loading">ไม่พบคำสั่งซื้อรหัส ${esc(id)}</p>`;
        return;
      }

      const o = json.order;
      const grandTotal = o.totalPrice + o.shippingCost;
      const dateStr = new Date(o.createdAt).toLocaleString("th-TH");

      const itemRows = o.items
        .map(
          (it, idx) => `
        <tr>
          <td>${idx + 1}. ${esc(it.productName)}</td>
          <td class="text-right">${it.qty}</td>
          <td class="text-right">฿${Number(it.price).toLocaleString()}</td>
          <td class="text-right">฿${Number(it.price * it.qty).toLocaleString()}</td>
        </tr>`
        )
        .join("");

      sheet.innerHTML = `
        <header class="header">
          <div class="brand-row">
            <img src="/logo.jpg" alt="ทุเรียนวินคิน" class="logo" />
            <div>
              <div class="brand-name">ทุเรียนวินคิน (WINKIN DURIAN)</div>
              <div style="font-size:11px; color:#57534e;">คัดสดจากสวน วิ่งส่งตรงถึงบ้าน • โทร. 082-282-4238 • LINE: @durianwinkin</div>
            </div>
          </div>
          <div class="doc-title">
            <h2>ใบเสร็จรับเงิน / ใบส่งสินค้า</h2>
            <div style="font-size:12px; font-family:monospace; font-weight:700;">#${esc(o.id)}</div>
          </div>
        </header>

        <section class="grid-2">
          <div class="box">
            <div class="box-label">ข้อมูลผู้ซื้อ / ผู้รับ</div>
            <div><strong>${esc(o.customerName)}</strong></div>
            <div>โทร: ${esc(o.phone)}</div>
            <div>ที่อยู่: ${esc(o.address || "(ดูรายละเอียดในระบบ Admin / แชท LINE)")}</div>
          </div>
          <div class="box">
            <div class="box-label">รายละเอียดคำสั่งซื้อ</div>
            <div>วันที่สั่ง: ${esc(dateStr)}</div>
            <div>รอบจัดส่ง: ${esc(o.roundId)}</div>
            <div>การชำระเงิน: <strong>${o.paymentStatus === "confirmed" ? "ชำระแล้ว" : "รอตรวจสอบ"}</strong></div>
            <div>ความสุก: <strong>${esc(o.ripenessPref || "-")}</strong></div>
          </div>
        </section>

        <table>
          <thead>
            <tr>
              <th>รายการสินค้า</th>
              <th class="text-right">จำนวน</th>
              <th class="text-right">ราคา/หน่วย</th>
              <th class="text-right">รวมเงิน</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
            <tr>
              <td colspan="3" class="text-right">ค่าจัดส่ง (${esc(o.shippingMethod)})</td>
              <td class="text-right">฿${Number(o.shippingCost).toLocaleString()}</td>
            </tr>
            <tr class="total-row">
              <td colspan="3" class="text-right">ยอดชำระสุทธิทั้งสิ้น</td>
              <td class="text-right">฿${grandTotal.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <div class="cut-line"><span>ตัดตามรอยปรุสำหรับแปะหน้ากล่องพัสดุ</span></div>

        <section class="label-box">
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid #d6d3d1; padding-bottom:8px; margin-bottom:10px;">
            <div>
              <strong>ผู้ส่ง:</strong> ทุเรียนวินคิน (โทร. 082-282-4238)
            </div>
            <div style="font-family:monospace; font-weight:800;">ORDER: ${esc(o.id)}</div>
          </div>
          <div style="font-size:14px; line-height:1.6;">
            <div><strong>ผู้รับ (TO):</strong> ${esc(o.customerName)} • โทร. ${esc(o.phone)}</div>
            <div><strong>ที่อยู่:</strong> ${esc(o.address || "(ตรวจสอบในระบบ Admin)")}</div>
            <div style="font-size:12px; margin-top:6px;">
              <strong>ขนส่ง:</strong> ${esc(o.shippingMethod)}
              ${o.trackingNo ? ` | <strong>Tracking:</strong> ${esc(o.trackingNo)}` : ""}
            </div>
          </div>
          <div class="warning-bar">
            ระวังหนามทุเรียน • ผลไม้สด กรุณาส่งด่วน ห้ามโยน / ห้ามตากแดด
          </div>
        </section>
      `;
    } catch {
      sheet.innerHTML = `<p class="loading">ไม่สามารถโหลดข้อมูลได้</p>`;
    }
  }

  init();
})();
