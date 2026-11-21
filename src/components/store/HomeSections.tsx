"use client";

// ส่วนประกอบหน้าร้าน: แบนเนอร์เลื่อนอัตโนมัติ · หมวดพันธุ์ (ไอคอนกลม) · แถบเรียงสินค้า · แถบตะกร้าลอย
import { useEffect, useState } from "react";
import { Calendar, ChevronRight, Clock, ShoppingBasket } from "lucide-react";
import type { Product, Promotion, Round } from "../../types/durian";
import { shopInfo } from "../../data/shop";
import { DurianIcon } from "../Icons";

// ------------------------------------------------------------
// แบนเนอร์
// ------------------------------------------------------------
type Slide = { key: string; tag: string; title: string; text: string; img: string; tone: string; extra?: React.ReactNode };

/** เวลาที่เหลือก่อนปิดรับจอง (อ่านได้เฉพาะวันที่ที่แปลงได้) */
export function timeLeft(closeDate?: string): string | null {
  if (!closeDate) return null;
  const t = Date.parse(closeDate);
  if (!Number.isFinite(t)) return null;
  const ms = t - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  return h >= 48 ? `ปิดรับใน ${Math.floor(h / 24)} วัน` : h >= 1 ? `ปิดรับใน ${h} ชม.` : "ใกล้ปิดรับแล้ว";
}

