"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Minus, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { shopInfo } from "../data/shop";
import { CheckoutAccountGate, canCheckout } from "./CheckoutAccountGate";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import type { Order } from "../types/durian";
import { OrderSuccessModal } from "./OrderSuccessModal";
import { LineIcon } from "./Icons";
import { MapLocationPicker } from "./MapLocationPicker";
import { pricePerKgOf } from "../lib/stock";
import { Sheet } from "./store/Sheet";

const field =
  "w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:border-[#1B4D31] focus:ring-2 focus:ring-[#1B4D31]/15 focus:outline-none";

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
  const { items, updateQty, removeItem, clearCart } = useCart();
  const { user, openAuthModal } = useAuth();
  const [name, setName] = useState(
    user
      ? `${user.firstName} ${user.lastName}`.trim() || user.username
      : lineProfile?.displayName || ""
  );
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setAddress] = useState(
    user ? `${user.address} ${user.postalCode}`.trim() : ""
  );
  const [shipping, setShipping] = useState(shopInfo.shippingMethods[0].name);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (user) {
      if (!name) setName(`${user.firstName} ${user.lastName}`.trim() || user.username);
      if (!phone && user.phone) setPhone(user.phone);
      if (!address && user.address) {
        setAddress(`${user.address} ${user.postalCode}`.trim());
      }
    } else if (lineProfile?.displayName && !name) {
      setName(lineProfile.displayName);
    }
  }, [user, lineProfile]);

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
          userId: user?.id || user?.userId,
          customerName: name,
          phone,
          address,
          shippingMethod: shipping,
          roundId,
          lineUserId: user?.lineUserId || lineProfile?.userId,
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

  const count = items.reduce((s, i) => s + i.qty, 0);

  return (
    <Sheet
      onClose={onClose}
      title={`ตะกร้าสินค้า (${count})`}
      footer={
        items.length > 0 ? (
          <div className="space-y-2">
            {errorMsg && <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{errorMsg}</p>}
            <button
              type="submit"
              form="cart-checkout"
              disabled={submitting || !canCheckout(user)}
              className="w-full h-11 rounded-lg bg-[#1B4D31] hover:bg-[#143B25] disabled:opacity-50 text-white text-sm font-bold inline-flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> กำลังส่งออเดอร์…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#FFD84D]" /> ยืนยันจอง ({count} ชิ้น)
                </>
              )}
            </button>
          </div>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <div className="text-center py-12 px-4">
          <ShoppingBasket className="w-10 h-10 text-stone-300 mx-auto" />
          <p className="mt-2 text-sm font-semibold text-stone-700">ยังไม่มีสินค้าในตะกร้า</p>
          <p className="text-xs text-stone-400">กดปุ่ม + ที่สินค้าเพื่อใส่ตะกร้า</p>
        </div>
      ) : (
        <div className="p-3 space-y-3">
          <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
            {items.map((it) => (
              <li key={it.key} className="flex gap-2.5 p-2.5">
                {it.product.image ? (
                  <img src={it.product.image} alt="" className="w-16 h-16 rounded-md object-cover shrink-0 bg-stone-100" />
                ) : (
                  <span className="w-16 h-16 rounded-md bg-stone-100 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] leading-snug text-stone-900 line-clamp-2">{it.product.name}</p>
                  <p className="text-[11px] text-stone-500 truncate">{it.ripenessPref}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[#D9480F]">
                      ฿{pricePerKgOf(it.product).toLocaleString()}
                      <span className="text-[10px] font-normal text-stone-500">/กก.</span>
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => removeItem(it.key)}
                        aria-label="ลบออก"
                        className="p-1.5 text-stone-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="inline-flex items-center border border-stone-300 rounded-md overflow-hidden">
                        <button type="button" aria-label="ลดจำนวน" onClick={() => updateQty(it.key, it.qty - 1)} className="w-7 h-7 flex items-center justify-center text-stone-600 hover:bg-stone-100">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center text-xs font-bold border-x border-stone-300 leading-7">{it.qty}</span>
                        <button type="button" aria-label="เพิ่มจำนวน" onClick={() => updateQty(it.key, it.qty + 1)} className="w-7 h-7 flex items-center justify-center text-stone-600 hover:bg-stone-100">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <form id="cart-checkout" onSubmit={handleCheckout} className="space-y-2.5">
            {lineProfile && (
              <p className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                <LineIcon className="w-4 h-4 text-[#06C755] shrink-0" /> เชื่อมต่อบัญชีคุณ {lineProfile.displayName} แล้ว
              </p>
            )}
            <CheckoutAccountGate />

            <p className="text-xs font-bold text-stone-700 pt-1">ที่อยู่จัดส่ง</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input required className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อผู้รับ *" autoComplete="name" />
              <input required type="tel" inputMode="tel" className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="เบอร์โทร * 08X-XXX-XXXX" autoComplete="tel" />
            </div>
            <MapLocationPicker address={address} onAddressChange={(a) => setAddress(a)} />
            <textarea
              required
              rows={2}
              className={`${field} resize-none`}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="ที่อยู่ละเอียด * (หรือกดปักหมุดด้านบน)"
              autoComplete="street-address"
            />
            <select value={shipping} onChange={(e) => setShipping(e.target.value)} className={`${field} truncate`}>
              {shopInfo.shippingMethods.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.price === 0 ? "ฟรี" : `฿${s.price}`} • {s.name}
                </option>
              ))}
            </select>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-1">
              <p className="font-semibold">ยอดจริง = น้ำหนักที่ชั่ง × ราคาต่อกิโล + ค่าส่ง ฿{shippingCost}</p>
              <p className="text-[11px] leading-relaxed">จองไว้ก่อน ยังไม่ต้องโอน — แอดมินชั่งแล้วส่งยอดพร้อม QR ให้ทาง LINE</p>
            </div>
          </form>
        </div>
      )}
    </Sheet>
  );
}
