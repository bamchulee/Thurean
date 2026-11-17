"use client";

import { useState } from "react";
import { Check, MapPin, Plus } from "lucide-react";
import type { Product } from "../../types/durian";
import { formatProductStock, pricePerKgOf } from "../../lib/stock";

export const baht = (n: number) => `฿${(n || 0).toLocaleString()}`;

/** การ์ดสินค้าเล็กแบบแอปช้อปปิ้ง: รูปสี่เหลี่ยม ชื่อ 2 บรรทัด ราคา/กก. ปุ่ม + ใส่ตะกร้า */
export function ProductCard({
  product,
  onOpen,
  onAdd,
}: {
  product: Product;
  onOpen: (p: Product) => void;
  onAdd: (p: Product) => void;
}) {
  const [added, setAdded] = useState(false);
  const stock = formatProductStock(product);
  const out = stock.isOutOfStock;
  const closed = product.isActive === 0 || (product.isActive as unknown) === "0" || product.isActive === false;

  const add = () => {
    if (out) return;
    onAdd(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1000);
  };

  return (
    <article className="relative bg-white rounded-lg overflow-hidden border border-stone-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-md hover:border-[#1B4D31]/25 transition">
      <button type="button" onClick={() => onOpen(product)} className="block w-full text-left">
        <div className="relative aspect-square bg-stone-100">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className={`absolute inset-0 w-full h-full object-cover ${out ? "grayscale opacity-70" : ""}`}
            />
          ) : null}
          {product.badge && (
            <span className="absolute top-0 left-0 max-w-[85%] truncate bg-[#1B4D31] text-[#FFD84D] text-[10px] font-bold px-1.5 py-0.5 rounded-br-md">
              {product.badge}
            </span>
          )}
          {out && (
            <span className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/60 text-white text-xs font-bold flex items-center justify-center text-center leading-tight">
              {closed ? "ปิดขาย" : "หมด"}
            </span>
          )}
          {!out && stock.isLowStock && (
            <span className="absolute bottom-0 inset-x-0 bg-rose-600/90 text-white text-[10px] font-semibold text-center py-0.5">
              {stock.summary}
            </span>
          )}
        </div>
        <div className="p-2 pb-2.5">
          <h4 className="text-[13px] leading-[1.35] text-stone-800 line-clamp-2 min-h-[2.7em]">{product.name}</h4>
          <div className="mt-1 flex items-center gap-1 overflow-hidden h-4">
            {product.variety && (
              <span className="shrink-0 text-[10px] leading-4 px-1 rounded border border-[#1B4D31]/30 text-[#1B4D31]">
                {product.variety}
              </span>
            )}
            {product.brix && (
              <span className="shrink-0 text-[10px] leading-4 px-1 rounded border border-amber-400 text-amber-700">{product.brix}</span>
            )}
          </div>
          <div className="mt-1.5 pr-8 flex items-baseline gap-1 min-w-0">
            <span className="text-[#D9480F] font-bold text-base leading-none">{baht(pricePerKgOf(product))}</span>
            <span className="text-[10px] text-stone-500">/กก.</span>
            {(product.marketPrice || 0) > pricePerKgOf(product) ? (
              <span className="text-[10px] text-stone-400 line-through truncate">{baht(product.marketPrice || 0)}</span>
            ) : null}
          </div>
          <p className="mt-1 pr-8 text-[10px] text-stone-500 flex items-center gap-0.5 min-w-0">
            {product.origin ? (
              <>
                <MapPin className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">{product.origin}</span>
              </>
            ) : (
              <span className="truncate">{stock.summary}</span>
            )}
          </p>
        </div>
      </button>
      <button
        type="button"
        onClick={add}
        disabled={out}
        aria-label={`ใส่ ${product.name} ลงตะกร้า`}
        className={`absolute right-1.5 bottom-2 w-7 h-7 rounded-full flex items-center justify-center shadow-sm transition active:scale-90 ${
          out ? "bg-stone-200 text-stone-400" : added ? "bg-emerald-600 text-white" : "bg-[#1B4D31] text-[#FFD84D] hover:bg-[#143B25]"
        }`}
      >
        {added ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
      </button>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-lg overflow-hidden border border-stone-200/70">
      <div className="aspect-square bg-stone-200/70 animate-pulse" />
      <div className="p-2 space-y-1.5">
        <div className="h-3 bg-stone-200/70 rounded animate-pulse" />
        <div className="h-3 w-2/3 bg-stone-200/70 rounded animate-pulse" />
        <div className="h-4 w-1/2 bg-stone-200/70 rounded animate-pulse" />
      </div>
    </div>
  );
}