export function HeroCarousel({ round, promotions }: { round: Round | null; promotions: Promotion[] }) {
  const slides: Slide[] = [];
  if (round) {
    const used = round.totalQuota ? Math.min(100, Math.max(0, ((round.totalQuota - round.quotaRemaining) / round.totalQuota) * 100)) : 0;
    const left = timeLeft(round.closeDate);
    slides.push({
      key: "round",
      tag: "เปิดจองรอบนี้",
      title: round.name,
      text: [round.harvestDate && `รับจากสวน ${round.harvestDate}`, round.deliveryDate && `ส่งถึงบ้าน ${round.deliveryDate}`].filter(Boolean).join(" · "),
      img: "/ripeness/crispy.jpg",
      tone: "from-[#11301F] via-[#1B4D31] to-[#2F7A4D]",
      extra: (
        <div className="mt-2 max-w-[15rem]">
          <div className="flex items-center justify-between text-[10px] text-emerald-100">
            <span>เหลือ {round.quotaRemaining} ลูก</span>
            {left && (
              <span className="inline-flex items-center gap-0.5 text-[#FFD84D] font-bold">
                <Clock className="w-3 h-3" /> {left}
              </span>
            )}
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full rounded-full bg-[#FFD84D]" style={{ width: `${used}%` }} />
          </div>
        </div>
      ),
    });
  }
  promotions.forEach((p, i) =>
    slides.push({
      key: `promo-${p.id}`,
      tag: p.badge || "โปรโมชัน",
      title: p.title,
      text: [p.discountText, p.conditionText].filter(Boolean).join(" · "),
      img: i % 2 ? "/ripeness/creamy.jpg" : "/ripeness/soft.jpg",
      tone: "from-[#7C2D12] via-[#B45309] to-[#D97706]",
      extra: p.promoCode ? <span className="mt-2 self-start inline-block rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-extrabold tracking-wider text-[#7C2D12]">โค้ด {p.promoCode}</span> : undefined,
    })
  );
  slides.push({
    key: "brand",
    tag: "ทุเรียนวินคิน",
    title: "แก่จัด คัดพูทอง ส่งตรงถึงบ้าน",
    text: "จองก่อน ชั่งน้ำหนักจริงแล้วค่อยโอน · เคลมได้ภายใน 24 ชม.",
    img: "/ripeness/creamy.jpg",
    tone: "from-[#11301F] via-[#1B4D31] to-[#24603D]",
  });

  const [i, setI] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);
  const cur = slides[i % slides.length];

  return (
    <section aria-label="ประกาศของร้าน" className="relative">
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${cur.tone} text-white min-h-[148px] md:min-h-[200px] flex`}>
        <div className="absolute inset-0 thorn-pattern opacity-40 pointer-events-none" />
        <img src={cur.img} alt="" className="absolute right-0 top-0 h-full w-[44%] object-cover [mask-image:linear-gradient(to_right,transparent,black_45%)]" />
        <div className="relative z-10 p-4 md:p-6 pr-[38%] flex flex-col justify-center">
          <span className="self-start rounded-full bg-[#FFD84D] text-[#11301F] text-[10px] md:text-xs font-extrabold px-2 py-0.5">{cur.tag}</span>
          <h2 className="mt-1.5 text-lg md:text-3xl font-extrabold leading-tight">{cur.title}</h2>
          {cur.text && <p className="mt-1 text-[11px] md:text-sm text-emerald-50/90 leading-snug line-clamp-2">{cur.text}</p>}
          {cur.extra}
        </div>
      </div>
      {slides.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {slides.map((s, n) => (
            <button
              key={s.key}
              type="button"
              aria-label={`แบนเนอร์ ${n + 1}`}
              onClick={() => setI(n)}
              className={`h-1.5 rounded-full transition-all ${n === i % slides.length ? "w-5 bg-[#FFD84D]" : "w-1.5 bg-white/60"}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------
// หมวดพันธุ์: ไอคอนกลม + ชื่อ (เลื่อนแนวนอน)
// ------------------------------------------------------------
export function CategoryRow({
  products,
  value,
  onChange,
}: {
  products: Product[];
  value: string;
  onChange: (v: string) => void;
}) {
  const varieties = [...new Set(products.map((p) => p.variety).filter((v): v is string => Boolean(v)))];
  if (varieties.length < 2) return null;
  const pic = (v: string) => products.find((p) => p.variety === v && p.image)?.image;
  const items = [{ id: "all", label: "ทั้งหมด", img: undefined as string | undefined }, ...varieties.map((v) => ({ id: v, label: v, img: pic(v) }))];
  return (
    <section aria-label="หมวดพันธุ์" className="bg-white rounded-2xl border border-stone-200/70 p-3">
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1">
        {items.map((it) => {
          const on = value === it.id;
          return (
            <button key={it.id} type="button" onClick={() => onChange(it.id)} className="shrink-0 w-16 flex flex-col items-center gap-1">
              <span
                className={`w-14 h-14 rounded-full overflow-hidden flex items-center justify-center border-2 transition ${
                  on ? "border-[#1B4D31] ring-2 ring-[#FFD84D]" : "border-stone-200"
                } ${it.img ? "bg-stone-100" : "bg-emerald-50"}`}
              >
                {it.img ? <img src={it.img} alt="" className="w-full h-full object-cover" /> : <DurianIcon className="w-7 h-7 text-[#1B4D31]" />}
              </span>
              <span className={`text-[11px] leading-tight text-center line-clamp-2 ${on ? "font-bold text-[#1B4D31]" : "text-stone-600"}`}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ------------------------------------------------------------
// เรียงสินค้า
// ------------------------------------------------------------
export type SortKey = "recommend" | "priceAsc" | "priceDesc" | "lowStock";
const SORTS: { id: SortKey; label: string }[] = [
  { id: "recommend", label: "แนะนำ" },
  { id: "priceAsc", label: "ราคา ↑" },
  { id: "priceDesc", label: "ราคา ↓" },
  { id: "lowStock", label: "ใกล้หมด" },
];

export function SortTabs({ value, onChange, count }: { value: SortKey; onChange: (v: SortKey) => void; count?: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 md:flex-none md:w-[30rem] bg-white rounded-xl border border-stone-200/70 p-1 overflow-x-auto no-scrollbar">
        {SORTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={`flex-1 shrink-0 px-3 h-8 rounded-lg text-xs font-bold whitespace-nowrap transition ${
              value === s.id ? "bg-[#1B4D31] text-[#FFD84D]" : "text-stone-600 hover:bg-stone-50"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {count !== undefined && <span className="text-[11px] text-stone-500 shrink-0 md:ml-auto">{count} รายการ</span>}
    </div>
  );
}

// ------------------------------------------------------------
// แถบตะกร้าลอย (มือถือ) — เหนือแถบเมนูล่าง เมื่อมีของในตะกร้า
// ------------------------------------------------------------
export function CartBar({ count, onOpen }: { count: number; onOpen: () => void }) {
  if (count <= 0) return null;
  return (
    <div className="md:hidden fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 px-3 pb-2">
      <button
        type="button"
        onClick={onOpen}
        className="sheet-in w-full h-12 rounded-2xl bg-[#1B4D31] text-white shadow-lg flex items-center gap-3 px-4"
      >
        <span className="relative">
          <ShoppingBasket className="w-5 h-5 text-[#FFD84D]" />
          <span className="absolute -top-2 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FFD84D] text-[#11301F] text-[10px] font-extrabold leading-[18px] text-center">
            {count}
          </span>
        </span>
        <span className="flex-1 text-left text-sm font-bold">ดูตะกร้า · จองเลย</span>
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

// ------------------------------------------------------------
// แถบรอบส่งย่อ (จอใหญ่ใช้คู่แบนเนอร์)
// ------------------------------------------------------------
export function RoundMini({ round }: { round: Round | null }) {
  if (!round) {
    return (
      <div className="rounded-2xl bg-white border border-stone-200/70 p-4 h-full flex flex-col justify-center">
        <p className="text-sm font-extrabold text-stone-900">ยังไม่เปิดรอบใหม่</p>
        <p className="text-xs text-stone-500 mt-1">ติดตามรอบถัดไปทาง LINE {shopInfo.lineOA}</p>
      </div>
    );
  }
  const left = timeLeft(round.closeDate);
  return (
    <div className="rounded-2xl bg-white border border-stone-200/70 p-4 h-full flex flex-col justify-center gap-1.5">
      <p className="flex items-center gap-1.5 text-sm font-extrabold text-[#1B4D31]">
        <Calendar className="w-4 h-4" /> {round.name}
      </p>
      {round.harvestDate && <p className="text-xs text-stone-600">รับจากสวน <b>{round.harvestDate}</b></p>}
      {round.deliveryDate && <p className="text-xs text-stone-600">ส่งถึงบ้าน <b>{round.deliveryDate}</b></p>}
      <p className="text-xs text-stone-600">เหลือ <b className="text-[#D9480F]">{round.quotaRemaining}</b> ลูก{left ? ` · ${left}` : ""}</p>
    </div>
  );
}
