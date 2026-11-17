"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2, Minus, Plus, ShieldCheck, ShoppingBasket, Zap } from "lucide-react";
import type { Order, Product } from "../../types/durian";
import { shopInfo } from "../../data/shop";
import { useAuth } from "../../context/AuthContext";
import { CheckoutAccountGate, canCheckout } from "../CheckoutAccountGate";
import { OrderSuccessModal } from "../OrderSuccessModal";
import { formatProductStock, pricePerKgOf } from "../../lib/stock";
import { Sheet } from "./Sheet";
import { baht } from "./ProductCard";

export const RIPENESS = [
  { value: "แบบกรอบ (กรอบนอกนุ่มใน)", label: "แบบกรอบ", sub: "กรอบนอก นุ่มใน", img: "/ripeness/crispy.jpg" },
  { value: "แบบไม่กรอบ (สุกนุ่มหวานมัน)", label: "แบบนุ่ม", sub: "สุกพอดี หวานมัน", img: "/ripeness/creamy.jpg" },
] as const;

export const inputCls =
  "w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:border-[#1B4D31] focus:ring-2 focus:ring-[#1B4D31]/15 focus:outline-none";

type UserLike = { firstName?: string; lastName?: string; displayName?: string; username?: string } | null | undefined;

export function displayName(u: UserLike): string {
  if (!u) return "";
  const full = `${u.firstName || ""} ${u.lastName || ""}`.trim();
  if (full && full !== "ลูกค้า LINE") return full;
  if (u.displayName && !u.displayName.startsWith("line_")) return u.displayName;
  if (u.username && !u.username.startsWith("line_")) return u.username;
  return "";
}

