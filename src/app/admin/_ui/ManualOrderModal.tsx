"use client";

// สร้างออเดอร์แทนลูกค้า (โทรสั่ง/หน้าร้าน) — ย้ายมาจากหน้าแอดมินเดิม
import { useState } from "react";
import { AlertTriangle, CheckCircle2, PlusCircle } from "lucide-react";
import { formatProductStock, pricePerKgOf } from "../../../lib/stock";
import type { Order, Product, Round, SafeUser } from "../../../types/durian";

export function ManualOrderModal({
  products,
  rounds,
  users,
  onClose,
  onOrderCreated,
}: {
  products: Product[];
  rounds: Round[];
  users: SafeUser[];
  onClose: () => void;
  onOrderCreated: (order: Order) => void;
}) {
  const [selectedUserMode, setSelectedUserMode] = useState<"new" | "existing">("new");
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [lineUserId, setLineUserId] = useState("");

  const [productId, setProductId] = useState(products[0]?.id || "");
  const [qty, setQty] = useState(1);
  const [customPrice, setCustomPrice] = useState(products[0] ? pricePerKgOf(products[0]) : 220);
  const [ripenessPref, setRipenessPref] = useState("กรอบนอกนุ่มใน");
  const [roundId, setRoundId] = useState(rounds[0]?.id || "");
  const [shippingMethod, setShippingMethod] = useState("ควบคุมอุณหภูมิ (เย็น)");
  const [shippingCost, setShippingCost] = useState(120);
  const [notifyLine, setNotifyLine] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleProductChange = (id: string) => {
    setProductId(id);
    const prod = products.find((p) => p.id === id);
    if (prod) {
      setCustomPrice(pricePerKgOf(prod));
    }
  };

  const handleSelectUser = (u: SafeUser) => {
    setSelectedUserId(u.userId || "");
    setCustomerName(u.displayName || u.username);
    setPhone(u.phone || "");
    setAddress(u.address || "");
    setMapsUrl(u.mapsUrl || "");
    setLineUserId(u.lineUserId || "");
  };

  const selectedProd = products.find((p) => p.id === productId) || products[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !phone.trim() || !address.trim()) {
      setError("กรุณากรอกชื่อลูกค้า เบอร์โทรศัพท์ และที่อยู่จัดส่งให้ครบถ้วน");
      return;
    }
    if (qty <= 0) {
      setError("จำนวนต้องมากกว่า 0");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        customerName: customerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        mapsUrl: mapsUrl.trim() || undefined,
        items: [
          {
            productId: selectedProd ? selectedProd.id : "manual",
            productName: selectedProd ? selectedProd.name : "ทุเรียนสั่งพิเศษ",
            qty: Number(qty),
            variety: selectedProd ? selectedProd.variety : "หมอนทอง",
          },
        ],
        shippingMethod,
        shippingCost: Number(shippingCost || 0),
        ripenessPref: ripenessPref || "กรอบนอกนุ่มใน",
        roundId: roundId || undefined,
        userId: selectedUserId || undefined,
        lineUserId: lineUserId.trim() || undefined,
        isAdminRequest: true,
        notifyLine: Boolean(notifyLine && lineUserId),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.ok && json.order) {
        onOrderCreated(json.order);
        onClose();
      } else {
        setError(json.error || "ไม่สามารถสร้างออเดอร์ได้");
      }
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.phone?.includes(userSearch) ||
      u.userId?.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-2xl rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl border border-stone-200 my-8 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div>
            <h3 className="font-extrabold text-lg text-stone-900 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-[#1B4D31]" />
              <span>ออกออเดอร์ใหม่ (Manual Order / POS หน้าร้าน)</span>
            </h3>
            <p className="text-xs text-stone-500">
              สร้างคำสั่งซื้อโดยตรงโดยแอดมิน ระบบจะตัดสต็อกและจัดสรรโควตารอบรถให้อัตโนมัติ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-sm p-1"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold p-3 rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* User Selection */}
        <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-stone-800">
              👤 ข้อมูลลูกค้า (Customer Info)
            </span>
            <div className="flex gap-1 bg-white p-1 rounded-xl border border-stone-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setSelectedUserMode("new")}
                className={`px-2.5 py-1 rounded-lg transition ${
                  selectedUserMode === "new"
                    ? "bg-[#1B4D31] text-white"
                    : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                กรอกข้อมูลใหม่
              </button>
              <button
                type="button"
                onClick={() => setSelectedUserMode("existing")}
                className={`px-2.5 py-1 rounded-lg transition ${
                  selectedUserMode === "existing"
                    ? "bg-[#1B4D31] text-white"
                    : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                เลือกจากสมาชิก ({users.length})
              </button>
            </div>
          </div>

          {selectedUserMode === "existing" && (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="ค้นหาชื่อ, เบอร์โทร หรือ User ID..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
              />
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                {filteredUsers.slice(0, 10).map((u) => (
                  <div
                    key={u.userId}
                    onClick={() => handleSelectUser(u)}
                    className={`cursor-pointer p-2 rounded-xl text-xs border flex items-center justify-between transition ${
                      selectedUserId === u.userId
                        ? "bg-[#1B4D31]/10 border-[#1B4D31] font-bold text-[#1B4D31]"
                        : "bg-white border-stone-200 hover:bg-stone-100 text-stone-700"
                    }`}
                  >
                    <span>{u.displayName || u.username} ({u.phone || "ไม่มีเบอร์"})</span>
                    <span className="text-[10px] text-stone-400 font-mono">{u.userId}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                ชื่อผู้รับ *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="เช่น สมชาย ใจดี"
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                เบอร์โทรศัพท์ *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="เช่น 0812345678"
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">
              ที่อยู่จัดส่ง *
            </label>
            <textarea
              rows={2}
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="บ้านเลขที่ ซอย ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                Google Maps URL (ลิงก์หมุดนำทาง)
              </label>
              <input
                type="url"
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder="https://maps.google.com/..."
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-mono text-[11px]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                LINE User ID (ถ้าทราบ เช่น U062...)
              </label>
              <input
                type="text"
                value={lineUserId}
                onChange={(e) => setLineUserId(e.target.value)}
                placeholder="U..."
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-mono text-[11px]"
              />
            </div>
          </div>
        </div>

        {/* Product & Ripeness */}
        <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/60 space-y-3">
          <span className="text-xs font-extrabold text-stone-800">
            🍈 รายการสินค้าและสเปกทุเรียน
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                เลือกสินค้า
              </label>
              <select
                value={productId}
                onChange={(e) => handleProductChange(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-bold"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.variety}) - ฿{pricePerKgOf(p)}/กก. [คงเหลือ: {formatProductStock(p).summary}]
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                จำนวน (กก./ลูก/กล่อง)
              </label>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-bold text-center font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                ราคาต่อกิโล (แก้ได้ตอนชั่ง)
              </label>
              <div className="w-full border border-stone-200 rounded-xl px-3 py-2 text-xs bg-stone-50 font-bold font-mono">
                ฿{customPrice.toLocaleString()}/กก.
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                ระดับความสุก (Ripeness)
              </label>
              <select
                value={ripenessPref}
                onChange={(e) => setRipenessPref(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-bold"
              >
                <option value="กรอบนอกนุ่มใน">กรอบนอกนุ่มใน (ยอดฮิต)</option>
                <option value="พอดีกิน">พอดีกิน (นุ่มละมุน)</option>
                <option value="สุกนิ่ม">สุกนิ่ม (หวานจัด)</option>
                <option value="ไก่ฉีก">ไก่ฉีก (กรอบมาก)</option>
                <option value="นำไปบ่มเอง">นำไปบ่มเอง (ตัดสด)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                รอบตัดส่ง (Round)
              </label>
              <select
                value={roundId}
                onChange={(e) => setRoundId(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-bold"
              >
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.deliveryDate || r.harvestDate || "รอบปัจจุบัน"})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Shipping & Payment */}
        <div className="bg-sky-50/50 p-4 rounded-2xl border border-sky-200/60 space-y-3">
          <span className="text-xs font-extrabold text-stone-800">
            🚚 การจัดส่งและการชำระเงิน
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                วิธีจัดส่ง
              </label>
              <select
                value={shippingMethod}
                onChange={(e) => setShippingMethod(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-bold"
              >
                <option value="ควบคุมอุณหภูมิ (เย็น)">รถห้องเย็นควบคุมอุณหภูมิ (Cold Chain)</option>
                <option value="ด่วนมอเตอร์ไซค์">ส่งด่วน Grab / Lalamove</option>
                <option value="นัดรับที่สวน">นัดรับที่สวน / หน้าร้าน</option>
                <option value="ขนส่งเอกชนทั่วไป">ขนส่งพัสดุด่วนเอกชน (Kerry / Flash)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                ค่าจัดส่ง (฿)
              </label>
              <input
                type="number"
                value={shippingCost}
                onChange={(e) => setShippingCost(Number(e.target.value))}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-bold font-mono"
              />
            </div>
          </div>

          <p className="text-[11px] text-stone-500 bg-stone-50 border border-stone-200 rounded-xl p-2.5">
            ออเดอร์จะเป็น &quot;สั่งจอง&quot; — เปิดหน้าออเดอร์เพื่อชั่งน้ำหนัก (ระบบคิดยอดจากราคาต่อกิโล) แล้วค่อยยืนยันรับเงิน
          </p>

          {lineUserId && (
            <label className="flex items-center gap-2 text-xs text-stone-700 pt-1">
              <input
                type="checkbox"
                checked={notifyLine}
                onChange={(e) => setNotifyLine(e.target.checked)}
                className="accent-[#1B4D31]"
              />
              <span>ส่ง Flex Message สรุปคำสั่งซื้อเข้า LINE ลูกค้าทันที</span>
            </label>
          )}
        </div>

        {/* Total Summary */}
        <div className="bg-[#1B4D31]/5 border border-[#1B4D31]/20 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-stone-500 font-bold">ยอดเงิน = น้ำหนักที่ชั่ง × ฿{customPrice.toLocaleString()}/กก.</p>
            <p className="text-xs text-stone-400">+ ค่าส่ง ฿{shippingCost.toLocaleString()} — คิดยอดตอนชั่งในหน้าออเดอร์</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-[#1B4D31] hover:bg-[#143B25] text-white font-extrabold py-3 rounded-2xl text-xs transition shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <CheckCircle2 className="w-4 h-4 text-amber-300" />
            <span>{submitting ? "กำลังบันทึกออเดอร์..." : "บันทึกและสร้างออเดอร์ (Confirm Order)"}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-2xl text-xs transition"
          >
            ยกเลิก
          </button>
        </div>
      </form>
    </div>
  );
}
