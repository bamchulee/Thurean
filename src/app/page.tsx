"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, ShieldCheck, Snowflake, Truck } from "lucide-react";
import { shopInfo } from "../data/shop";
import { useBankAccount } from "../hooks/useBankAccount";
import type { Order, Product, Promotion, Round } from "../types/durian";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useLiff } from "../lib/use-liff";
import { CartDrawerModal } from "../components/CartDrawerModal";
import { LineDirectLink } from "../components/LineDirectLink";
import { formatProductStock } from "../lib/stock";
import { ProductCard, ProductCardSkeleton } from "../components/store/ProductCard";
import { ProductSheet, RIPENESS } from "../components/store/ProductSheet";
import { AccountSheet, BottomNav, DesktopFloating, StoreHeader } from "../components/store/StoreChrome";
import { CartBar, CategoryRow, HeroCarousel, RoundMini, SortTabs, type SortKey } from "../components/store/HomeSections";
import { pricePerKgOf } from "../lib/stock";

const SHOP_CACHE_KEY = "winkin_shop_v3";

type ShopPayload = { products?: Product[]; currentRound?: Round | null; promotions?: Promotion[]; lineLiffId?: string };

// ===================== จุดเด่นร้าน (ช่องเล็ก) =====================
const PERKS = [
  { icon: Truck, title: "วิ่งรับตรงจากสวน", desc: "ระยอง-จันทบุรี ไม่ผ่านคนกลาง" },
  { icon: Award, title: "แก่จัด 85%+", desc: "ไม่ตัดอ่อน ไม่ป้ายยาเร่งสุก" },
  { icon: Snowflake, title: "ส่งคุมความเย็น", desc: "ไม่เละ ไม่ช้ำ ไม่คายน้ำ" },
  { icon: ShieldCheck, title: "เคลมได้ 100%", desc: "เนื้อขาว อ่อน หนอน เปลี่ยน/คืนเงิน" },
];

function Perks() {
  return (
    <section id="why-us" className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {PERKS.map(({ icon: Icon, title, desc }) => (
        <div key={title} className="flex items-start gap-2 rounded-lg bg-white border border-stone-200/70 p-2.5">
          <span className="w-8 h-8 rounded-lg bg-emerald-50 text-[#1B4D31] flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-bold text-stone-900 leading-tight">{title}</span>
            <span className="block text-[11px] text-stone-500 leading-snug mt-0.5">{desc}</span>
          </span>
        </div>
      ))}
    </section>
  );
}

// ===================== ท้ายร้าน =====================
function Footer() {
  const bank = useBankAccount();
  return (
    <footer id="contact" className="bg-[#0E2719] text-stone-300 text-xs pb-36 md:pb-0">
      <div className="max-w-6xl mx-auto px-3 py-6 grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <img src={shopInfo.logo} alt="" className="w-9 h-9 rounded-full bg-white object-cover" />
            <div>
              <p className="text-sm font-bold text-white">{shopInfo.name}</p>
              <a href={`tel:${shopInfo.phone.replace(/-/g, "")}`} className="text-[#FFD84D]">
                โทร {shopInfo.phone}
              </a>
            </div>
          </div>
          <p className="text-stone-400 leading-relaxed line-clamp-3">{shopInfo.description}</p>
        </div>
        <div className="space-y-1.5">
          <p className="font-bold text-white">ช่วยเหลือ</p>
          <a href="/tracking" className="block hover:text-white">เช็กออเดอร์ & พัสดุ</a>
          <a href="/claim" className="block hover:text-white">แจ้งเคลมสินค้า</a>
          <p>
            LINE{" "}
            <LineDirectLink prefillText="สวัสดีครับ สอบถามทุเรียนวินคินครับ" className="text-[#FFD84D] underline underline-offset-2">
              {shopInfo.lineOA}
            </LineDirectLink>{" "}
            • ทุกวัน 08:00-21:00
          </p>
        </div>
        <div className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-0.5 min-w-0">
          <p className="font-bold text-[#FFD84D]">บัญชีรับเงินของร้าน</p>
          <p className="text-white">{bank.bank}</p>
          <p className="font-mono text-white text-sm break-all">{bank.number}</p>
          {bank.promptPay && <p className="text-stone-400">พร้อมเพย์ {bank.promptPay}</p>}
          <p className="text-stone-400">{bank.name}</p>
        </div>
      </div>
      <p className="border-t border-white/10 py-3 text-center text-[11px] text-stone-500">© 2026 {shopInfo.name}</p>
    </footer>
  );
}