/** ดูรายละเอียดสินค้า → เลือกความสุก/จำนวน → ใส่ตะกร้า หรือ สั่งเลย (กรอกที่อยู่ในแผ่นเดียวกัน) */
export function ProductSheet({
  product,
  roundId,
  lineProfile,
  initialRipeness,
  onAddToCart,
  onSuccess,
  onClose,
}: {
  product: Product;
  roundId: string;
  lineProfile: { userId: string; displayName: string } | null;
  initialRipeness?: string;
  onAddToCart: (product: Product, qty: number, ripenessPref: string) => void;
  onSuccess: (order: Order) => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [step, setStep] = useState<"detail" | "checkout">("detail");
  const [qty, setQty] = useState(1);
  const [ripeness, setRipeness] = useState(initialRipeness || RIPENESS[0].value);
  // ช่องที่ลูกค้ายังไม่แก้ ใช้ข้อมูลสมาชิก (โหลดเสร็จทีหลังก็เติมให้เอง)
  const [nameEdit, setName] = useState<string | null>(null);
  const [phoneEdit, setPhone] = useState<string | null>(null);
  const [addressEdit, setAddress] = useState<string | null>(null);
  const name = nameEdit ?? (displayName(user) || lineProfile?.displayName || "");
  const phone = phoneEdit ?? (user?.phone || "");
  const address = addressEdit ?? (user ? `${user.address || ""} ${user.postalCode || ""}`.trim() : "");
  const [shipping, setShipping] = useState(shopInfo.shippingMethods[0].name);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  const stock = formatProductStock(product);
  const out = stock.isOutOfStock;
  const maxQty = stock.approxUnits && stock.approxUnits > 0 ? stock.approxUnits : 99;
  const pricePerKg = pricePerKgOf(product);
  const shippingCost = shopInfo.shippingMethods.find((s) => s.name === shipping)?.price || 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          ripenessPref: ripeness,
          shippingMethod: shipping,
          roundId,
          items: [{ productId: product.id, qty, ripenessPref: ripeness }],
        }),
      });
      const json = (await res.json()) as { ok: boolean; order?: Order; error?: string };
      if (!res.ok || !json.ok || !json.order) {
        setErrorMsg(json.error || "บันทึกคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่");
      } else {
        setCreatedOrder(json.order);
        onSuccess(json.order);
      }
    } catch {
      setErrorMsg("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  };

  if (createdOrder) return <OrderSuccessModal order={createdOrder} onClose={onClose} />;

  const qtyControl = (
    <div className="inline-flex items-center border border-stone-300 rounded-lg overflow-hidden">
      <button type="button" aria-label="ลดจำนวน" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-9 h-9 flex items-center justify-center text-stone-600 hover:bg-stone-100 disabled:opacity-40" disabled={qty <= 1}>
        <Minus className="w-4 h-4" />
      </button>
      <span className="w-10 text-center text-sm font-bold border-x border-stone-300 leading-9">{qty}</span>
      <button type="button" aria-label="เพิ่มจำนวน" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} className="w-9 h-9 flex items-center justify-center text-stone-600 hover:bg-stone-100 disabled:opacity-40" disabled={qty >= maxQty}>
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );

  if (step === "checkout") {
    return (
      <Sheet
        onClose={onClose}
        title={
          <button type="button" onClick={() => setStep("detail")} className="inline-flex items-center gap-1.5 hover:text-[#1B4D31]">
            <ArrowLeft className="w-4 h-4" /> ที่อยู่จัดส่ง
          </button>
        }
        footer={
          <div className="space-y-2">
            {errorMsg && <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{errorMsg}</p>}
            <button
              type="submit"
              form="quick-order"
              disabled={submitting || !canCheckout(user)}
              className="w-full h-11 rounded-lg bg-[#1B4D31] hover:bg-[#143B25] disabled:opacity-50 text-white text-sm font-bold inline-flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> กำลังส่งออเดอร์…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#FFD84D]" /> ยืนยันจอง ({qty} {product.unit || "ลูก"})
                </>
              )}
            </button>
          </div>
        }
      >
        <form id="quick-order" onSubmit={submit} className="p-4 space-y-3">
          <div className="flex gap-3 items-center p-2 rounded-lg bg-stone-50 border border-stone-200">
            {product.image && <img src={product.image} alt="" className="w-12 h-12 rounded-md object-cover shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-stone-900 truncate">{product.name}</p>
              <p className="text-xs text-stone-500 truncate">
                {qty} {product.unit || "ลูก"} • {RIPENESS.find((r) => r.value === ripeness)?.label || ripeness}
              </p>
            </div>
            <span className="text-sm font-bold text-[#D9480F] shrink-0">{baht(pricePerKg)}/กก.</span>
          </div>

          <CheckoutAccountGate />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label className="block">
              <span className="text-xs font-semibold text-stone-600">ชื่อผู้รับ *</span>
              <input required className={`${inputCls} mt-1`} value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อ-นามสกุล" autoComplete="name" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-stone-600">เบอร์โทร *</span>
              <input required type="tel" inputMode="tel" className={`${inputCls} mt-1`} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08X-XXX-XXXX" autoComplete="tel" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-stone-600">ที่อยู่จัดส่ง *</span>
            <textarea required rows={2} className={`${inputCls} mt-1 resize-none`} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์" autoComplete="street-address" />
          </label>

          <fieldset>
            <legend className="text-xs font-semibold text-stone-600 mb-1">วิธีจัดส่ง</legend>
            <div className="space-y-1.5">
              {shopInfo.shippingMethods.map((s) => (
                <label
                  key={s.name}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer ${shipping === s.name ? "border-[#1B4D31] bg-emerald-50/60" : "border-stone-200"}`}
                >
                  <input type="radio" name="ship" checked={shipping === s.name} onChange={() => setShipping(s.name)} className="accent-[#1B4D31] shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-stone-800 leading-snug">{s.name}</span>
                    <span className="block text-[11px] text-stone-500 truncate">{s.note}</span>
                  </span>
                  <span className="text-xs font-bold text-stone-800 shrink-0">{s.price === 0 ? "ฟรี" : `฿${s.price}`}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-1">
            <p className="font-semibold">
              ยอดจริง = น้ำหนักที่ชั่ง × {baht(pricePerKg)}/กก. + ค่าส่ง ฿{shippingCost}
            </p>
            <p className="text-[11px] leading-relaxed">จองไว้ก่อน ยังไม่ต้องโอน — แอดมินชั่งแล้วส่งยอดพร้อม QR ให้ทาง LINE</p>
          </div>
        </form>
      </Sheet>
    );
  }

  return (
    <Sheet
      onClose={onClose}
      size="lg"
      title="รายละเอียดสินค้า"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            disabled={out}
            onClick={() => {
              onAddToCart(product, qty, ripeness);
              onClose();
            }}
            className="flex-1 h-11 rounded-lg border border-[#1B4D31] text-[#1B4D31] bg-emerald-50/60 hover:bg-emerald-50 disabled:opacity-40 text-sm font-bold inline-flex items-center justify-center gap-1.5"
          >
            <ShoppingBasket className="w-4 h-4" /> ใส่ตะกร้า
          </button>
          <button
            type="button"
            disabled={out}
            onClick={() => setStep("checkout")}
            className="flex-1 h-11 rounded-lg bg-[#1B4D31] hover:bg-[#143B25] disabled:bg-stone-300 text-[#FFD84D] text-sm font-bold inline-flex items-center justify-center gap-1.5"
          >
            <Zap className="w-4 h-4" /> {out ? "สินค้าหมด" : "สั่งเลย"}
          </button>
        </div>
      }
    >
      <div className="sm:flex sm:gap-4 sm:p-4">
        <div className="relative aspect-square max-h-[40dvh] w-full sm:max-h-none sm:w-60 sm:shrink-0 bg-stone-100 sm:rounded-lg overflow-hidden">
          {product.image && <img src={product.image} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />}
          {product.badge && (
            <span className="absolute top-2 left-2 bg-[#1B4D31] text-[#FFD84D] text-[11px] font-bold px-2 py-0.5 rounded">{product.badge}</span>
          )}
        </div>
        <div className="p-4 sm:p-0 flex-1 min-w-0 space-y-3">
          <div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-2xl font-bold text-[#D9480F]">{baht(pricePerKg)}</span>
              <span className="text-xs text-stone-500">/กก.</span>
              {(product.marketPrice || 0) > pricePerKg ? <span className="text-xs text-stone-400 line-through">{baht(product.marketPrice || 0)}</span> : null}
            </div>
            <h3 className="mt-1 text-base font-semibold text-stone-900 leading-snug">{product.name}</h3>
            <p className={`mt-0.5 text-xs font-medium ${out ? "text-rose-600" : stock.isLowStock ? "text-rose-600" : "text-stone-500"}`}>{stock.summary}</p>
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            {[
              ["พันธุ์", product.variety],
              ["แหล่งปลูก", product.origin],
              ["ขนาดผล", product.weight],
              ["ความหวาน", product.brix],
              ["เกรด", product.grade],
              ["เนื้อ", product.texture || product.specs?.texture],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-stone-400">{k}</dt>
                  <dd className="font-medium text-stone-800 truncate">{v}</dd>
                </div>
              ))}
          </dl>

          {product.description && <p className="text-xs text-stone-600 leading-relaxed">{product.description}</p>}

          <div>
            <p className="text-xs font-semibold text-stone-700 mb-1.5">ความสุกที่ชอบ</p>
            <div className="grid grid-cols-2 gap-2">
              {RIPENESS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRipeness(r.value)}
                  className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition ${
                    ripeness === r.value ? "border-[#1B4D31] bg-emerald-50 ring-1 ring-[#1B4D31]" : "border-stone-200 hover:border-stone-300"
                  }`}
                >
                  <img src={r.img} alt="" className="w-9 h-9 rounded-md object-cover shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-stone-900">{r.label}</span>
                    <span className="block text-[10px] text-stone-500 truncate">{r.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-700">จำนวน ({product.unit || "ลูก"})</span>
            {qtyControl}
          </div>

          <p className="flex items-start gap-1.5 text-[11px] text-emerald-800 bg-emerald-50 rounded-lg p-2">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px" />
            คิดเงินตามน้ำหนักจริงหลังชั่ง • ผ่าแล้วไม่ตรงที่เลือก เคลมได้ 100%
          </p>
        </div>
      </div>
    </Sheet>
  );
}
