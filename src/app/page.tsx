"use client";

import { useEffect, useState } from "react";
import {
  Award,
  Calendar,
  Check,
  CheckCircle2,
  Flame,
  MapPin,
  Menu,
  Minus,
  Package,
  Phone,
  Plus,
  Scale,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  Snowflake,
  Sparkles,
  Truck,
  X,
  Zap,
} from "lucide-react";
import {
  products as defaultProducts,
  currentRound as defaultRound,
  shopInfo,
} from "../data/mock";
import type { Order, Product, Round } from "../types/durian";
import { useCart } from "../context/CartContext";
import { useLiff } from "../lib/use-liff";
import { OrderSuccessModal } from "../components/OrderSuccessModal";
import { CartDrawerModal } from "../components/CartDrawerModal";
import { DurianIcon, LineIcon } from "../components/Icons";
import { LineDirectLink } from "../components/LineDirectLink";
import { formatProductStock } from "../lib/stock";

// ===================== NAVBAR =====================
function Navbar({
  totalCartItems,
  onOpenCart,
}: {
  totalCartItems: number;
  onOpenCart: () => void;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Top Announcement Bar */}
      <div className="bg-[#FFD84D] text-[#11301F] text-xs font-medium py-2 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Truck className="w-3.5 h-3.5 text-[#1B4D31] shrink-0" />
            <span className="truncate">
              <strong className="font-extrabold">
                เปิดจองรอบพิเศษ:
              </strong>{" "}
              คัดสดจากสวนระยอง-จันทบุรี แก่จัด 85%+ การันตีเคลม 100%
            </span>
          </div>
          <a
            href={`tel:${shopInfo.phone.replace(/-/g, "")}`}
            className="hidden sm:inline-flex items-center gap-1.5 bg-[#11301F] hover:bg-[#1B4D31] text-[#FFD84D] px-3 py-1 rounded-full font-semibold text-xs transition shrink-0"
          >
            <Phone className="w-3 h-3" />
            <span className="font-mono">{shopInfo.phone}</span>
          </a>
        </div>
      </div>

      {/* Main Navbar */}
      <header className="bg-[#FFFBEA]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="absolute top-full inset-x-0 awning pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <a href="#" className="flex items-center gap-3 group">
            <img
              src={shopInfo.logo}
              alt={shopInfo.name}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-stone-200 shadow-xs object-cover bg-white group-hover:scale-105 transition-transform"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#1B4D31] tracking-tight leading-tight">
                  {shopInfo.name}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 bg-emerald-50 text-[#1B4D31] border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3 text-emerald-700" />
                  คัดเกรดสวนแท้
                </span>
              </div>
              <p className="text-xs text-stone-500 font-medium flex items-center gap-1.5 mt-0.5">
                <Truck className="w-3.5 h-3.5 text-amber-600" />
                <span>วิ่งส่งตรงจากสวน</span>
                <span className="text-stone-300">•</span>
                <span className="font-mono text-stone-700 font-semibold">
                  {shopInfo.phone}
                </span>
              </p>
            </div>
          </a>

          {/* Desktop Menu */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-stone-700">
            <a href="#menu" className="hover:text-[#1B4D31] transition">
              รายการทุเรียน
            </a>
            <a href="#ripeness" className="hover:text-[#1B4D31] transition">
              ระดับความสุก
            </a>
            <a href="#why-us" className="hover:text-[#1B4D31] transition">
              มาตรฐานร้าน
            </a>
            <a
              href="/tracking"
              className="hover:text-[#1B4D31] transition flex items-center gap-1.5"
            >
              <Package className="w-4 h-4 text-stone-400" />
              <span>เช็กพัสดุ</span>
            </a>
            <a
              href="/claim"
              className="text-amber-700 hover:text-amber-800 transition font-bold flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>แจ้งเคลมสินค้า</span>
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenCart}
              className="relative px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs sm:text-sm transition flex items-center gap-2 border border-stone-200"
            >
              <ShoppingBasket className="w-4 h-4 text-[#1B4D31]" />
              <span className="hidden sm:inline">ตะกร้า</span>
              {totalCartItems > 0 && (
                <span className="bg-amber-500 text-stone-950 text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {totalCartItems}
                </span>
              )}
            </button>
            <LineDirectLink
              prefillText="สวัสดีครับ สนใจสั่งซื้อทุเรียนวินคินรอบนี้ครับ"
              className="hidden sm:flex px-4 py-2 rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-sm transition shadow-xs items-center gap-2"
            >
              <LineIcon className="w-4 h-4" />
              <span>สั่งผ่าน LINE</span>
            </LineDirectLink>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden text-stone-700 p-2 rounded-lg hover:bg-stone-100 transition"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#11301F] text-white px-5 py-4 space-y-2.5 font-semibold text-sm border-t border-white/10">
            <a
              href="#menu"
              className="flex items-center gap-2.5 py-2 border-b border-white/10"
              onClick={() => setMobileMenuOpen(false)}
            >
              <ShoppingBasket className="w-4 h-4 text-amber-400" />
              <span>รายการทุเรียนรอบนี้</span>
            </a>
            <a
              href="#ripeness"
              className="flex items-center gap-2.5 py-2 border-b border-white/10"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>เลือกระดับความสุก</span>
            </a>
            <a
              href="/tracking"
              className="flex items-center gap-2.5 py-2 border-b border-white/10"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Package className="w-4 h-4 text-amber-400" />
              <span>ตรวจสอบสถานะจัดส่ง</span>
            </a>
            <a
              href="/claim"
              className="flex items-center gap-2.5 py-2 text-amber-300 border-b border-white/10"
              onClick={() => setMobileMenuOpen(false)}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>ศูนย์แจ้งเคลม 100%</span>
            </a>
            <a
              href="/admin"
              className="flex items-center gap-2.5 py-2 text-emerald-300"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Settings className="w-4 h-4" />
              <span>ระบบหลังบ้าน (Admin)</span>
            </a>
            <a
              href={`tel:${shopInfo.phone.replace(/-/g, "")}`}
              className="flex items-center justify-center gap-2 bg-amber-500 text-stone-950 py-3 rounded-xl font-bold mt-2 text-sm"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Phone className="w-4 h-4" />
              <span>โทรสั่งซื้อทันที {shopInfo.phone}</span>
            </a>
            <LineDirectLink
              prefillText="สวัสดีครับ สนใจสั่งซื้อทุเรียนวินคินรอบนี้ครับ"
              onAfterClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 bg-[#06C755] text-white py-3 rounded-xl font-bold text-sm"
            >
              <LineIcon className="w-4 h-4" />
              <span>แชทสั่งทาง LINE ทันที</span>
            </LineDirectLink>
          </div>
        )}
      </header>
    </>
  );
}

