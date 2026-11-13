"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Flame,
  Info,
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
  ThumbsUp,
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

// ===================== METRIC BAR HELPER =====================
function MetricBar({
  label,
  valueText,
  score,
  max = 5,
  color = "bg-amber-500",
}: {
  label: string;
  valueText?: string;
  score: number;
  max?: number;
  color?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-stone-700">{label}</span>
        <span className="text-stone-500 font-medium text-[11px]">{valueText}</span>
      </div>
      <div className="flex items-center gap-1">
        {Array.from({ length: max }).map((_, idx) => (
          <span
            key={idx}
            className={`h-2 flex-1 rounded-full transition-all ${
              idx < score ? color : "bg-stone-200"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ===================== RIPENESS GUIDE =====================
const RIPENESS_LEVELS = [
  {
    id: "crispy",
    orderValue: "กรอบนอกนุ่มใน (ไก่ฉีก)",
    number: "1",
    title: "กรอบนอก นุ่มใน",
    subtitle: "เนื้อไก่ฉีก (Crispy outside, soft inside)",
    maturityPct: "ความสุก 70-75%",
    badge: "🔥 ขายดีอันดับ 1 (ยอดสั่ง 65%)",
    badgeColor: "bg-amber-500 text-stone-950 font-extrabold",
    borderColor: "border-amber-400",
    image: "/ripeness/crispy.jpg",
    imageAlt: "ทุเรียนเนื้อไก่ฉีก กรอบนอกนุ่มใน วินคิน",
    desc: "เคี้ยวด้านนอกมีความกรอบกรุบ เด้งสู้ฟัน ด้านในเนื้อนุ่มเนียน ฉีกเป็นเส้นใยสวยงาม ไม่เละ ไม่ติดมือ รสหวานละมุน ไม่หวานเลี่ยน ทานเพลินเคี้ยวมันสุดๆ",
    highlight: "กรอบเด้ง • ฉีกเป็นเส้น • ถือทานไม่เลอะมือ",
    crispiness: 4,
    crispinessText: "กรอบเด้ง 80% (เคี้ยวเพลิน)",
    sweetness: 4,
    sweetnessText: "30-32° Brix (หวานกำลังดี)",
    creaminess: 3,
    creaminessText: "มันกำลังดี ไม่เลี่ยน",
    aroma: "กลิ่นหอมอ่อนละมุน ทานในห้องแอร์ได้ ไม่ฉุนติดห้อง",
    shelfLife: "แช่เย็นเก็บได้ 2-3 วัน เนื้อยังคงความกรอบอร่อย",
    targetPersona: "ผู้เริ่มต้นทานทุเรียน, คนชอบเคี้ยวกรุบกรอบ, คนที่พกไปทานที่ทำงาน",
    tagEmoji: "👤",
  },
  {
    id: "creamy",
    orderValue: "สุกพอดีกิน (เนื้อเนียนครีม)",
    number: "2",
    title: "สุกพอดีกิน",
    subtitle: "เนื้อเนียนครีมคัสตาร์ด (Custard Creamy)",
    maturityPct: "ความสุก 85-90%",
    badge: "⭐ รสชาติคลาสสิก แนะนำ",
    badgeColor: "bg-emerald-600 text-white font-extrabold",
    borderColor: "border-emerald-500",
    image: "/ripeness/creamy.jpg",
    imageAlt: "ทุเรียนเนื้อเนียนครีม สุกพอดีกิน วินคิน",
    desc: "เนื้อสีเหลืองทองเงางาม นุ่มเนียนละมุนลิ้นคล้ายคัสตาร์ด รสชาติหวานมันจัดเต็มอย่างลงตัว กลิ่นหอมฟุ้งติดปาก มาตรฐานความอร่อยระดับทองคำของทุเรียนไทย",
    highlight: "เนียนนุ่มคัสตาร์ด • หวานมันกลมกล่อม • หอมฟุ้ง",
    crispiness: 2,
    crispinessText: "นุ่มเนียน ไม่กรอบ ไม่เละ",
    sweetness: 5,
    sweetnessText: "34-36° Brix (หวานมันกลมกล่อม)",
    creaminess: 5,
    creaminessText: "ครีมมี่นัวละมุน 100%",
    aroma: "กลิ่นหอมฟุ้ง ชวนน้ำลายสอ มาตรฐานทุเรียนระยองแท้",
    shelfLife: "แช่เย็นเก็บได้ 1-2 วัน ความหวานมันจะยิ่งเข้าเนื้อ",
    targetPersona: "เหมาะสำหรับทุกคนในครอบครัว, คนที่ชอบรสชาติทุเรียนแท้ที่กลมกล่อมที่สุด",
    tagEmoji: "👥",
  },
  {
    id: "soft",
    orderValue: "สุกนิ่ม (เนื้อปลาร้าอ่อนๆ)",
    number: "3",
    title: "สุกนิ่ม",
    subtitle: "เนื้อปลาร้าอ่อนๆ (Melt in your mouth)",
    maturityPct: "ความสุก 95-100%",
    badge: "🍯 หวานจัดฉ่ำสะใจ",
    badgeColor: "bg-amber-700 text-white font-extrabold",
    borderColor: "border-amber-600",
    image: "/ripeness/soft.jpg",
    imageAlt: "ทุเรียนเนื้อสุกนิ่ม ปลาร้าอ่อน หวานฉ่ำ วินคิน",
    desc: "เนื้อสุกงอมธรรมชาติ สีเหลืองจำปาเข้ม นุ่มเยิ้มละลายในปากทันทีที่สัมผัส รสชาติหวานจัดลึกซึ้งถึงใจ กลิ่นหอมเข้มข้นจัดจ้าน สำหรับคอทุเรียนสายหวานฉ่ำตัวจริง",
    highlight: "ละลายในปาก • หวานจัดลึกซึ้ง • เหมาะทานกับข้าวเหนียว",
    crispiness: 0,
    crispinessText: "นุ่มเยิ้ม ละลายทันที",
    sweetness: 5,
    sweetnessText: "36-38°+ Brix (หวานเข้มสะใจ)",
    creaminess: 4,
    creaminessText: "นุ่มฉ่ำ ละมุนลิ้น",
    aroma: "กลิ่นหอมเข้มข้นจัดจ้าน เอกลักษณ์ทุเรียนสุกงอมธรรมชาติ",
    shelfLife: "ควรทานทันทีในวันที่ได้รับ หรือนำไปทำข้าวเหนียวทุเรียน",
    targetPersona: "คอทุเรียนพันธุ์แท้, ผู้สูงอายุเคี้ยวง่าย, คนชอบรสหวานจัดลึก",
    tagEmoji: "👑",
  },
];

function RipenessGuide({
  selectedRipeness = "กรอบนอกนุ่มใน (ไก่ฉีก)",
  onSelectRipeness,
}: {
  selectedRipeness?: string;
  onSelectRipeness?: (ripeness: string) => void;
}) {
  const [showComparison, setShowComparison] = useState(false);

  const handleSelect = (orderVal: string) => {
    if (onSelectRipeness) {
      onSelectRipeness(orderVal);
    }
    const menuEl = document.getElementById("menu");
    if (menuEl) {
      menuEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="ripeness" className="relative py-14 sm:py-18 bg-[#F8E9B0] border-b border-amber-200">
      <div className="absolute top-0 inset-x-0 thorn-edge" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          <span className="inline-flex items-center gap-1.5 bg-white text-[#1B4D31] border border-amber-300 text-xs font-bold px-3 py-1 rounded-full shadow-xs">
            <DurianIcon className="w-3.5 h-3.5 text-amber-600" />
            <span>คู่มือเลือกระดับเนื้อทุเรียน • คัดพิเศษรายบุคคล</span>
          </span>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-stone-900 mt-3 mb-2">
            ชอบเนื้อแบบไหน วินคินจัดให้ตรงใจคุณ
          </h3>
          <p className="text-xs sm:text-sm text-stone-700 max-w-xl mx-auto leading-relaxed">
            ระบุระดับความสุกในขั้นตอนสั่งซื้อ ทีมงานช่างเคาะสวนระยองจะคัดพูตามความชอบของคุณโดยเฉพาะ{" "}
            <strong className="text-[#1B4D31]">การันตีความสุกตรงปก 100%</strong>
          </p>
        </div>

        {/* Visual Maturity Stepper Bar */}
        <div className="bg-white/90 backdrop-blur-xs rounded-2xl p-4 sm:p-5 shadow-sm border border-amber-200 mb-8 max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-1 mb-3 text-xs font-bold text-stone-700">
            <span className="flex items-center gap-1.5 text-stone-700">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>ระดับความสุกตามธรรมชาติ:</span>
              <span className="text-[#1B4D31] font-extrabold">ยิ่งสุกมาก ยิ่งหวานมันนุ่มละลาย</span>
            </span>
            <span className="text-stone-500 text-[11px]">คลิกเลือกระดับที่ชอบเพื่อสั่งซื้อ</span>
          </div>

          {/* Stepper Gradient Line */}
          <div className="relative pt-1 pb-2">
            <div className="h-2.5 w-full rounded-full bg-gradient-to-r from-amber-300 via-amber-500 to-amber-700 shadow-inner" />
            <div className="grid grid-cols-3 gap-2 mt-3">
              {RIPENESS_LEVELS.map((lvl) => {
                const isSelected = selectedRipeness === lvl.orderValue;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => handleSelect(lvl.orderValue)}
                    className={`text-left p-2 sm:p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-emerald-50 border-[#1B4D31] ring-2 ring-[#1B4D31]/30 shadow-xs"
                        : "bg-stone-50/80 border-stone-200 hover:bg-white hover:border-amber-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-stone-900 text-xs sm:text-sm">
                        {lvl.title}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-stone-200 text-amber-800">
                        {lvl.maturityPct.replace("ความสุก ", "")}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 line-clamp-1">{lvl.subtitle}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3 Rich Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-7">
          {RIPENESS_LEVELS.map((lvl) => {
            const isSelected = selectedRipeness === lvl.orderValue;
            return (
              <div
                key={lvl.id}
                className={`bg-white rounded-3xl overflow-hidden shadow-sm border-2 transition-all flex flex-col justify-between ${
                  isSelected
                    ? "border-[#1B4D31] ring-4 ring-[#1B4D31]/15 shadow-lg"
                    : "border-amber-200 hover:border-amber-400 hover:shadow-md"
                }`}
              >
                {/* Photo Header */}
                <div className="relative aspect-[16/10] overflow-hidden bg-stone-900 group">
                  <img
                    src={lvl.image}
                    alt={lvl.imageAlt}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

                  {/* Top Badges */}
                  <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2">
                    <span className={`text-[11px] px-2.5 py-1 rounded-full shadow-sm ${lvl.badgeColor}`}>
                      {lvl.badge}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/95 text-stone-900 shadow-xs">
                      {lvl.maturityPct}
                    </span>
                  </div>

                  {/* Bottom Text Over Photo */}
                  <div className="absolute bottom-3 inset-x-4 text-white">
                    <h4 className="text-lg sm:text-xl font-extrabold drop-shadow-md">
                      {lvl.number}. {lvl.title}
                    </h4>
                    <p className="text-xs text-amber-300 font-medium drop-shadow-sm">
                      {lvl.subtitle}
                    </p>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
                  {/* Highlight pill & desc */}
                  <div>
                    <div className="inline-block bg-amber-50 text-amber-900 font-bold text-[11px] px-2.5 py-1 rounded-lg border border-amber-200 mb-2.5">
                      ✨ {lvl.highlight}
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      {lvl.desc}
                    </p>
                  </div>

                  {/* Sensory Meters */}
                  <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-200 space-y-2.5">
                    <MetricBar
                      label="🥖 ความกรอบ"
                      valueText={lvl.crispinessText}
                      score={lvl.crispiness}
                      color="bg-emerald-600"
                    />
                    <MetricBar
                      label="🍯 ความหวาน"
                      valueText={lvl.sweetnessText}
                      score={lvl.sweetness}
                      color="bg-amber-500"
                    />
                    <MetricBar
                      label="🧈 ความมันครีม"
                      valueText={lvl.creaminessText}
                      score={lvl.creaminess}
                      color="bg-amber-400"
                    />
                    <div className="pt-2 border-t border-stone-200 text-xs flex items-start gap-1.5 text-stone-600">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span className="leading-snug">
                        <strong className="text-stone-800">กลิ่นหอม:</strong> {lvl.aroma}
                      </span>
                    </div>
                  </div>

                  {/* Recommended Target Persona */}
                  <div className="bg-amber-50/70 rounded-xl p-3 border border-amber-200/80 text-xs">
                    <span className="font-bold text-[#1B4D31] flex items-center gap-1.5 mb-1">
                      <span>{lvl.tagEmoji}</span>
                      <span>เหมาะสำหรับ:</span>
                    </span>
                    <p className="text-stone-600 text-[11px] leading-relaxed">
                      {lvl.targetPersona}
                    </p>
                  </div>

                  {/* CTA Button */}
                  <button
                    type="button"
                    onClick={() => handleSelect(lvl.orderValue)}
                    className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                      isSelected
                        ? "bg-[#1B4D31] text-[#FFD84D] hover:bg-[#143B25] ring-2 ring-[#1B4D31]"
                        : "bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold"
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>เลือกระดับนี้แล้ว (คลิกไปสั่งซื้อ)</span>
                      </>
                    ) : (
                      <>
                        <span>สั่งทุเรียนเนื้อระดับนี้</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Comparison Toggle Button */}
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setShowComparison(!showComparison)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-amber-300 text-stone-800 text-xs font-bold hover:bg-amber-50 transition shadow-xs cursor-pointer"
          >
            <span>{showComparison ? "ซ่อนตารางเปรียบเทียบ" : "📊 ดูตารางสรุปเปรียบเทียบทั้ง 3 ระดับแบบละเอียด"}</span>
            {showComparison ? (
              <ChevronUp className="w-4 h-4 text-amber-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-amber-600" />
            )}
          </button>
        </div>

        {/* Detailed Comparison Table (Expandable) */}
        {showComparison && (
          <div className="mt-5 bg-white rounded-3xl p-5 sm:p-7 border border-amber-300 shadow-md max-w-4xl mx-auto overflow-x-auto transition-all">
            <h4 className="text-base font-extrabold text-stone-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>ตารางสรุปเปรียบเทียบความแตกต่างของระดับความสุก 3 สไตล์</span>
            </h4>
            <table className="w-full text-left text-xs text-stone-700 min-w-[550px]">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 text-[11px] uppercase">
                  <th className="py-2.5 font-bold">เกณฑ์เปรียบเทียบ</th>
                  <th className="py-2.5 font-bold text-amber-700">1. กรอบนอกนุ่มใน</th>
                  <th className="py-2.5 font-bold text-emerald-700">2. สุกพอดีกิน</th>
                  <th className="py-2.5 font-bold text-amber-900">3. สุกนิ่มฉ่ำ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                <tr>
                  <td className="py-2.5 font-semibold text-stone-900">ระดับความสุก</td>
                  <td className="py-2.5 text-stone-600">70% - 75%</td>
                  <td className="py-2.5 text-stone-600">85% - 90% (มาตรฐาน)</td>
                  <td className="py-2.5 text-stone-600">95% - 100%</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-semibold text-stone-900">สัมผัสเนื้อ</td>
                  <td className="py-2.5 text-stone-600">เคี้ยวกรุบ ฉีกเป็นเส้น</td>
                  <td className="py-2.5 text-stone-600">เนียนนุ่มดั่งคัสตาร์ด</td>
                  <td className="py-2.5 text-stone-600">นุ่มเยิ้ม ละลายในปาก</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-semibold text-stone-900">ความกรอบ</td>
                  <td className="py-2.5 text-stone-600">★★★★☆ (กรอบเด้ง)</td>
                  <td className="py-2.5 text-stone-600">★★☆☆☆ (นุ่มกำลังดี)</td>
                  <td className="py-2.5 text-stone-600">☆☆☆☆☆ (ไม่มีความกรอบ)</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-semibold text-stone-900">ความหวาน</td>
                  <td className="py-2.5 text-stone-600">30 - 32° Brix (หวานเบาๆ)</td>
                  <td className="py-2.5 text-stone-600">34 - 36° Brix (หวานมันกลมกล่อม)</td>
                  <td className="py-2.5 text-stone-600">36 - 38°+ Brix (หวานจัดเข้ม)</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-semibold text-stone-900">กลิ่นหอม</td>
                  <td className="py-2.5 text-stone-600">กลิ่นอ่อน ไม่ฉุนในห้องแอร์</td>
                  <td className="py-2.5 text-stone-600">กลิ่นหอมฟุ้ง ชวนน้ำลายสอ</td>
                  <td className="py-2.5 text-stone-600">กลิ่นหอมเข้มข้นจัดจ้าน</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-semibold text-stone-900">การจับทาน</td>
                  <td className="py-2.5 text-stone-600">แห้งสนิท ไม่เลอะมือ</td>
                  <td className="py-2.5 text-stone-600">มีความชุ่มฉ่ำพอดี</td>
                  <td className="py-2.5 text-stone-600">นุ่มเยิ้ม แนะนำใช้ช้อน</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-semibold text-stone-900">ระยะเวลาเก็บแช่เย็น</td>
                  <td className="py-2.5 text-stone-600">2 - 3 วัน เนื้อยังกรอบ</td>
                  <td className="py-2.5 text-stone-600">1 - 2 วัน ความมันเข้าเนื้อ</td>
                  <td className="py-2.5 text-stone-600">ควรทานทันทีในวันที่ได้รับ</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 100% Quality & Ripeness Guarantee Strip */}
        <div className="mt-8 bg-white/95 rounded-2xl p-5 border border-amber-300 max-w-4xl mx-auto shadow-xs flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-[#1B4D31] flex items-center justify-center shrink-0 border border-emerald-300">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h4 className="font-extrabold text-stone-900 text-sm mb-1 flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
              <span>การันตีความสุกตรงปก 100% โดยทุเรียนวินคิน</span>
              <span className="text-[10px] bg-emerald-100 text-[#1B4D31] px-2 py-0.5 rounded-full font-bold">
                เคลมเปลี่ยนลูกใหม่ฟรี
              </span>
            </h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              ช่างเคาะสวนระยองประสบการณ์กว่า 20 ปี คัดพูตามระดับที่คุณสั่ง หากผ่าแล้วเนื้อไม่ตรงตามระดับที่คุณเลือก ถ่ายรูปหรือคลิปส่งแอดมินทาง LINE ได้ตลอด 24 ชม. เคลมเปลี่ยนลูกใหม่หรือคืนเงินทันที!
            </p>
          </div>
          <LineDirectLink
            prefillText="สวัสดีครับ สอบถามเรื่องเลือกระดับความสุกทุเรียนวินคินครับ"
            className="px-4 py-2.5 rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-bold transition shadow-xs shrink-0 flex items-center gap-1.5"
          >
            <LineIcon className="w-4 h-4" />
            <span>ปรึกษาแอดมิน</span>
          </LineDirectLink>
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
  preferredRipeness,
}: {
  products: Product[];
  onOrder: (p: Product) => void;
  onAddToCart: (p: Product) => void;
  preferredRipeness?: string;
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

        {/* Selected Ripeness Notification Pill */}
        {preferredRipeness && (
          <div className="mt-4 inline-flex items-center gap-2 bg-emerald-50 border border-emerald-300 text-[#1B4D31] px-4 py-2 rounded-full text-xs font-semibold shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              ระดับความสุกที่คุณเลือก: <strong>{preferredRipeness}</strong> (ระบบจะเลือกให้อัตโนมัติในขั้นตอนสั่งซื้อ)
            </span>
            <a href="#ripeness" className="text-amber-800 underline hover:text-amber-900 ml-1 font-bold">
              เปลี่ยนระดับ
            </a>
          </div>
        )}

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
  const [qty, setQty] = useState(1);
  const [ripenessPref, setRipenessPref] = useState(
    initialRipeness || "กรอบนอกนุ่มใน (ไก่ฉีก)"
  );
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
                {
                  value: "กรอบนอกนุ่มใน (ไก่ฉีก)",
                  label: "1. กรอบนอกนุ่มใน",
                  tag: "เนื้อไก่ฉีก ไม่เละ",
                },
                {
                  value: "สุกพอดีกิน (เนื้อเนียนครีม)",
                  label: "2. สุกพอดีกิน",
                  tag: "เนียนนุ่มคัสตาร์ด",
                },
                {
                  value: "สุกนิ่ม (เนื้อปลาร้าอ่อนๆ)",
                  label: "3. สุกนิ่ม",
                  tag: "หวานจัด ละลายในปาก",
                },
              ].map((rf) => (
                <label
                  key={rf.value}
                  className={`p-2.5 rounded-xl border text-center cursor-pointer transition text-xs font-semibold ${
                    ripenessPref === rf.value
                      ? "border-[#1B4D31] bg-emerald-50 text-[#1B4D31] ring-2 ring-[#1B4D31]/30"
                      : "border-stone-200 text-stone-600 hover:border-stone-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="ripenessChoice"
                    value={rf.value}
                    checked={ripenessPref === rf.value}
                    onChange={() => setRipenessPref(rf.value)}
                    className="sr-only"
                  />
                  <div className="font-extrabold">{rf.label}</div>
                  <div className="text-[10px] text-stone-500 font-normal mt-0.5">
                    {rf.tag}
                  </div>
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
  const [preferredRipeness, setPreferredRipeness] = useState<string>(
    "กรอบนอกนุ่มใน (ไก่ฉีก)"
  );

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
      <RipenessGuide
        selectedRipeness={preferredRipeness}
        onSelectRipeness={setPreferredRipeness}
      />
      <ProductMenu
        products={products}
        preferredRipeness={preferredRipeness}
        onOrder={setOrderProduct}
        onAddToCart={(p) =>
          addItem(p, 1, preferredRipeness || p.ripeness || "กรอบนอกนุ่มใน (ไก่ฉีก)")
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
          initialRipeness={preferredRipeness}
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