// ===================== หน้าร้าน =====================
export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [round, setRound] = useState<Round | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [liffId, setLiffId] = useState("");
  const [query, setQuery] = useState("");
  const [variety, setVariety] = useState("all");
  const [sort, setSort] = useState<SortKey>("recommend");
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [ripeness, setRipeness] = useState<string>(RIPENESS[0].value);
  const [openProduct, setOpenProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const { addItem, totalItems } = useCart();
  const { user, loginWithLine, openAuthModal } = useAuth();
  const { profile: lineProfile, getAccessToken } = useLiff(liffId);

  // กลับมาจากหน้าล็อกอิน → เปิดหน้าต่างบัญชี / ล้างพารามิเตอร์
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("setup_address") || params.get("line_login_error")) openAuthModal("line");
    // กดตะกร้าจากหน้าอื่น (/#cart) → เปิดตะกร้าให้เลย
    if (window.location.hash === "#cart") {
      window.history.replaceState({}, "", window.location.pathname + window.location.search);
      queueMicrotask(() => setCartOpen(true));
    }
    if (params.get("login_success")) {
      const next = new URL(window.location.href);
      next.searchParams.delete("login_success");
      window.history.replaceState({}, "", next.pathname + next.search);
    }
  }, [openAuthModal]);

  // เปิดผ่านแอป LINE → ล็อกอินให้อัตโนมัติ
  useEffect(() => {
    if (lineProfile && !user) {
      const token = getAccessToken();
      if (token) loginWithLine({ accessToken: token });
    }
  }, [lineProfile, user, loginWithLine, getAccessToken]);

  const applyShop = useCallback((json: ShopPayload) => {
    if (Array.isArray(json.products)) setProducts(json.products);
    setRound(json.currentRound || null);
    if (Array.isArray(json.promotions)) setPromotions(json.promotions);
    if (json.lineLiffId) setLiffId(json.lineLiffId);
  }, []);

  // โชว์ข้อมูลรอบก่อนจากเครื่องทันที แล้วค่อยอัปเดตจากเซิร์ฟเวอร์ (เปิดหน้าไม่ต้องรอ)
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      try {
        const cached = localStorage.getItem(SHOP_CACHE_KEY);
        if (cached && !cancelled) {
          applyShop(JSON.parse(cached) as ShopPayload);
          setLoaded(true);
        }
      } catch {
        // storage ใช้ไม่ได้ — รอเซิร์ฟเวอร์
      }
    });
    fetch("/api/shop")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json.ok) return;
        const payload: ShopPayload = { products: json.products, currentRound: json.currentRound, promotions: json.promotions, lineLiffId: json.lineLiffId };
        applyShop(payload);
        try {
          localStorage.setItem(SHOP_CACHE_KEY, JSON.stringify(payload));
        } catch {
          // ignore
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [applyShop]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => variety === "all" || p.variety === variety)
      .filter((p) => !q || [p.name, p.variety, p.origin, p.grade, p.badge].some((v) => v && String(v).toLowerCase().includes(q)))
      .sort((a, b) => {
        // ของหมดไว้ท้ายเสมอ
        const out = Number(formatProductStock(a).isOutOfStock) - Number(formatProductStock(b).isOutOfStock);
        if (out) return out;
        if (sort === "priceAsc") return pricePerKgOf(a) - pricePerKgOf(b);
        if (sort === "priceDesc") return pricePerKgOf(b) - pricePerKgOf(a);
        if (sort === "lowStock") return (a.stockQty ?? 9999) - (b.stockQty ?? 9999);
        // แนะนำ: มีป้าย (ขายดี/พรีเมียม) ขึ้นก่อน
        return Number(Boolean(b.badge)) - Number(Boolean(a.badge));
      });
  }, [products, variety, query, sort]);

  const handleOrderCreated = (order: Order) => {
    const qty = order.items.reduce((s, it) => s + it.qty, 0);
    setRound((prev) => (prev ? { ...prev, quotaRemaining: Math.max(0, prev.quotaRemaining - qty) } : prev));
  };

  const openAccount = () => (user ? setAccountOpen(true) : openAuthModal());

  return (
    <main id="top" className="min-h-screen bg-[#F5F1E4] overflow-x-clip">
      <StoreHeader
        cartCount={totalItems}
        onOpenCart={() => setCartOpen(true)}
        query={query}
        onQuery={setQuery}
        onOpenAccount={openAccount}
      />

      <div className="max-w-6xl mx-auto px-2.5 sm:px-4 py-3 space-y-3 pb-6">
        {/* แบนเนอร์ (รอบส่ง / โปรโมชัน / ร้าน) + รายละเอียดรอบ (จอใหญ่) */}
        <section className="grid gap-3 md:grid-cols-[1fr_17rem]">
          <HeroCarousel round={round} promotions={promotions} />
          <div className="hidden md:block">
            <RoundMini round={round} />
          </div>
        </section>

        {/* หมวดพันธุ์ */}
        <CategoryRow products={products} value={variety} onChange={setVariety} />

        {/* ความสุกที่ชอบ — ใช้เป็นค่าตั้งต้นตอนกด + ใส่ตะกร้า */}
        <section id="menu" className="bg-white rounded-2xl border border-stone-200/70 p-2.5 scroll-mt-32">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-stone-700 shrink-0">ชอบแบบไหน</span>
            <div className="grid grid-cols-2 gap-1.5 flex-1 max-w-md">
              {RIPENESS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRipeness(r.value)}
                  className={`flex items-center gap-2 rounded-xl border px-1.5 py-1 text-left transition ${
                    ripeness === r.value ? "border-[#1B4D31] bg-emerald-50 ring-1 ring-[#1B4D31]" : "border-stone-200"
                  }`}
                >
                  <img src={r.img} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-stone-900 leading-tight">{r.label}</span>
                    <span className="block text-[10px] text-stone-500 truncate leading-tight">{r.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* สินค้า */}
        <section aria-label="สินค้ารอบนี้" className="space-y-2">
          <div className="flex items-center gap-2 px-0.5">
            <span className="w-1 h-5 rounded-full bg-[#D9480F]" />
            <h2 className="text-base font-extrabold text-stone-900">ทุเรียนรอบนี้</h2>
          </div>
          <SortTabs value={sort} onChange={setSort} count={loaded ? shown.length : undefined} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
            {!loaded && products.length === 0
              ? Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />)
              : shown.map((p) => (
                  <ProductCard key={p.id} product={p} onOpen={setOpenProduct} onAdd={(prod) => addItem(prod, 1, ripeness)} />
                ))}
          </div>
          {loaded && shown.length === 0 && (
            <p className="text-center text-sm text-stone-500 bg-white border border-stone-200 rounded-2xl py-8 px-4">
              {products.length === 0
                ? `ยังไม่มีสินค้าเปิดจองรอบนี้ — ติดตามรอบถัดไปทาง LINE ${shopInfo.lineOA}`
                : "ไม่พบสินค้าที่ค้นหา"}
            </p>
          )}
        </section>

        <Perks />
      </div>

      <Footer />
      <CartBar count={totalItems} onOpen={() => setCartOpen(true)} />
      <BottomNav cartCount={totalItems} onOpenCart={() => setCartOpen(true)} onOpenAccount={openAccount} />
      <DesktopFloating />

      {openProduct && (
        <ProductSheet
          product={openProduct}
          roundId={round?.id || ""}
          lineProfile={lineProfile}
          initialRipeness={ripeness}
          onAddToCart={(p, q, rip) => addItem(p, q, rip)}
          onSuccess={handleOrderCreated}
          onClose={() => setOpenProduct(null)}
        />
      )}
      {cartOpen && (
        <CartDrawerModal
          roundId={round?.id || ""}
          lineProfile={lineProfile}
          onSuccess={handleOrderCreated}
          onClose={() => setCartOpen(false)}
        />
      )}
      {accountOpen && <AccountSheet onClose={() => setAccountOpen(false)} />}
    </main>
  );
}