// ===================== HERO SECTION =====================
function HeroBanner({ round }: { round: Round }) {
  const progressPct = Math.min(
    100,
    Math.max(
      0,
      ((round.totalQuota - round.quotaRemaining) / (round.totalQuota || 1)) * 100
    )
  );

  return (
    <section className="relative bg-gradient-to-br from-[#11301F] via-[#1B4D31] to-[#143B25] text-white overflow-hidden pt-16 pb-14 sm:pt-20 sm:pb-16">
      <div className="absolute inset-0 thorn-pattern pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-amber-400/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Text */}
          <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-xs border border-white/15 text-amber-300 px-3.5 py-1.5 rounded-full font-semibold text-xs">
              <Truck className="w-3.5 h-3.5" />
              <span>รถกระบะวิ่งรับตรงจากสวนระยอง - จันทบุรี</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-extrabold text-white leading-[1.18] tracking-tight">
              ทุเรียนแก่จัด คัดพูทอง <br />
              <span className="text-[#FFD84D]">
                หวานมัน สดใหม่ ส่งตรงถึงบ้าน
              </span>
            </h2>

            <p className="text-emerald-100/90 text-sm sm:text-base leading-relaxed max-w-xl mx-auto lg:mx-0 font-normal">
              หมดปัญหาทุเรียนอ่อนหรือเนื้อขาว ที่{" "}
              <strong className="text-white">{shopInfo.name}</strong>{" "}
              เราคัดเฉพาะผลแก่จัด 85%+ ไม่ป้ายยาเร่งสุก
              พร้อมระบบรับประกันคุณภาพ เคลมฟรี 100% ทุกลูก
            </p>

            {/* Delivery Round Alert Box */}
            <div className="bg-black/25 backdrop-blur-md border border-white/15 rounded-2xl p-4 sm:p-5 max-w-lg mx-auto lg:mx-0 text-left">
              <div className="flex items-center justify-between gap-2 text-xs sm:text-sm font-bold text-amber-300 mb-2">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>{round.name}</span>
                </span>
                <span className="bg-amber-500 text-stone-950 px-2.5 py-0.5 rounded-full font-extrabold text-xs shrink-0">
                  เหลือ {round.quotaRemaining} ลูก
                </span>
              </div>

              {/* Subtle progress bar */}
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mb-2.5">
                <div
                  className="bg-amber-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <p className="text-xs text-stone-200 mb-2.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                <span>{round.truckRoute}</span>
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-200 border-t border-white/10 pt-2.5">
                <span>
                  วันวิ่งรับของ: <strong className="text-white">{round.harvestDate}</strong>
                </span>
                <span>
                  รอบส่งถึงบ้าน: <strong className="text-white">{round.deliveryDate}</strong>
                </span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-1">
              <a
                href="#menu"
                className="px-7 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm sm:text-base transition shadow-lg inline-flex items-center justify-center gap-2"
              >
                <ShoppingBasket className="w-4 h-4" />
                <span>ดูรายการทุเรียน &amp; สั่งซื้อ</span>
              </a>
              <LineDirectLink
                prefillText="สวัสดีครับ สอบถาม / สั่งซื้อทุเรียนวินคินครับ"
                className="px-7 py-3.5 rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-sm sm:text-base transition shadow-lg inline-flex items-center justify-center gap-2"
              >
                <LineIcon className="w-5 h-5" />
                <span>สั่งทาง LINE แอดมินตอบไว</span>
              </LineDirectLink>
            </div>
          </div>

          {/* Right Durian Image */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md">
              <div className="pod-frame overflow-hidden border-[6px] border-[#FFD84D] shadow-2xl bg-black ring-8 ring-[#FFD84D]/15">
                <img
                  src="https://images.unsplash.com/photo-1519544442-93857b48665e?auto=format&fit=crop&w=900&q=85"
                  alt="ทุเรียนวินคิน หมอนทองเนื้อทอง"
                  className="w-full h-80 sm:h-96 object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>

              {/* Clean Quality Badge */}
              <div className="absolute -bottom-4 left-4 bg-white text-stone-900 px-4 py-3 rounded-2xl shadow-xl border border-stone-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#1B4D31] flex items-center justify-center border border-emerald-200 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-extrabold text-xs text-stone-900">
                    การันตีคุณภาพเนื้อ 100%
                  </p>
                  <p className="text-[11px] text-stone-500">
                    ไม่อ่อน ไม่เละ เคลมเปลี่ยนฟรี
                  </p>
                </div>
              </div>

              {/* Top Sweetness Chip */}
              <div className="absolute top-2 right-0 price-tag rotate-3 px-3.5 py-1.5 font-semibold text-xs flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5" />
                <span>ความหวานมาตรฐาน 34° Brix</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================== LEVEL BAR HELPER =====================
function RatingBar({ score, label }: { score: number; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-stone-500 font-medium">{label}</span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={`w-4 h-1.5 rounded-full ${
              n <= score ? "bg-amber-500" : "bg-stone-200"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ===================== RIPENESS GUIDE =====================
function RipenessGuide() {
  const levels = [
    {
      badge: "ขายดีอันดับ 1",
      badgeStyle: "bg-amber-50 text-amber-800 border-amber-200",
      icon: Flame,
      name: "1. กรอบนอก นุ่มใน (ไก่ฉีก)",
      desc: "เคี้ยวด้านนอกมีความกรอบนิด ๆ ด้านในเนื้อนุ่มเนียน กลิ่นหอมละมุน ไม่หวานเลี่ยน ทานเพลิน",
      sweetness: 4,
      creaminess: 4,
    },
    {
      badge: "สายหวานมัน",
      badgeStyle: "bg-emerald-50 text-emerald-800 border-emerald-200",
      icon: Sparkles,
      name: "2. สุกพอดีกิน (เนื้อเนียนครีม)",
      desc: "เนื้อสีเหลืองทองเข้ม สัมผัสเนียนนุ่มเหมือนคัสตาร์ด หวานมันจัดเต็ม กลิ่นหอมฟุ้งติดปาก",
      sweetness: 5,
      creaminess: 5,
    },
    {
      badge: "หวานฉ่ำละมุน",
      badgeStyle: "bg-stone-100 text-stone-700 border-stone-200",
      icon: Award,
      name: "3. สุกนิ่ม (เนื้อปลาร้าอ่อนๆ)",
      desc: "เนื้อสุกงอมธรรมชาติ นุ่มเยิ้มละลายในปาก รสหวานจัดลึก เหมาะสำหรับคนชอบทุเรียนสุกฉ่ำ",
      sweetness: 5,
      creaminess: 3,
    },
  ];

  return (
    <section id="ripeness" className="relative py-14 bg-[#F8E9B0] border-b border-amber-200">
      <div className="absolute top-0 inset-x-0 thorn-edge" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-xl mx-auto mb-10">
          <span className="inline-flex items-center gap-1.5 bg-white text-[#1B4D31] border border-amber-300 text-xs font-bold px-3 py-1 rounded-full">
            <DurianIcon className="w-3.5 h-3.5 text-amber-600" />
            <span>เลือกเนื้อทุเรียนที่ใช่</span>
          </span>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-stone-900 mt-3 mb-2">
            ชอบเนื้อแบบไหน วินคินจัดให้ตรงใจคุณ
          </h3>
          <p className="text-sm text-stone-600">
            ระบุระดับความสุกในขั้นตอนสั่งซื้อ ทีมงานจะคัดพูตามความชอบของคุณโดยเฉพาะ
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {levels.map((lvl, idx) => {
            const Icon = lvl.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl p-6 shadow-xs border border-amber-200 border-t-4 border-t-amber-400 hover:border-emerald-700/30 hover:border-t-amber-500 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-3.5">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${lvl.badgeStyle}`}
                    >
                      {lvl.badge}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-center text-[#1B4D31]">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <h4 className="text-base font-extrabold text-stone-900 mb-2">
                    {lvl.name}
                  </h4>
                  <p className="text-xs text-stone-600 leading-relaxed mb-4">
                    {lvl.desc}
                  </p>
                </div>

                <div className="bg-stone-50 rounded-xl p-3 space-y-2 border border-stone-100">
                  <RatingBar label="ความหวาน" score={lvl.sweetness} />
                  <RatingBar label="ความมันครีม" score={lvl.creaminess} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ===================== PRODUCT CARD =====================
function ProductCard({
  product,
  onOrder,
  onAddToCart,
}: {
  product: Product;
  onOrder: (p: Product) => void;
  onAddToCart: (p: Product) => void;
}) {
  const [justAdded, setJustAdded] = useState(false);

  const handleAdd = () => {
    onAddToCart(product);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <div className="bg-white rounded-2xl overflow-hidden border-2 border-[#1B4D31]/15 shadow-xs durian-card flex flex-col justify-between">
      <div>
        {/* Real Fruit Photo */}
        <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
          />
          {product.badge && (
            <span className="absolute top-3 left-3 bg-[#1B4D31] text-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-sm border border-white/15 inline-flex items-center gap-1">
              <Flame className="w-3 h-3" />
              <span>{product.badge}</span>
            </span>
          )}
          <span className="absolute bottom-3 left-3 bg-black/70 text-white text-[11px] font-medium px-2.5 py-1 rounded-lg backdrop-blur-xs inline-flex items-center gap-1">
            <MapPin className="w-3 h-3 text-amber-400" />
            <span>{product.origin}</span>
          </span>
        </div>

        {/* Content */}
        <div className="p-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500">
            <span>พันธุ์ {product.variety}</span>
            <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md font-mono text-[11px]">
              {product.brix}
            </span>
          </div>

          <h4 className="font-extrabold text-base text-stone-900 leading-snug">
            {product.name}
          </h4>

          <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
            {product.description}
          </p>

          <div className="bg-stone-50 rounded-xl p-3 text-xs text-stone-700 space-y-1.5 border border-stone-100">
            <div className="flex justify-between items-center">
              <span className="text-stone-400 inline-flex items-center gap-1">
                <Scale className="w-3 h-3" />
                <span>ขนาดผล</span>
              </span>
              <span className="font-semibold text-stone-800">{product.weight}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-stone-400 inline-flex items-center gap-1">
                <DurianIcon className="w-3 h-3" />
                <span>เนื้อสัมผัส</span>
              </span>
              <span className="font-semibold text-[#1B4D31]">{product.specs.texture}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-stone-400 inline-flex items-center gap-1">
                <Package className="w-3 h-3" />
                <span>สต็อกคงเหลือ</span>
              </span>
              <span className="font-semibold text-amber-800">
                {formatProductStock(product).summary}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Price & Buttons */}
      <div className="p-5 pt-0">
        <div className="pt-3.5 border-t border-stone-100 flex items-center justify-between gap-2">
          <div>
            {product.marketPrice && (
              <span className="text-xs text-stone-400 line-through block font-mono">
                ฿{product.marketPrice.toLocaleString()}
              </span>
            )}
            <div className="price-tag inline-flex items-baseline px-2.5 py-0.5">
              <span className="text-2xl font-semibold">
                ฿{product.price.toLocaleString()}
              </span>
              <span className="text-xs font-medium ml-1">/{product.unit}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!product.isAvailable}
              onClick={handleAdd}
              className={`px-3 py-2.5 rounded-xl font-bold text-xs transition border inline-flex items-center gap-1 ${
                product.isAvailable
                  ? justAdded
                    ? "bg-[#1B4D31] border-[#1B4D31] text-white"
                    : "bg-white border-stone-300 text-stone-700 hover:border-[#1B4D31] hover:text-[#1B4D31] active:scale-95"
                  : "bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed"
              }`}
            >
              {justAdded ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>เพิ่มแล้ว</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>ตะกร้า</span>
                </>
              )}
            </button>
            <button
              type="button"
              disabled={!product.isAvailable}
              onClick={() => onOrder(product)}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition inline-flex items-center gap-1 ${
                product.isAvailable
                  ? "bg-[#1B4D31] hover:bg-[#143B25] text-[#FFD84D] active:scale-95"
                  : "bg-stone-200 text-stone-500 cursor-not-allowed"
              }`}
            >
              {product.isAvailable ? (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>สั่งเลย</span>
                </>
              ) : (
                <span>หมด</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== PRODUCT MENU =====================
function ProductMenu({
  products,
  onOrder,
  onAddToCart,
}: {
  products: Product[];
  onOrder: (p: Product) => void;
  onAddToCart: (p: Product) => void;
}) {
  const [filter, setFilter] = useState("all");
  const varieties = ["all", ...new Set(products.map((p) => p.variety))];

  const filtered =
    filter === "all" ? products : products.filter((p) => p.variety === filter);

  return (
    <section id="menu" className="py-16 max-w-7xl mx-auto px-4 sm:px-6">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <span className="inline-flex items-center gap-1.5 bg-amber-100 text-[#1B4D31] border border-amber-300 text-xs font-bold px-3 py-1 rounded-full">
          <DurianIcon className="w-3.5 h-3.5 text-amber-600" />
          <span>ทุเรียนตัดสดรอบนี้</span>
        </span>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-stone-900 mt-3 mb-2">
          เมนูทุเรียนคัดสดพร้อมส่งรอบนี้
        </h3>
        <p className="text-sm text-stone-600">
          คัดพูทองเน้น ๆ ส่งตรงจากสวนระยองและจันทบุรี มีทั้งแบบชั่งทั้งลูกและแกะเนื้อพร้อมทาน
        </p>

        {/* Filter Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {varieties.map((v) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition ${
                filter === v
                  ? "bg-[#1B4D31] text-[#FFD84D] shadow-sm"
                  : "bg-white text-stone-700 border border-amber-300 hover:bg-amber-50"
              }`}
            >
              {v === "all" ? "ทั้งหมดทุกลูก" : `พันธุ์${v}`}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
        {filtered.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            onOrder={onOrder}
            onAddToCart={onAddToCart}
          />
        ))}
      </div>
    </section>
  );
}

// ===================== WHY CHOOSE US =====================
function WhyUs() {
  const points = [
    {
      icon: Truck,
      title: "รถกระบะวิ่งรับตรงจากสวน",
      desc: "ทีมงานทุเรียนวินคินวิ่งรถไปคัดเองที่หน้าสวนระยองและจันทบุรี ไม่ผ่านคนกลางหลายต่อ ได้ทุเรียนสดใหม่ที่สุด",
    },
    {
      icon: Award,
      title: "แก่จัด 85%+ ไม่ป้ายยา",
      desc: "ไม่ตัดทุเรียนอ่อนเด็ดขาด ไม่ใช้น้ำยาเร่งสุก สุกหวานมันตามธรรมชาติ กลิ่นหอมละมุน เม็ดลีบ",
    },
    {
      icon: Snowflake,
      title: "จัดส่งด่วนคุมอุณหภูมิ",
      desc: "ส่งด้วยรถห้องเย็นหรือกล่องล็อกขั้วเจาะรูระบายอากาศ ป้องกันเนื้อเละ ช้ำ หรือคายน้ำระหว่างทาง",
    },
    {
      icon: ShieldCheck,
      title: "รับประกันเคลม 100%",
      desc: "เจอปัญหาเนื้อขาว อ่อน หนอน ถ่ายรูปส่งมาทาง LINE หรือหน้าเว็บ เคลมเปลี่ยนลูกใหม่หรือคืนเงินทันที",
    },
  ];

  return (
    <section id="why-us" className="relative py-16 bg-[#133824] text-white">
      <div className="absolute inset-0 thorn-pattern pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 bg-white/10 text-amber-300 border border-white/15 text-xs font-bold px-3 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>มาตรฐานชาวสวน</span>
          </span>
          <h3 className="text-2xl sm:text-3xl font-extrabold mt-3 mb-2">
            ทำไมต้องสั่งกับ &quot;ทุเรียนวินคิน&quot;
          </h3>
          <p className="text-sm text-emerald-100/80">
            เราคัดสรรด้วยความจริงใจ ให้คุณได้ทานทุเรียนอร่อยสมราคา ไม่ต้องเสี่ยงดวง
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {points.map((pt, i) => {
            const Icon = pt.icon;
            return (
              <div
                key={i}
                className="bg-white/5 backdrop-blur-xs rounded-2xl p-6 border border-white/10 hover:border-amber-400/40 transition"
              >
                <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-400/20 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h4 className="text-base font-bold text-white mb-2">
                  {pt.title}
                </h4>
                <p className="text-xs text-emerald-100/75 leading-relaxed">
                  {pt.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ===================== ORDER MODAL =====================
function OrderModal({
  product,
  roundId,
  lineProfile,
  onAddToCart,
  onSuccess,
  onClose,
}: {
  product: Product;
  roundId: string;
  lineProfile: { userId: string; displayName: string } | null;
  onAddToCart: (product: Product, qty: number, ripenessPref: string) => void;
  onSuccess: (order: Order) => void;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(1);
  const [ripenessPref, setRipenessPref] = useState("กรอบนอกนุ่มใน (ไก่ฉีก)");
  const [name, setName] = useState(lineProfile?.displayName || "");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [shipping, setShipping] = useState(shopInfo.shippingMethods[0].name);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  const shippingCost =
    shopInfo.shippingMethods.find((s) => s.name === shipping)?.price || 0;
  const totalPrice = product.price * qty + shippingCost;

  const handleSubmit = async (e: React.FormEvent) => {
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
          ripenessPref,
          shippingMethod: shipping,
          roundId,
          lineUserId: lineProfile?.userId,
          items: [{ productId: product.id, qty, ripenessPref }],
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        order?: Order;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.order) {
        setErrorMsg(json.error || "ไม่สามารถบันทึกคำสั่งซื้อได้ กรุณาลองใหม่");
      } else {
        setCreatedOrder(json.order);
        onSuccess(json.order);
      }
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setSubmitting(false);
    }
  };

  if (createdOrder) {
    return <OrderSuccessModal order={createdOrder} onClose={onClose} />;
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#1B4D31] text-white px-6 py-4 flex items-center justify-between border-b border-emerald-900 rounded-t-3xl sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <img
              src={shopInfo.logo}
              alt={shopInfo.name}
              className="w-10 h-10 rounded-full border border-white/25 object-cover bg-white"
            />
            <div>
              <h4 className="font-bold text-base text-white">
                สั่งจองกับ {shopInfo.name}
              </h4>
              <p className="text-[11px] text-emerald-200 font-mono">
                โทร. {shopInfo.phone}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Product Mini Spec */}
          <div className="flex gap-4 p-3 bg-stone-50 border border-stone-200 rounded-2xl items-center">
            <img
              src={product.image}
              alt={product.name}
              className="w-16 h-16 object-cover rounded-xl border border-stone-200"
            />
            <div className="flex-1 min-w-0">
              <h5 className="font-bold text-stone-900 text-sm truncate">
                {product.name}
              </h5>
              <p className="text-xs text-stone-500">
                {product.origin} • {product.weight}
              </p>
              <p className="font-extrabold text-[#1B4D31] text-base mt-0.5">
                ฿{product.price.toLocaleString()} /{product.unit}
              </p>
            </div>
          </div>

          {/* ระดับความสุก */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1.5">
              เลือกระดับความสุกที่ชอบ (เราจะคัดตามนี้) *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                "กรอบนอกนุ่มใน (ไก่ฉีก)",
                "สุกพอดีกิน (เนื้อเนียน)",
                "สุกนิ่ม (หวานฉ่ำ)",
              ].map((rf) => (
                <label
                  key={rf}
                  className={`p-2.5 rounded-xl border text-center cursor-pointer transition text-xs font-semibold ${
                    ripenessPref === rf
                      ? "border-[#1B4D31] bg-emerald-50 text-[#1B4D31]"
                      : "border-stone-200 text-stone-600 hover:border-stone-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="ripenessChoice"
                    value={rf}
                    checked={ripenessPref === rf}
                    onChange={() => setRipenessPref(rf)}
                    className="sr-only"
                  />
                  {rf}
                </label>
              ))}
            </div>
          </div>

          {/* จำนวน */}
          <div className="flex items-center justify-between p-3 bg-stone-50 rounded-2xl border border-stone-200">
            <span className="text-xs font-bold text-stone-700">
              จำนวนที่ต้องการสั่ง
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-8 h-8 bg-white border border-stone-300 rounded-lg flex items-center justify-center hover:bg-stone-100"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="font-extrabold text-base w-6 text-center">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty(qty + 1)}
                className="w-8 h-8 bg-[#1B4D31] text-white rounded-lg flex items-center justify-center hover:bg-[#143B25]"
              >
                <Plus className="w-4 h-4" />
              </button>
              <span className="text-xs text-stone-500 font-semibold">
                {product.unit}
              </span>
            </div>
          </div>

          {/* ข้อมูลจัดส่ง */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                ชื่อ-นามสกุล ผู้รับ *
              </label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น คุณสมชาย ใจดี"
                className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs focus:border-[#1B4D31] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                เบอร์โทรศัพท์ (สำหรับขนส่งโทรส่งของ) *
              </label>
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08X-XXX-XXXX"
                className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs focus:border-[#1B4D31] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                ที่อยู่จัดส่งละเอียด *
              </label>
              <textarea
                required
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
                className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs focus:border-[#1B4D31] focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* วิธีจัดส่ง */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              วิธีการจัดส่ง
            </label>
            <div className="space-y-1.5">
              {shopInfo.shippingMethods.map((s) => (
                <label
                  key={s.name}
                  className={`flex items-start justify-between p-2.5 rounded-xl border cursor-pointer text-xs ${
                    shipping === s.name
                      ? "border-[#1B4D31] bg-emerald-50/50 font-semibold text-stone-900"
                      : "border-stone-200 text-stone-600 hover:border-stone-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="shippingMethod"
                      value={s.name}
                      checked={shipping === s.name}
                      onChange={() => setShipping(s.name)}
                      className="accent-[#1B4D31] mt-0.5"
                    />
                    <div>
                      <span>{s.name}</span>
                      <p className="text-[10px] text-stone-400 font-normal">
                        {s.note}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold">
                    {s.price === 0 ? "ฟรี" : `฿${s.price}`}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* ยอดรวม */}
          <div className="bg-stone-50 rounded-2xl p-4 flex items-center justify-between border border-stone-200">
            <div>
              <span className="text-[10px] text-stone-500 font-bold uppercase block">
                ยอดรวมทั้งสิ้น (รวมค่าส่ง)
              </span>
              <span className="text-2xl font-extrabold text-[#1B4D31]">
                ฿{totalPrice.toLocaleString()}
              </span>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>การันตี 100%</span>
            </span>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold p-3 rounded-xl">
              {errorMsg}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onAddToCart(product, qty, ripenessPref);
                onClose();
              }}
              className="px-4 py-3.5 rounded-xl bg-white border border-stone-300 text-stone-700 hover:border-[#1B4D31] hover:text-[#1B4D31] text-xs font-bold transition shrink-0 inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ใส่ตะกร้า</span>
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-[#1B4D31] hover:bg-[#143B25] disabled:opacity-60 text-white py-3.5 rounded-xl text-sm font-bold shadow-md transition inline-flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-300" />
              <span>
                {submitting
                  ? "กำลังบันทึก..."
                  : `ยืนยันสั่งซื้อ ฿${totalPrice.toLocaleString()}`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===================== FOOTER =====================
function Footer() {
  return (
    <footer
      id="contact"
      className="bg-[#0E2719] text-stone-300 py-14 border-t border-white/10 text-xs"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-white/10">
          {/* Brand Col */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={shopInfo.logo}
                alt={shopInfo.name}
                className="w-12 h-12 rounded-full border border-white/25 bg-white object-cover"
              />
              <div>
                <h4 className="text-lg font-extrabold text-white">
                  {shopInfo.name}
                </h4>
                <p className="text-xs text-amber-300 font-mono">
                  โทร. {shopInfo.phone}
                </p>
              </div>
            </div>
            <p className="text-stone-400 text-xs leading-relaxed">
              {shopInfo.description}
            </p>
          </div>

          {/* Contact Col */}
          <div className="space-y-2.5">
            <h5 className="font-bold text-white uppercase text-xs mb-3 tracking-wider">
              ติดต่อสอบถาม &amp; สั่งซื้อ
            </h5>
            <p>
              เบอร์โทรศัพท์:{" "}
              <strong className="text-white font-mono text-sm">
                {shopInfo.phone}
              </strong>
            </p>
            <p>
              LINE OA:{" "}
              <LineDirectLink
                prefillText="สวัสดีครับ สอบถามทุเรียนวินคินครับ"
                className="text-amber-300 hover:text-amber-200 underline underline-offset-4 font-bold font-mono"
              >
                {shopInfo.lineOA}
              </LineDirectLink>
            </p>
            <p>เวลาทำการ: ทุกวัน 08:00 - 21:00 น.</p>
          </div>

          {/* Menu Col */}
          <div className="space-y-2.5">
            <h5 className="font-bold text-white uppercase text-xs mb-3 tracking-wider">
              ระบบและบริการ
            </h5>
            <a
              href="/tracking"
              className="flex items-center gap-1.5 hover:text-white transition"
            >
              <Package className="w-3.5 h-3.5 text-amber-400" />
              <span>เช็กสถานะพัสดุ (Tracking)</span>
            </a>
            <a
              href="/claim"
              className="flex items-center gap-1.5 text-amber-300 hover:text-amber-200 transition font-semibold"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>ศูนย์รับประกันและแจ้งเคลม 100%</span>
            </a>
            <a
              href="/liff/index.html"
              className="flex items-center gap-1.5 text-emerald-300 hover:text-white transition"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>หน้าสั่งด่วนสำหรับ LINE OA (HTML/JS)</span>
            </a>
            <a
              href="/admin"
              className="flex items-center gap-1.5 hover:text-white transition"
            >
              <Settings className="w-3.5 h-3.5 text-stone-400" />
              <span>เข้าสู่ระบบหลังบ้าน (Admin)</span>
            </a>
          </div>

          {/* Bank Info */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-1.5">
            <h5 className="font-bold text-amber-300 uppercase text-xs tracking-wider">
              บัญชีชำระเงินทางการ
            </h5>
            <p className="text-white font-semibold">
              {shopInfo.bankAccount.bank}
            </p>
            <p className="font-mono text-white text-sm font-bold">
              {shopInfo.bankAccount.number}
            </p>
            <p className="text-amber-300 text-xs font-mono">
              พร้อมเพย์: {shopInfo.bankAccount.promptPay}
            </p>
            <p className="text-stone-400 text-[10px]">
              {shopInfo.bankAccount.name}
            </p>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-stone-400 text-[11px]">
          <p>© 2026 {shopInfo.name}. All rights reserved.</p>
          <p>คัดสดจากสวน วิ่งส่งตรงถึงบ้านคุณ การันตีคุณภาพ 100%</p>
        </div>
      </div>
    </footer>
  );
}

// ===================== FLOATING LINE, CART & CALL =====================
function FloatingActionButtons({
  totalCartItems,
  onOpenCart,
}: {
  totalCartItems: number;
  onOpenCart: () => void;
}) {
  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2.5 items-end">
      {totalCartItems > 0 && (
        <button
          type="button"
          onClick={onOpenCart}
          className="bg-[#1B4D31] hover:bg-[#143B25] text-white px-4 py-3 rounded-full shadow-xl flex items-center gap-2 border border-white/20 hover:scale-105 transition-all text-xs font-bold"
        >
          <ShoppingBasket className="w-4 h-4 text-amber-300" />
          <span>ตะกร้า ({totalCartItems})</span>
        </button>
      )}
      <LineDirectLink
        prefillText="สวัสดีครับ สนใจสั่งซื้อทุเรียนวินคินครับ"
        className="bg-[#06C755] hover:bg-[#05b34c] text-white p-3.5 sm:px-5 sm:py-3 rounded-full shadow-xl flex items-center gap-2 hover:scale-105 transition-all"
        ariaLabel="Contact LINE"
      >
        <LineIcon className="w-5 h-5" />
        <span className="hidden sm:inline font-bold text-xs">สั่งผ่าน LINE</span>
      </LineDirectLink>
      <a
        href={`tel:${shopInfo.phone.replace(/-/g, "")}`}
        className="bg-white hover:bg-stone-50 text-[#1B4D31] p-3.5 sm:px-5 sm:py-3 rounded-full shadow-xl border border-stone-200 flex items-center gap-2 hover:scale-105 transition-all text-xs font-bold"
        aria-label="Call phone"
      >
        <Phone className="w-4 h-4 text-amber-600" />
        <span className="hidden sm:inline font-mono">{shopInfo.phone}</span>
      </a>
    </div>
  );
}

// ===================== MAIN PAGE =====================
export default function Home() {
  const [products, setProducts] = useState<Product[]>(defaultProducts);
  const [round, setRound] = useState<Round>(defaultRound);
  const [liffId, setLiffId] = useState<string>("");
  const [orderProduct, setOrderProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const { addItem, totalItems } = useCart();
  const { profile: lineProfile } = useLiff(liffId);

  useEffect(() => {
    fetch("/api/shop")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          if (Array.isArray(json.products) && json.products.length > 0) {
            setProducts(json.products);
          }
          if (json.currentRound) {
            setRound(json.currentRound);
          }
          if (json.lineLiffId) {
            setLiffId(json.lineLiffId);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleOrderCreated = (createdOrder: Order) => {
    const qtyOrdered = createdOrder.items.reduce((s, it) => s + it.qty, 0);
    setRound((prev) => ({
      ...prev,
      quotaRemaining: Math.max(0, prev.quotaRemaining - qtyOrdered),
    }));
  };

  return (
    <main className="min-h-screen bg-[#FBF6E3]">
      <Navbar
        totalCartItems={totalItems}
        onOpenCart={() => setCartOpen(true)}
      />
      {lineProfile && (
        <div className="bg-emerald-50 border-b border-emerald-200 py-2 px-4 text-center text-xs font-semibold text-emerald-800 flex items-center justify-center gap-2">
          <LineIcon className="w-4 h-4 text-[#06C755]" />
          <span>
            ยินดีต้อนรับคุณ {lineProfile.displayName}{" "}
            (เชื่อมต่อ LINE พร้อมรับแจ้งเตือนพัสดุอัตโนมัติ)
          </span>
        </div>
      )}
      <HeroBanner round={round} />
      <RipenessGuide />
      <ProductMenu
        products={products}
        onOrder={setOrderProduct}
        onAddToCart={(p) =>
          addItem(p, 1, p.ripeness || "กรอบนอกนุ่มใน (ไก่ฉีก)")
        }
      />
      <WhyUs />
      <Footer />
      <FloatingActionButtons
        totalCartItems={totalItems}
        onOpenCart={() => setCartOpen(true)}
      />

      {orderProduct && (
        <OrderModal
          product={orderProduct}
          roundId={round.id}
          lineProfile={lineProfile}
          onAddToCart={(p, q, rip) => addItem(p, q, rip)}
          onSuccess={handleOrderCreated}
          onClose={() => setOrderProduct(null)}
        />
      )}

      {cartOpen && (
        <CartDrawerModal
          roundId={round.id}
          lineProfile={lineProfile}
          onSuccess={handleOrderCreated}
          onClose={() => setCartOpen(false)}
        />
      )}
    </main>
  );
}
