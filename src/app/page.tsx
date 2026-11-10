"use client";

import { useEffect, useState } from "react";
import { products as defaultProducts, currentRound as defaultRound, shopInfo } from "../data/mock";
import type { Order, Product, Round } from "../types/durian";

// Official LINE SVG Icon
function LineIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}

// ===================== NAVBAR =====================
function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Top Banner Alert */}
      <div className="bg-[#14532d] text-yellow-300 text-xs sm:text-sm py-2 px-4 text-center font-bold shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🍈</span>
            <span>
              <strong>เปิดจองรอบพิเศษ:</strong> คัดสดจากสวนระยอง-จันทบุรี แก่จัด 85%+ ไม่ป้ายยา การันตีเคลม 100%
            </span>
          </div>
          <a
            href={`tel:${shopInfo.phone.replace(/-/g, "")}`}
            className="hidden sm:flex items-center gap-1.5 bg-yellow-400 text-green-950 px-3 py-0.5 rounded-full font-black text-xs hover:bg-yellow-300 transition"
          >
            <span>📞 โทรสั่ง:</span>
            <span className="font-mono">{shopInfo.phone}</span>
          </a>
        </div>
      </div>

      {/* Main Navbar */}
      <header className="bg-white border-b-2 border-yellow-400 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <a href="#" className="flex items-center gap-3">
            <img
              src={shopInfo.logo}
              alt={shopInfo.name}
              className="w-14 h-14 rounded-full border-2 border-yellow-400 shadow-sm object-cover bg-white"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-green-800 tracking-tight leading-tight">
                  {shopInfo.name}
                </h1>
                <span className="bg-green-700 text-yellow-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                  ของแท้ 100%
                </span>
              </div>
              <p className="text-xs text-amber-700 font-bold font-mono">
                🛻 รถกระบะส่งตรงจากสวน • โทร. {shopInfo.phone}
              </p>
            </div>
          </a>

          {/* Desktop Menu */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-bold text-gray-700">
            <a href="#menu" className="hover:text-green-700 transition">
              🍈 รายการทุเรียน
            </a>
            <a href="#ripeness" className="hover:text-green-700 transition">
              🥑 ระดับความสุก
            </a>
            <a href="#why-us" className="hover:text-green-700 transition">
              ⭐ จุดเด่นร้าน
            </a>
            <a href="/tracking" className="hover:text-green-700 transition">
              📦 เช็กพัสดุ
            </a>
            <a href="/claim" className="text-red-600 hover:text-red-700 transition font-black">
              🛡️ แจ้งเคลมทุเรียน
            </a>
          </nav>

          {/* Action Button */}
          <div className="hidden sm:flex items-center gap-3">
            <a
              href={`https://line.me/R/ti/p/${shopInfo.lineOA}`}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 rounded-full bg-[#06C755] hover:bg-[#05b34c] text-white font-black text-sm transition shadow flex items-center gap-2"
            >
              <LineIcon className="w-5 h-5" />
              <span>สั่งผ่าน LINE</span>
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden text-green-800 p-2 text-2xl"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-green-900 text-white px-5 py-4 space-y-3 font-bold text-sm border-t border-green-800">
            <a
              href="#menu"
              className="block py-2 border-b border-green-800"
              onClick={() => setMobileMenuOpen(false)}
            >
              🍈 รายการทุเรียนรอบนี้
            </a>
            <a
              href="#ripeness"
              className="block py-2 border-b border-green-800"
              onClick={() => setMobileMenuOpen(false)}
            >
              🥑 เลือกระดับความสุก
            </a>
            <a
              href="/tracking"
              className="block py-2 border-b border-green-800"
              onClick={() => setMobileMenuOpen(false)}
            >
              📦 ตรวจสอบสถานะจัดส่ง
            </a>
            <a
              href="/claim"
              className="block py-2 text-yellow-300 border-b border-green-800"
              onClick={() => setMobileMenuOpen(false)}
            >
              🛡️ ศูนย์แจ้งเคลม 100%
            </a>
            <a
              href="/admin"
              className="block py-2 text-green-300"
              onClick={() => setMobileMenuOpen(false)}
            >
              ⚙️ ระบบหลังบ้าน (Admin)
            </a>
            <a
              href={`tel:${shopInfo.phone.replace(/-/g, "")}`}
              className="block text-center bg-yellow-400 text-green-950 py-3 rounded-full font-black mt-2 text-base"
              onClick={() => setMobileMenuOpen(false)}
            >
              📞 โทรสั่งซื้อทันที {shopInfo.phone}
            </a>
          </div>
        )}
      </header>
    </>
  );
}

