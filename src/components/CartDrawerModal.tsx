"use client";

import { useEffect, useState } from "react";
import { shopInfo } from "../data/mock";
import { useCart } from "../context/CartContext";
import type { Order } from "../types/durian";
import { OrderSuccessModal } from "./OrderSuccessModal";

export function CartDrawerModal({
  roundId,
  lineProfile,
  onSuccess,
  onClose,
}: {
  roundId: string;
  lineProfile: { userId: string; displayName: string } | null;
  onSuccess: (order: Order) => void;
  onClose: () => void;
}) {
  const { items, updateQty, removeItem, clearCart, totalPrice } = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [shipping, setShipping] = useState(shopInfo.shippingMethods[0].name);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (lineProfile?.displayName && !name) {
      setName(lineProfile.displayName);
    }
  }, [lineProfile, name]);

  if (createdOrder) {
    return (
      <OrderSuccessModal
        order={createdOrder}
        onClose={() => {
          setCreatedOrder(null);
          onClose();
        }}
      />
    );
  }

  const shippingCost =
    shopInfo.shippingMethods.find((s) => s.name === shipping)?.price || 0;
  const grandTotal = totalPrice + shippingCost;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    setSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          phone,
          address,
          shippingMethod: shipping,
          roundId,
          lineUserId: lineProfile?.userId,
          items: items.map((it) => ({
            productId: it.product.id,
            qty: it.qty,
            ripenessPref: it.ripenessPref,
          })),
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        order?: Order;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.order) {
        setErrorMsg(json.error || "ไม่สามารถบันทึกคำสั่งซื้อได้");
      } else {
        setCreatedOrder(json.order);
        clearCart();
        onSuccess(json.order);
      }
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex justify-end backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          {/* Header */}
          <div className="bg-green-800 text-white px-5 py-4 flex items-center justify-between border-b-2 border-yellow-400 sticky top-0 z-10">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🛒</span>
              <div>
                <h4 className="font-black text-base text-yellow-300">
                  ตะกร้าทุเรียนของคุณ ({items.reduce((s, i) => s + i.qty, 0)})
                </h4>
                <p className="text-[10px] text-green-200">
                  รวมหลายรายการ ประหยัดค่าจัดส่งในรอบเดียว
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-yellow-300 text-xl font-bold"
            >
              ✕
            </button>
          </div>

          {/* Cart Items */}
          <div className="p-5 space-y-3">
            {items.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <span className="text-5xl block">🍈</span>
                <p className="font-bold text-gray-700 text-sm">
                  ยังไม่มีทุเรียนในตะกร้าเลยครับ
                </p>
                <p className="text-xs text-gray-400">
                  เลือกสายพันธุ์ที่ชอบแล้วกด &quot;+ ใส่ตะกร้า&quot; ได้เลย
                </p>
              </div>
            ) : (
              items.map((it) => (
                <div
                  key={it.key}
                  className="bg-amber-50/70 border border-yellow-200 rounded-2xl p-3 flex gap-3 items-center"
                >
                  <img
                    src={it.product.image}
                    alt={it.product.name}
                    className="w-14 h-14 rounded-xl object-cover shrink-0 border border-yellow-300"
                  />
                  <div className="flex-1 min-w-0">
                    <h5 className="font-black text-xs text-gray-900 truncate">
                      {it.product.name}
                    </h5>
                    <p className="text-[11px] text-amber-800 font-bold">
                      🥑 {it.ripenessPref}
                    </p>
                    <p className="text-xs font-black text-green-800 mt-0.5">
                      ฿{(it.product.price * it.qty).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQty(it.key, it.qty - 1)}
                      className="w-7 h-7 bg-white border border-gray-300 rounded-full text-xs font-black"
                    >
                      −
                    </button>
                    <span className="text-xs font-black w-5 text-center">
                      {it.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQty(it.key, it.qty + 1)}
                      className="w-7 h-7 bg-green-700 text-white rounded-full text-xs font-black"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(it.key)}
                      className="text-gray-400 hover:text-red-500 text-xs ml-1"
                      title="ลบ"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Checkout Form when cart has items */}
        {items.length > 0 && (
          <form
            onSubmit={handleCheckout}
            className="p-5 border-t-2 border-yellow-200 bg-gray-50/60 space-y-3"
          >
            {lineProfile && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-2.5 text-xs text-green-800 font-bold">
                💚 เชื่อมต่อ LINE คุณ {lineProfile.displayName} แล้ว (รับแจ้งเตือนพัสดุอัตโนมัติ)
              </div>
            )}

            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ชื่อ-นามสกุล ผู้รับ *"
              className="w-full border-2 border-gray-200 rounded-xl px-3.5 py-2 text-xs bg-white focus:border-green-700 focus:outline-none"
            />
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="เบอร์โทรศัพท์ * (08X-XXX-XXXX)"
              className="w-full border-2 border-gray-200 rounded-xl px-3.5 py-2 text-xs bg-white focus:border-green-700 focus:outline-none"
            />
            <textarea
              required
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="ที่อยู่จัดส่งละเอียด *"
              className="w-full border-2 border-gray-200 rounded-xl px-3.5 py-2 text-xs bg-white focus:border-green-700 focus:outline-none resize-none"
            />

            <select
              value={shipping}
              onChange={(e) => setShipping(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-xs font-bold bg-white"
            >
              {shopInfo.shippingMethods.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} ({s.price === 0 ? "ฟรี" : `+฿${s.price}`})
                </option>
              ))}
            </select>

            <div className="bg-yellow-50 border border-yellow-300 rounded-2xl p-3 flex justify-between items-center">
              <span className="text-xs font-bold text-amber-900">
                ยอดรวมสุทธิ (รวมค่าส่ง ฿{shippingCost})
              </span>
              <span className="text-xl font-black text-green-800">
                ฿{grandTotal.toLocaleString()}
              </span>
            </div>

            {errorMsg && (
              <div className="bg-red-50 text-red-700 text-xs font-bold p-2.5 rounded-xl border border-red-200">
                ⚠️ {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-green-950 py-3.5 rounded-full font-black text-sm shadow-lg transition disabled:opacity-60"
            >
              {submitting
                ? "⏳ กำลังสร้างออเดอร์..."
                : `✓ สั่งซื้อทั้งหมด ฿${grandTotal.toLocaleString()}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
