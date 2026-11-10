"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { shopInfo } from "../data/mock";
import { useCart } from "../context/CartContext";
import type { Order } from "../types/durian";
import { OrderSuccessModal } from "./OrderSuccessModal";
import { LineIcon } from "./Icons";

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
      className="fixed inset-0 bg-black/70 z-50 flex justify-end backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          {/* Header */}
          <div className="bg-[#1B4D31] text-white px-5 py-4 flex items-center justify-between border-b border-emerald-900 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h4 className="font-bold text-base text-white">
                  ตะกร้าสินค้า ({items.reduce((s, i) => s + i.qty, 0)})
                </h4>
                <p className="text-[11px] text-emerald-200">
                  รวมหลายสายพันธุ์ ประหยัดค่าจัดส่งในรอบเดียว
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
              aria-label="Close Cart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Items */}
          <div className="p-5 space-y-3">
            {items.length === 0 ? (
              <div className="text-center py-14 space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-2">
                  <ShoppingBag className="w-7 h-7" />
                </div>
                <p className="font-bold text-stone-700 text-sm">
                  ยังไม่มีสินค้าในตะกร้า
                </p>
                <p className="text-xs text-stone-400">
                  เลือกทุเรียนที่ชอบแล้วกด &quot;ใส่ตะกร้า&quot; ได้เลยครับ
                </p>
              </div>
            ) : (
              items.map((it) => (
                <div
                  key={it.key}
                  className="bg-stone-50 border border-stone-200 rounded-2xl p-3 flex gap-3 items-center"
                >
                  <img
                    src={it.product.image}
                    alt={it.product.name}
                    className="w-14 h-14 rounded-xl object-cover shrink-0 border border-stone-200"
                  />
                  <div className="flex-1 min-w-0">
                    <h5 className="font-bold text-xs text-stone-900 truncate">
                      {it.product.name}
                    </h5>
                    <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1 mt-0.5">
                      <Sparkles className="w-3 h-3 shrink-0" />
                      <span className="truncate">{it.ripenessPref}</span>
                    </p>
                    <p className="text-xs font-bold text-[#1B4D31] mt-0.5">
                      ฿{(it.product.price * it.qty).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQty(it.key, it.qty - 1)}
                      className="w-7 h-7 bg-white border border-stone-300 rounded-lg flex items-center justify-center text-stone-700 hover:bg-stone-100"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold w-5 text-center">
                      {it.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQty(it.key, it.qty + 1)}
                      className="w-7 h-7 bg-[#1B4D31] text-white rounded-lg flex items-center justify-center hover:bg-[#143B25]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(it.key)}
                      className="text-stone-400 hover:text-rose-600 p-1 ml-0.5 transition"
                      title="ลบออก"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Checkout Form */}
        {items.length > 0 && (
          <form
            onSubmit={handleCheckout}
            className="p-5 border-t border-stone-200 bg-stone-50/80 space-y-3"
          >
            {lineProfile && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-800 font-semibold flex items-center gap-2">
                <LineIcon className="w-4 h-4 text-[#06C755] shrink-0" />
                <span>เชื่อมต่อบัญชีคุณ {lineProfile.displayName} แล้ว</span>
              </div>
            )}

            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ชื่อ-นามสกุล ผู้รับ *"
              className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs bg-white focus:border-[#1B4D31] focus:outline-none"
            />
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="เบอร์โทรศัพท์ * (08X-XXX-XXXX)"
              className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs bg-white focus:border-[#1B4D31] focus:outline-none"
            />
            <textarea
              required
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="ที่อยู่จัดส่งละเอียด *"
              className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs bg-white focus:border-[#1B4D31] focus:outline-none resize-none"
            />

            <select
              value={shipping}
              onChange={(e) => setShipping(e.target.value)}
              className="w-full border border-stone-300 rounded-xl px-3 py-2.5 text-xs font-semibold bg-white focus:border-[#1B4D31] focus:outline-none"
            >
              {shopInfo.shippingMethods.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} ({s.price === 0 ? "ฟรี" : `+฿${s.price}`})
                </option>
              ))}
            </select>

            <div className="bg-white border border-stone-200 rounded-2xl p-3.5 flex justify-between items-center">
              <span className="text-xs font-semibold text-stone-600">
                ยอดรวมสุทธิ (รวมค่าส่ง ฿{shippingCost})
              </span>
              <span className="text-xl font-black text-[#1B4D31]">
                ฿{grandTotal.toLocaleString()}
              </span>
            </div>

            {errorMsg && (
              <div className="bg-rose-50 text-rose-700 text-xs font-semibold p-2.5 rounded-xl border border-rose-200">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#1B4D31] hover:bg-[#143B25] text-white py-3.5 rounded-xl font-bold text-sm shadow-md transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-300" />
              <span>
                {submitting
                  ? "กำลังสร้างออเดอร์..."
                  : `ยืนยันสั่งซื้อทั้งหมด ฿${grandTotal.toLocaleString()}`}
              </span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