// ===================== HERO SECTION =====================
function HeroBanner({ round }: { round: Round }) {
  return (
    <section className="relative bg-gradient-to-br from-green-800 via-green-700 to-green-900 text-white overflow-hidden py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Text */}
          <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-yellow-400 text-green-950 px-4 py-1.5 rounded-full font-black text-xs sm:text-sm shadow">
              <span>🛻</span>
              <span>รถกระบะวิ่งรับตรงจากสวนระยอง - จันทบุรี</span>
            </div>

            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white leading-tight">
              ทุเรียนแก่จัด คัดพูทอง <br />
              <span className="text-yellow-300 drop-shadow-md">
                หวานมัน สดใหม่ ส่งถึงบ้าน!
              </span>
            </h2>

            <p className="text-green-100 text-sm sm:text-base leading-relaxed max-w-xl mx-auto lg:mx-0 font-medium">
              หมดปัญหาทุเรียนอ่อน ทุเรียนขาว! ที่ <strong>{shopInfo.name}</strong> เราคัดเฉพาะทุเรียนแก่จัด 85%+ ไม่ป้ายยาเร่งสุก 
              กรอบนอกนุ่มใน หอมหวานมันกลมกล่อม มีรับประกันเนื้อทุกลูก เคลมฟรี 100%
            </p>

            {/* Delivery Round Alert Box */}
            <div className="bg-white/10 backdrop-blur-md border-2 border-yellow-400/60 rounded-2xl p-4 sm:p-5 max-w-lg mx-auto lg:mx-0 text-left shadow-lg">
              <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-yellow-300 mb-2">
                <span>📢 {round.name}</span>
                <span className="bg-yellow-400 text-green-950 px-2 py-0.5 rounded-full font-black text-xs">
                  เหลือ {round.quotaRemaining} ลูก
                </span>
              </div>
              <p className="text-xs text-white/90 mb-2">
                🛣️ {round.truckRoute}
              </p>
              <div className="flex items-center justify-between text-xs text-green-200 border-t border-white/15 pt-2">
                <span>วันวิ่งรับของ: <strong>{round.harvestDate}</strong></span>
                <span>รอบส่งถึงบ้าน: <strong>{round.deliveryDate}</strong></span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-2">
              <a
                href="#menu"
                className="px-8 py-4 rounded-full bg-yellow-400 hover:bg-yellow-300 text-green-950 font-black text-base transition shadow-xl transform hover:-translate-y-0.5 text-center"
              >
                🛒 ดูรายการทุเรียน & สั่งซื้อ
              </a>
              <a
                href={`https://line.me/R/ti/p/${shopInfo.lineOA}`}
                target="_blank"
                rel="noreferrer"
                className="px-8 py-4 rounded-full bg-[#06C755] hover:bg-[#05b34c] text-white font-black text-base transition shadow-xl text-center flex items-center justify-center gap-2"
              >
                <LineIcon className="w-6 h-6" />
                <span>สั่งทาง LINE แอดมินตอบไว</span>
              </a>
            </div>
          </div>

          {/* Right Durian Image (เน้นรูปเนื้อทุเรียนเหลืองทองน่ากินเต็มตา!) */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md">
              <div className="rounded-3xl overflow-hidden border-4 border-yellow-400 shadow-2xl bg-black">
                <img
                  src="https://images.unsplash.com/photo-1519544442-93857b48665e?auto=format&fit=crop&w=800&q=85"
                  alt="ทุเรียนวินคิน หมอนทองเนื้อทอง"
                  className="w-full h-80 sm:h-96 object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>

              {/* Floating Quality Stamp */}
              <div className="absolute -bottom-5 -left-4 sm:left-4 bg-yellow-400 text-green-950 p-4 rounded-2xl shadow-2xl border-2 border-white text-center">
                <span className="text-2xl block mb-0.5">⭐</span>
                <p className="font-black text-sm leading-tight">การันตีเนื้อ 100%</p>
                <p className="text-[10px] font-bold text-green-900">ไม่อ่อน ไม่เละ เคลมได้</p>
              </div>

              {/* Floating Sweetness Badge */}
              <div className="absolute top-4 right-4 bg-green-900/90 text-yellow-300 px-3 py-1.5 rounded-full shadow-lg font-black text-xs border border-yellow-400">
                🍯 หวานมัน 34° Brix
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================== RIPENESS GUIDE =====================
function RipenessGuide() {
  const levels = [
    {
      badge: "ขายดีอันดับ 1 🔥",
      badgeColor: "bg-red-500 text-white",
      name: "1. กรอบนอก นุ่มใน (ไก่ฉีก)",
      desc: "เคี้ยวด้านนอกมีความกรอบสะดุ้งฟัน ด้านในเนื้อนุ่มเนียน หอมละมุน ไม่หวานเลี่ยน กินเพลินมาก!",
      sweetness: "⭐⭐⭐⭐",
      creaminess: "⭐⭐⭐⭐",
    },
    {
      badge: "สายหวานมัน 🍯",
      badgeColor: "bg-amber-500 text-white",
      name: "2. สุกพอดีกิน (เนื้อเนียนครีม)",
      desc: "เนื้อสีเหลืองทองเข้ม สัมผัสเนียนนุ่มเหมือนคัสตาร์ด หวานมันจัดเต็ม กลิ่นหอมฟุ้งติดปาก",
      sweetness: "⭐⭐⭐⭐⭐",
      creaminess: "⭐⭐⭐⭐⭐",
    },
    {
      badge: "หวานฉ่ำสะใจ 🍮",
      badgeColor: "bg-yellow-500 text-green-950",
      name: "3. สุกนิ่ม (เนื้อปลาร้าอ่อนๆ)",
      desc: "เนื้อสุกงอมธรรมชาติ นุ่มเยิ้มละลายในปาก รสหวานจัดลึก เหมาะกับคนชอบทุเรียนหวานฉ่ำ",
      sweetness: "⭐⭐⭐⭐⭐",
      creaminess: "⭐⭐⭐",
    },
  ];

  return (
    <section id="ripeness" className="py-14 bg-amber-50/80 border-b border-amber-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-xl mx-auto mb-10">
          <span className="bg-yellow-400 text-green-950 text-xs font-black px-3 py-1 rounded-full uppercase">
            Taste & Texture
          </span>
          <h3 className="text-2xl sm:text-3xl font-black text-gray-900 mt-2 mb-2">
            🥑 ชอบเนื้อแบบไหน? วินคินจัดให้ตรงใจคุณ
          </h3>
          <p className="text-sm text-gray-600">
            ระบุระดับความสุกในขั้นตอนสั่งซื้อ ทีมงานจะใช้ความชำนาญคัดพูตามที่คุณชอบเป๊ะ ๆ
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {levels.map((lvl, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl p-6 shadow-md border-2 border-yellow-200 hover:border-yellow-400 transition"
            >
              <div className="flex justify-between items-center mb-3">
                <span className={`text-xs font-black px-3 py-1 rounded-full ${lvl.badgeColor}`}>
                  {lvl.badge}
                </span>
                <span className="text-xl">🍈</span>
              </div>
              <h4 className="text-lg font-black text-gray-900 mb-2">{lvl.name}</h4>
              <p className="text-xs text-gray-600 leading-relaxed mb-4">{lvl.desc}</p>
              <div className="bg-amber-50 rounded-xl p-3 text-xs space-y-1 font-bold text-gray-700">
                <div className="flex justify-between">
                  <span>ระดับความหวาน:</span>
                  <span>{lvl.sweetness}</span>
                </div>
                <div className="flex justify-between">
                  <span>ความมันครีมมี่:</span>
                  <span>{lvl.creaminess}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================== PRODUCT CARD =====================
function ProductCard({
  product,
  onOrder,
}: {
  product: Product;
  onOrder: (p: Product) => void;
}) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border-2 border-yellow-300 shadow-md hover:shadow-xl transition-all duration-300 food-card flex flex-col justify-between">
      <div>
        {/* Real Fruit Photo */}
        <div className="relative aspect-[4/3] overflow-hidden bg-amber-50">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
          />
          {product.badge && (
            <span className="absolute top-3 left-3 bg-red-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-md">
              🔥 {product.badge}
            </span>
          )}
          <span className="absolute bottom-3 left-3 bg-green-900/90 text-yellow-300 text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm">
            📍 {product.origin}
          </span>
        </div>

        {/* Content */}
        <div className="p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-amber-800">
            <span>พันธุ์: {product.variety}</span>
            <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-mono">
              ความหวาน {product.brix}
            </span>
          </div>

          <h4 className="font-black text-lg text-gray-900 leading-tight">
            {product.name}
          </h4>

          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
            {product.description}
          </p>

          <div className="bg-amber-50/70 rounded-xl p-2.5 text-xs text-gray-700 space-y-1 font-medium border border-amber-200">
            <div className="flex justify-between">
              <span className="text-gray-500">ขนาดผล:</span>
              <span className="font-bold text-gray-800">{product.weight}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">เนื้อสัมผัส:</span>
              <span className="font-bold text-green-800">{product.specs.texture}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Price & Buttons */}
      <div className="p-5 pt-0">
        <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
          <div>
            {product.marketPrice && (
              <span className="text-xs text-gray-400 line-through block font-mono">
                ฿{product.marketPrice.toLocaleString()}
              </span>
            )}
            <div className="flex items-baseline">
              <span className="text-2xl font-black text-green-800">
                ฿{product.price.toLocaleString()}
              </span>
              <span className="text-xs text-gray-500 ml-1">/{product.unit}</span>
            </div>
          </div>

          <button
            disabled={!product.isAvailable}
            onClick={() => onOrder(product)}
            className={`px-6 py-3 rounded-full font-black text-sm shadow-md transition ${
              product.isAvailable
                ? "bg-yellow-400 hover:bg-yellow-300 text-green-950 active:scale-95"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            }`}
          >
            {product.isAvailable ? "🛒 สั่งซื้อทันที" : "หมดชั่วคราว"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===================== PRODUCT MENU =====================
function ProductMenu({
  products,
  onOrder,
}: {
  products: Product[];
  onOrder: (p: Product) => void;
}) {
  const [filter, setFilter] = useState("all");
  const varieties = ["all", ...new Set(products.map((p) => p.variety))];

  const filtered =
    filter === "all" ? products : products.filter((p) => p.variety === filter);

  return (
    <section id="menu" className="py-16 max-w-7xl mx-auto px-4 sm:px-6">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <span className="bg-green-700 text-yellow-300 text-xs font-black px-3 py-1 rounded-full uppercase">
          Fresh Durian Menu
        </span>
        <h3 className="text-3xl font-black text-gray-900 mt-2 mb-2">
          🍈 เมนูทุเรียนคัดสดพร้อมส่งรอบนี้
        </h3>
        <p className="text-sm text-gray-600">
          คัดพูทองเน้น ๆ ส่งตรงจากสวนระยองและจันทบุรี มีทั้งแบบชั่งทั้งลูกและแกะเนื้อพร้อมทาน
        </p>

        {/* Filter Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {varieties.map((v) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-4 py-2 rounded-full text-xs font-black transition ${
                filter === v
                  ? "bg-green-800 text-yellow-300 shadow-md"
                  : "bg-white text-gray-700 border-2 border-yellow-300 hover:bg-amber-50"
              }`}
            >
              {v === "all" ? "ทั้งหมดทุกลูก" : `พันธุ์ ${v}`}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filtered.map((p) => (
          <ProductCard key={p.id} product={p} onOrder={onOrder} />
        ))}
      </div>
    </section>
  );
}

// ===================== WHY CHOOSE US =====================
function WhyUs() {
  const points = [
    {
      icon: "🛻",
      title: "รถกระบะวิ่งรับตรงจากสวน",
      desc: "ทีมงานทุเรียนวินคินวิ่งรถไปคัดเองที่หน้าสวนระยองและจันทบุรี ไม่ผ่านพ่อค้าคนกลาง ได้ทุเรียนสดใหม่ที่สุด",
    },
    {
      icon: "🍈",
      title: "แก่จัด 85%+ ไม่ป้ายยา",
      desc: "ไม่ตัดทุเรียนอ่อนเด็ดขาด ไม่ใช้น้ำยาเร่งสุก สุกหวานมันตามธรรมชาติ กลิ่นหอมละมุน เม็ดลีบ",
    },
    {
      icon: "❄️",
      title: "จัดส่งด่วนคุมอุณหภูมิ",
      desc: "ส่งด้วยรถห้องเย็นหรือกล่องล็อกขั้วเจาะรูระบายอากาศ ป้องกันเนื้อเละ ช้ำ หรือเน่าเสียระหว่างทาง",
    },
    {
      icon: "🛡️",
      title: "รับประกันเคลม 100%",
      desc: "เจอปัญหาเนื้อขาว อ่อน หนอน ถ่ายรูปส่งมาทาง LINE หรือหน้าเว็บ เคลมเปลี่ยนลูกใหม่หรือคืนเงินทันที",
    },
  ];

  return (
    <section id="why-us" className="py-16 bg-gradient-to-br from-green-900 to-green-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-xl mx-auto mb-12">
          <span className="bg-yellow-400 text-green-950 text-xs font-black px-3 py-1 rounded-full uppercase">
            Quality Guarantee
          </span>
          <h3 className="text-2xl sm:text-3xl font-black mt-2 mb-2">
            ⭐ 4 เหตุผลที่ต้องสั่งกับ &quot;ทุเรียนวินคิน&quot;
          </h3>
          <p className="text-sm text-green-100">
            เราคัดสรรด้วยความจริงใจ ให้คุณได้กินทุเรียนอร่อยสมราคา ไม่ต้องเสี่ยงดวง
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {points.map((pt, i) => (
            <div
              key={i}
              className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border-2 border-yellow-400/40 text-center hover:bg-white/15 transition"
            >
              <div className="text-4xl mb-3">{pt.icon}</div>
              <h4 className="text-base font-black text-yellow-300 mb-2">{pt.title}</h4>
              <p className="text-xs text-green-100 leading-relaxed">{pt.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================== ORDER MODAL =====================
function OrderModal({
  product,
  roundId,
  onSuccess,
  onClose,
}: {
  product: Product;
  roundId: string;
  onSuccess: (order: Order) => void;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(1);
  const [ripenessPref, setRipenessPref] = useState("กรอบนอกนุ่มใน (ไก่ฉีก)");
  const [name, setName] = useState("");
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
          items: [{ productId: product.id, qty }],
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
    const grandTotal = createdOrder.totalPrice + createdOrder.shippingCost;
    return (
      <div
        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 text-center shadow-2xl border-4 border-yellow-400 animate-in"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={shopInfo.logo}
            alt={shopInfo.name}
            className="w-20 h-20 rounded-full border-2 border-yellow-400 mx-auto mb-3 object-cover shadow-md"
          />
          <h4 className="text-2xl font-black text-green-800 mb-1">
            สั่งจองสำเร็จแล้วครับ! 🎉
          </h4>
          <p className="text-xs text-gray-500 mb-4">
            รหัสออเดอร์:{" "}
            <strong className="font-mono text-green-900 text-sm">
              {createdOrder.id}
            </strong>
          </p>

          <div className="bg-amber-50 border-2 border-yellow-300 rounded-2xl p-4 text-xs text-gray-800 text-left space-y-1.5 mb-5">
            <p className="font-black text-amber-900">📌 รายละเอียดการชำระเงิน:</p>
            <p>
              ยอดชำระสุทธิ:{" "}
              <strong className="text-green-800 font-black text-base">
                ฿{grandTotal.toLocaleString()}
              </strong>
            </p>
            <p>
              ธนาคาร: <strong>{shopInfo.bankAccount.bank}</strong>
            </p>
            <p>
              เลขบัญชี:{" "}
              <strong className="font-mono text-gray-900 text-sm">
                {shopInfo.bankAccount.number}
              </strong>
            </p>
            <p>
              พร้อมเพย์:{" "}
              <strong className="font-mono text-green-700 text-sm">
                {shopInfo.bankAccount.promptPay}
              </strong>
            </p>
            <p>
              ชื่อบัญชี: <strong>{shopInfo.bankAccount.name}</strong>
            </p>
            <p className="text-[11px] text-gray-500 pt-1 border-t border-amber-200">
              *เมื่อโอนแล้ว กรุณาส่งสลิปผ่านทาง LINE OA{" "}
              <strong>{shopInfo.lineOA}</strong> หรือโทร{" "}
              <strong>{shopInfo.phone}</strong> เพื่อให้แอดมินล็อกคิวส่งของทันที
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <a
                href={`https://line.me/R/ti/p/${shopInfo.lineOA}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3.5 rounded-full bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-black transition flex items-center justify-center gap-1.5 shadow"
              >
                <LineIcon className="w-5 h-5" />
                <span>ส่งสลิปผ่าน LINE</span>
              </a>
              <a
                href={`/tracking?id=${encodeURIComponent(createdOrder.id)}`}
                className="px-4 py-3.5 rounded-full bg-yellow-400 hover:bg-yellow-300 text-green-950 text-xs font-black transition flex items-center justify-center"
              >
                📦 เช็กสถานะ
              </a>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-full bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border-2 border-yellow-400"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-green-800 text-white px-6 py-4 flex items-center justify-between border-b-2 border-yellow-400 rounded-t-3xl sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <img
              src={shopInfo.logo}
              alt={shopInfo.name}
              className="w-10 h-10 rounded-full border border-yellow-400 object-cover bg-white"
            />
            <div>
              <h4 className="font-black text-base text-yellow-300">สั่งจองกับ {shopInfo.name}</h4>
              <p className="text-[11px] text-green-200 font-mono">โทร. {shopInfo.phone}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:text-yellow-300 text-xl font-bold">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Product Mini Spec */}
          <div className="flex gap-4 p-3 bg-amber-50/70 border border-yellow-200 rounded-2xl items-center">
            <img
              src={product.image}
              alt={product.name}
              className="w-16 h-16 object-cover rounded-xl border border-yellow-300"
            />
            <div className="flex-1 min-w-0">
              <h5 className="font-black text-gray-900 text-sm truncate">{product.name}</h5>
              <p className="text-xs text-amber-900 font-bold">{product.origin} • {product.weight}</p>
              <p className="font-black text-green-800 text-base mt-0.5">
                ฿{product.price.toLocaleString()} /{product.unit}
              </p>
            </div>
          </div>

          {/* ระดับความสุก */}
          <div>
            <label className="block text-xs font-black text-gray-800 mb-1.5">
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
                  className={`p-2.5 rounded-xl border-2 text-center cursor-pointer transition text-xs font-bold ${
                    ripenessPref === rf
                      ? "border-green-700 bg-green-50 text-green-900 shadow-sm"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
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
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-200">
            <span className="text-xs font-black text-gray-700">จำนวนที่ต้องการสั่ง</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-8 h-8 bg-white border border-gray-300 rounded-full text-sm font-black hover:bg-gray-100 shadow-sm"
              >
                −
              </button>
              <span className="font-black text-base w-6 text-center">{qty}</span>
              <button
                type="button"
                onClick={() => setQty(qty + 1)}
                className="w-8 h-8 bg-green-700 text-white rounded-full text-sm font-black hover:bg-green-600 shadow-sm"
              >
                +
              </button>
              <span className="text-xs text-gray-500 font-bold">{product.unit}</span>
            </div>
          </div>

          {/* ข้อมูลจัดส่ง */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-black text-gray-700 mb-1">
                ชื่อ-นามสกุล ผู้รับ *
              </label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น คุณสมชาย ใจดี"
                className="w-full border-2 border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:border-green-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-gray-700 mb-1">
                เบอร์โทรศัพท์ (สำหรับขนส่งโทรส่งของ) *
              </label>
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08X-XXX-XXXX"
                className="w-full border-2 border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:border-green-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-gray-700 mb-1">
                ที่อยู่จัดส่งละเอียด *
              </label>
              <textarea
                required
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
                className="w-full border-2 border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:border-green-700 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* วิธีจัดส่ง */}
          <div>
            <label className="block text-xs font-black text-gray-700 mb-1.5">
              วิธีการจัดส่ง
            </label>
            <div className="space-y-1.5">
              {shopInfo.shippingMethods.map((s) => (
                <label
                  key={s.name}
                  className={`flex items-start justify-between p-2.5 rounded-xl border-2 cursor-pointer text-xs ${
                    shipping === s.name
                      ? "border-green-700 bg-green-50 font-bold text-green-950"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="shippingMethod"
                      value={s.name}
                      checked={shipping === s.name}
                      onChange={() => setShipping(s.name)}
                      className="accent-green-700 mt-0.5"
                    />
                    <div>
                      <span>{s.name}</span>
                      <p className="text-[10px] text-gray-400 font-normal">{s.note}</p>
                    </div>
                  </div>
                  <span className="font-bold">{s.price === 0 ? "ฟรี" : `฿${s.price}`}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ยอดรวม */}
          <div className="bg-yellow-50 rounded-2xl p-4 flex items-center justify-between border-2 border-yellow-300">
            <div>
              <span className="text-[10px] text-amber-800 font-bold uppercase block">ยอดรวมทั้งสิ้น (รวมค่าส่ง)</span>
              <span className="text-2xl font-black text-green-800">
                ฿{totalPrice.toLocaleString()}
              </span>
            </div>
            <span className="text-xs uppercase font-black text-green-800 bg-green-100 px-3 py-1 rounded-full border border-green-300">
              🛡️ การันตีเคลม 100%
            </span>
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold p-3 rounded-xl">
              ⚠️ {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-60 text-green-950 py-4 rounded-full text-base font-black shadow-lg transition active:scale-98"
          >
            {submitting
              ? "⏳ กำลังบันทึกคำสั่งจอง..."
              : `✓ ยืนยันการสั่งซื้อ ฿${totalPrice.toLocaleString()}`}
          </button>
        </form>
      </div>
    </div>
  );
}

// ===================== FOOTER =====================
function Footer() {
  return (
    <footer id="contact" className="bg-green-950 text-white/80 py-14 border-t-4 border-yellow-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-green-800">
          {/* Brand Col */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={shopInfo.logo}
                alt={shopInfo.name}
                className="w-12 h-12 rounded-full border-2 border-yellow-400 bg-white object-cover"
              />
              <div>
                <h4 className="text-lg font-black text-white">{shopInfo.name}</h4>
                <p className="text-xs text-yellow-300 font-mono">โทร. {shopInfo.phone}</p>
              </div>
            </div>
            <p className="text-green-100 text-xs leading-relaxed font-light">
              {shopInfo.description}
            </p>
          </div>

          {/* Contact Col */}
          <div className="space-y-2">
            <h5 className="font-black text-yellow-300 uppercase text-xs mb-3">
              ติดต่อสอบถาม & สั่งซื้อ
            </h5>
            <p>เบอร์โทรศัพท์: <strong className="text-white font-mono text-sm">{shopInfo.phone}</strong></p>
            <p>LINE OA: <strong className="text-yellow-300 font-mono">{shopInfo.lineOA}</strong></p>
            <p>เวลาทำการ: ทุกวัน 08:00 - 21:00 น.</p>
          </div>

          {/* Menu Col */}
          <div className="space-y-2">
            <h5 className="font-black text-yellow-300 uppercase text-xs mb-3">
              ระบบและบริการ
            </h5>
            <a href="/tracking" className="block hover:text-white transition">
              📦 เช็กสถานะพัสดุ (Tracking)
            </a>
            <a href="/claim" className="block text-yellow-300 hover:text-yellow-200 transition font-bold">
              🛡️ ศูนย์รับประกันและแจ้งเคลม 100%
            </a>
            <a href="/admin" className="block hover:text-white transition">
              ⚙️ เข้าสู่ระบบหลังบ้าน (Admin)
            </a>
          </div>

          {/* Bank Info */}
          <div className="bg-white/10 rounded-2xl p-4 border border-yellow-400/40 space-y-1.5">
            <h5 className="font-black text-yellow-300 uppercase text-xs">
              บัญชีชำระเงินทางการ
            </h5>
            <p className="text-white font-bold">{shopInfo.bankAccount.bank}</p>
            <p className="font-mono text-white text-sm font-black">{shopInfo.bankAccount.number}</p>
            <p className="text-yellow-300 text-xs font-mono">พร้อมเพย์: {shopInfo.bankAccount.promptPay}</p>
            <p className="text-green-200 text-[10px]">{shopInfo.bankAccount.name}</p>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-green-300 text-[11px]">
          <p>© 2026 {shopInfo.name}. All rights reserved.</p>
          <p>คัดสดจากสวน วิ่งส่งตรงถึงบ้านคุณ การันตีคุณภาพ 100%</p>
        </div>
      </div>
    </footer>
  );
}

// ===================== FLOATING LINE & CALL =====================
function FloatingActionButtons() {
  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2.5">
      <a
        href={`https://line.me/R/ti/p/${shopInfo.lineOA}`}
        target="_blank"
        rel="noreferrer"
        className="bg-[#06C755] hover:bg-[#05b34c] text-white p-3.5 sm:px-5 sm:py-3.5 rounded-full shadow-2xl flex items-center gap-2 hover:scale-105 transition-all"
        aria-label="Contact LINE"
      >
        <LineIcon className="w-6 h-6" />
        <span className="hidden sm:inline font-black text-xs">สั่งผ่าน LINE</span>
      </a>
      <a
        href={`tel:${shopInfo.phone.replace(/-/g, "")}`}
        className="bg-yellow-400 hover:bg-yellow-300 text-green-950 p-3.5 sm:px-5 sm:py-3.5 rounded-full shadow-2xl flex items-center gap-2 hover:scale-105 transition-all text-xs font-black"
        aria-label="Call phone"
      >
        <span>📞</span>
        <span className="hidden sm:inline font-mono">{shopInfo.phone}</span>
      </a>
    </div>
  );
}

// ===================== MAIN PAGE =====================
export default function Home() {
  const [products, setProducts] = useState<Product[]>(defaultProducts);
  const [round, setRound] = useState<Round>(defaultRound);
  const [orderProduct, setOrderProduct] = useState<Product | null>(null);

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
        }
      })
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-[#faf6eb]">
      <Navbar />
      <HeroBanner round={round} />
      <RipenessGuide />
      <ProductMenu products={products} onOrder={setOrderProduct} />
      <WhyUs />
      <Footer />
      <FloatingActionButtons />

      {orderProduct && (
        <OrderModal
          product={orderProduct}
          roundId={round.id}
          onSuccess={(createdOrder) => {
            const qtyOrdered = createdOrder.items.reduce((s, it) => s + it.qty, 0);
            setRound((prev) => ({
              ...prev,
              quotaRemaining: Math.max(0, prev.quotaRemaining - qtyOrdered),
            }));
          }}
          onClose={() => setOrderProduct(null)}
        />
      )}
    </main>
  );
}
