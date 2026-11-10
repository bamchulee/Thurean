"use client";

import { useState } from "react";
import { products, currentRound, shopInfo } from "../data/mock";
import type { Product } from "../data/mock";
import {
  LuxuryQualitySeal,
  ColdChainBadge,
  GuaranteeShield,
} from "../components/DurianGraphics";

// ===================== NAVIGATION =====================
function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Top Announcement Bar */}
      <div className="bg-[#0b1f13] text-[#c5a059] border-b border-[#c5a059]/20 text-[11px] sm:text-xs py-2 px-4 tracking-wider">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
            <span className="font-semibold text-white">
              {currentRound.name}
            </span>
            <span className="hidden md:inline text-white/40">•</span>
            <span className="hidden md:inline text-white/80">
              โทรสั่งด่วน: <strong className="text-[#e6c875] font-mono">{shopInfo.phone}</strong>
            </span>
          </div>
          <div className="flex items-center gap-4 text-white/80">
            <span className="hidden sm:inline">การันตีเนื้อ 100% เคลมได้ทุกลูก</span>
            <a
              href={`tel:${shopInfo.phone.replace(/-/g, "")}`}
              className="text-[#e6c875] font-bold font-mono hover:text-white transition"
            >
              📞 {shopInfo.phone}
            </a>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <header className="bg-[#081c10] border-b border-white/10 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          {/* Brand Logo with Real Image */}
          <a href="#" className="flex items-center gap-3 group">
            <img
              src={shopInfo.logo}
              alt={shopInfo.name}
              className="w-14 h-14 rounded-full border-2 border-[#c5a059] object-cover shadow-md group-hover:scale-105 transition-transform bg-white"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-xl sm:text-2xl font-black text-white group-hover:text-[#e6c875] transition">
                  {shopInfo.name}
                </span>
                <span className="hidden sm:inline-block bg-[#166534] text-[#e6c875] text-[10px] font-bold px-2 py-0.5 rounded border border-[#c5a059]/40">
                  รถกระบะวิ่งตรงจากสวน
                </span>
              </div>
              <p className="text-[11px] text-[#c5a059] font-mono tracking-wider font-semibold">
                โทร. {shopInfo.phone}
              </p>
            </div>
          </a>

          {/* Desktop Menu */}
          <nav className="hidden lg:flex items-center gap-8 text-xs uppercase tracking-wider font-medium text-white/80">
            <a href="#collection" className="hover:text-[#c5a059] transition">
              รายการทุเรียน
            </a>
            <a href="#about-us" className="hover:text-[#c5a059] transition">
              ทำไมต้องวินคิน
            </a>
            <a href="#ripeness" className="hover:text-[#c5a059] transition">
              ระดับความสุก
            </a>
            <a href="/tracking" className="hover:text-[#c5a059] transition">
              ตรวจสอบสถานะจัดส่ง
            </a>
            <a href="/claim" className="text-[#c5a059] hover:text-[#e6c875] transition flex items-center gap-1.5 font-bold">
              <GuaranteeShield className="w-4 h-4 text-[#c5a059]" />
              ศูนย์เคลม 100%
            </a>
          </nav>

          {/* Action Button */}
          <div className="hidden sm:flex items-center gap-3">
            <a
              href={`https://line.me/R/ti/p/${shopInfo.lineOA}`}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 rounded border border-[#22c55e] bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-xs tracking-wider transition shadow-sm flex items-center gap-1.5"
            >
              <span>💬</span> แอด LINE ร้าน
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden text-white p-2 text-xl"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0a2315] border-t border-white/10 px-5 py-4 space-y-3 text-xs tracking-wider uppercase font-medium text-white/80">
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <img
                src={shopInfo.logo}
                alt={shopInfo.name}
                className="w-10 h-10 rounded-full border border-[#c5a059] bg-white object-cover"
              />
              <div>
                <p className="font-bold text-white text-sm">{shopInfo.name}</p>
                <p className="text-[#c5a059] font-mono text-xs">{shopInfo.phone}</p>
              </div>
            </div>
            <a
              href="#collection"
              className="block py-2 border-b border-white/5"
              onClick={() => setMobileMenuOpen(false)}
            >
              รายการทุเรียนรอบนี้
            </a>
            <a
              href="#about-us"
              className="block py-2 border-b border-white/5"
              onClick={() => setMobileMenuOpen(false)}
            >
              สายวิ่งรถกระบะรับตรงจากสวน
            </a>
            <a
              href="#ripeness"
              className="block py-2 border-b border-white/5"
              onClick={() => setMobileMenuOpen(false)}
            >
              คู่มือระดับความสุก
            </a>
            <a
              href="/tracking"
              className="block py-2 border-b border-white/5"
              onClick={() => setMobileMenuOpen(false)}
            >
              ตรวจสอบสถานะจัดส่ง
            </a>
            <a
              href="/claim"
              className="block py-2 text-[#c5a059] font-bold border-b border-white/5"
              onClick={() => setMobileMenuOpen(false)}
            >
              ศูนย์รับประกันและเคลม 100%
            </a>
            <a
              href="/admin"
              className="block py-2 text-white/40"
              onClick={() => setMobileMenuOpen(false)}
            >
              ระบบหลังบ้าน (Admin)
            </a>
            <a
              href={`tel:${shopInfo.phone.replace(/-/g, "")}`}
              className="block text-center bg-[#c5a059] text-[#081c10] py-2.5 rounded font-bold mt-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              📞 โทรสั่งเลย {shopInfo.phone}
            </a>
          </div>
        )}
      </header>
    </>
  );
}

// ===================== HERO SECTION =====================
function HeroBanner() {
  return (
    <section className="relative bg-[#081c10] text-white overflow-hidden py-14 sm:py-20 border-b border-[#c5a059]/20">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#c5a059_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 rounded-full border border-[#22c55e]/60 bg-[#14532d]/60 text-[#86efac] text-[11px] font-semibold tracking-wider flex items-center gap-1.5">
                <span>🛻</span> รถกระบะวิ่งคัดตรงจากสวนระยอง-จันทบุรี
              </span>
              <ColdChainBadge />
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-serif font-black tracking-tight text-white leading-[1.15]">
                {shopInfo.name} <br />
                <span className="text-[#e6c875] font-normal italic text-2xl sm:text-4xl lg:text-5xl">
                  คัดสดแก่จัด ส่งตรงถึงหน้าบ้าน
                </span>
              </h1>
            </div>

            <p className="text-white/75 text-sm sm:text-base leading-relaxed max-w-xl font-light">
              เราวิ่งรถกระบะไปรับทุเรียนจากสวนคุณภาพด้วยตัวเอง คัดเฉพาะผลแก่จัด 85%+ ไม่ป้ายยาเร่งสุก 
              แกะสดใหม่พร้อมจัดส่งด่วน หรือส่งเหมาลูกทั้งผล การันตีเนื้อทุกลูก พบปัญหาเคลมฟรี 100%
            </p>

            {/* Current Batch Quota Box */}
            <div className="bg-[#0f2a1b] border border-[#c5a059]/30 rounded-lg p-4 sm:p-5 max-w-lg shadow-inner">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-[#c5a059] font-bold uppercase tracking-wider">
                  📢 {currentRound.name}
                </span>
                <span className="text-white/70">
                  เหลือโควตา: <strong className="text-[#e6c875] font-mono text-sm">{currentRound.quotaRemaining}</strong>/{currentRound.totalQuota} ลูก
                </span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden mb-3">
                <div
                  className="bg-gradient-to-r from-[#16a34a] via-[#c5a059] to-[#e6c875] h-full rounded-full transition-all duration-500"
                  style={{ width: `${((currentRound.totalQuota - currentRound.quotaRemaining) / currentRound.totalQuota) * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-[#86efac] font-mono mb-2">
                🛣️ {currentRound.truckRoute}
              </p>
              <div className="flex items-center justify-between text-[11px] text-white/60 border-t border-white/10 pt-2">
                <span>วันวิ่งรับของ: <strong>{currentRound.harvestDate}</strong></span>
                <span>รอบส่งถึงบ้าน: <strong>{currentRound.deliveryDate}</strong></span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <a
                href="#collection"
                className="px-8 py-3.5 rounded bg-gradient-to-r from-[#c5a059] via-[#d4af37] to-[#c5a059] text-[#081c10] font-black text-xs uppercase tracking-wider text-center hover:opacity-95 transition shadow-lg"
              >
                🛒 สั่งจองทุเรียนรอบนี้
              </a>
              <a
                href={`tel:${shopInfo.phone.replace(/-/g, "")}`}
                className="px-6 py-3.5 rounded border border-white/20 hover:border-[#c5a059] text-white font-bold text-xs uppercase tracking-wider text-center transition flex items-center justify-center gap-2"
              >
                <span>📞</span> โทร. {shopInfo.phone}
              </a>
            </div>
          </div>

          {/* Right Visual Image with Real Logo & Real Photo */}
          <div className="lg:col-span-5 relative flex justify-center">
            <div className="relative w-full max-w-md rounded-2xl overflow-hidden border-2 border-[#c5a059]/40 shadow-2xl bg-[#0f291a]">
              {/* Product Hero Image */}
              <img
                src="https://images.unsplash.com/photo-1519544442-93857b48665e?auto=format&fit=crop&w=1000&q=85"
                alt="ทุเรียนวินคิน"
                className="w-full h-[400px] object-cover object-center filter brightness-95"
              />

              {/* Subtle Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#081c10] via-transparent to-transparent opacity-85" />

              {/* Logo Badge Overlay in the Center Top */}
              <div className="absolute top-4 left-4 flex items-center gap-3 bg-[#081c10]/90 backdrop-blur px-3 py-2 rounded-xl border border-[#c5a059]/50 shadow-lg">
                <img
                  src={shopInfo.logo}
                  alt={shopInfo.name}
                  className="w-12 h-12 rounded-full border border-[#c5a059] object-cover bg-white"
                />
                <div>
                  <p className="font-bold text-sm text-white">{shopInfo.name}</p>
                  <p className="text-[10px] text-[#e6c875] font-mono">082-282-4238</p>
                </div>
              </div>

              {/* Bottom Caption */}
              <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-[#c5a059] font-bold block mb-0.5">
                    คัดสรรโดย ทุเรียนวินคิน
                  </span>
                  <p className="text-white font-serif text-lg font-bold">
                    หมอนทองระยอง คัดพูทองเน้นๆ
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-white/70 block">การันตีความหวาน</span>
                  <span className="text-[#e6c875] font-mono text-base font-bold">34° Brix</span>
                </div>
              </div>

              {/* Seal */}
              <div className="absolute top-4 right-4">
                <LuxuryQualitySeal className="w-20 h-20" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================== ABOUT / VALUE PROPOSITION =====================
function AboutWinkin() {
  const pillars = [
    {
      no: "01",
      icon: "🛻",
      title: "วิ่งรถกระบะรับตรงจากสวน",
      desc: "ทีมงานทุเรียนวินคินลงพื้นที่เองที่ระยองและจันทบุรี คัดผลต่อผลที่หน้าสวน ไม่ผ่านคนกลางหลายต่อ ได้ของสดใหม่ที่สุด",
    },
    {
      no: "02",
      icon: "🍈",
      title: "คัดแก่จัด 85%+ ไม่ป้ายยา",
      desc: "ไม่ตัดทุเรียนอ่อน ไม่ใช้น้ำยาเร่งสุก ปล่อยให้สุกตามธรรมชาติ เนื้อจึงหวานมัน มีกลิ่นหอมเฉพาะตัว เม็ดลีบ",
    },
    {
      no: "03",
      icon: "❄️",
      title: "จัดส่งด่วนคุมอุณหภูมิ",
      desc: "ส่งด้วยรถห้องเย็นหรือบรรจุกล่องล็อกขั้วเจาะรูระบายอากาศอย่างดี ป้องกันเนื้อเละ ช้ำ หรือคายน้ำระหว่างทาง",
    },
    {
      no: "04",
      icon: "🛡️",
      title: "รับประกันเคลม 100%",
      desc: "เจอปัญหาเนื้อขาว อ่อน หนอน แจ้งทางเบอร์ 082-282-4238 หรือหน้าเว็บ เคลมเปลี่ยนลูกใหม่หรือคืนเงินทันที",
    },
  ];

  return (
    <section id="about-us" className="py-16 bg-[#faf8f5] border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="border-b border-stone-300 pb-8 mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold text-[#997a35] uppercase tracking-widest mb-1">
              ABOUT WINKIN DURIAN
            </p>
            <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 font-bold">
              ทำไมต้องเลือก &quot;ทุเรียนวินคิน&quot; ?
            </h2>
          </div>
          <div className="text-xs text-stone-600 max-w-md font-light">
            เราเป็นธุรกิจครอบครัวที่ตั้งใจคัดสรรทุเรียนคุณภาพจริงใจ ตรงไปตรงมา เพื่อให้ลูกค้าได้ทานทุเรียนอร่อยที่สุดทุกลูก
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {pillars.map((p) => (
            <div key={p.no} className="border-t-2 border-[#c5a059] pt-5 space-y-2 bg-white p-5 rounded-b-lg shadow-sm">
              <div className="flex justify-between items-center mb-1">
                <span className="text-2xl">{p.icon}</span>
                <span className="font-mono text-xs text-[#997a35] font-bold">{p.no}</span>
              </div>
              <h3 className="font-bold text-stone-900 text-sm tracking-tight">{p.title}</h3>
              <p className="text-xs text-stone-600 leading-relaxed font-light">{p.desc}</p>
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
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden flex flex-col justify-between hover:shadow-xl transition-all duration-300 group">
      <div>
        {/* Photo Container */}
        <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 filter brightness-[0.98]"
          />
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {product.badge && (
              <span className="bg-[#081c10] text-[#e6c875] text-[10px] font-bold px-2 py-0.5 rounded tracking-wider uppercase border border-[#c5a059]/40">
                {product.badge}
              </span>
            )}
          </div>
          <div className="absolute bottom-3 left-3 bg-[#081c10]/85 backdrop-blur text-white text-[10px] px-2.5 py-1 rounded font-medium">
            📍 {product.origin}
          </div>
        </div>

        {/* Details */}
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-stone-500">
            <span>พันธุ์: <strong className="text-stone-800">{product.variety}</strong></span>
            <span>ความหวาน: <strong className="text-[#997a35] font-mono">{product.brix}</strong></span>
          </div>

          <h3 className="font-serif text-base font-bold text-stone-900 group-hover:text-[#081c10] transition leading-snug">
            {product.name}
          </h3>

          <p className="text-xs text-stone-500 font-light leading-relaxed line-clamp-2">
            {product.description}
          </p>

          {/* Specs Table */}
          <div className="bg-stone-50 rounded border border-stone-200 p-2.5 text-[11px] space-y-1 text-stone-600">
            <div className="flex justify-between">
              <span className="text-stone-400">ขนาดผล:</span>
              <span className="font-medium text-stone-800">{product.weight}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">เนื้อสัมผัส:</span>
              <span className="font-medium text-stone-800">{product.specs.texture}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Price & Action */}
      <div className="p-5 pt-0">
        <div className="pt-3 border-t border-stone-100 flex items-end justify-between">
          <div>
            {product.marketPrice && (
              <span className="text-[11px] text-stone-400 line-through block font-mono">
                ฿{product.marketPrice.toLocaleString()}
              </span>
            )}
            <div className="flex items-baseline">
              <span className="text-2xl font-serif font-black text-[#081c10]">
                ฿{product.price.toLocaleString()}
              </span>
              <span className="text-xs text-stone-400 ml-1">/{product.unit}</span>
            </div>
          </div>

          <button
            onClick={() => onOrder(product)}
            className="px-5 py-2.5 rounded bg-[#081c10] hover:bg-[#0f291a] text-[#e6c875] text-xs font-bold tracking-wider transition active:scale-95 border border-[#c5a059]/40"
          >
            สั่งจอง
          </button>
        </div>
      </div>
    </div>
  );
}

// ===================== PRODUCT COLLECTION =====================
function ProductCollection({ onOrder }: { onOrder: (p: Product) => void }) {
  const [filter, setFilter] = useState("all");
  const varieties = ["all", ...new Set(products.map((p) => p.variety))];

  const filtered =
    filter === "all" ? products : products.filter((p) => p.variety === filter);

  return (
    <section id="collection" className="py-20 bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-[11px] font-bold text-[#997a35] uppercase tracking-widest mb-1">
            WINKIN FRESH SELECTION
          </p>
          <h2 className="text-3xl font-serif text-stone-900 font-bold mb-3">
            รายการทุเรียนรอบวิ่งรถกระบะสัปดาห์นี้
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 font-light leading-relaxed">
            จองล่วงหน้าเพื่อล็อกสิทธิ์ทุเรียนแก่จัดจากสวน รับประกันเนื้อทุกลูก พบปัญหาเปลี่ยนใหม่ทันที
          </p>

          {/* Filter Pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {varieties.map((v) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={`px-4 py-1.5 rounded text-xs tracking-wider transition font-medium ${
                  filter === v
                    ? "bg-[#081c10] text-[#e6c875] border border-[#c5a059]"
                    : "bg-white text-stone-600 border border-stone-200 hover:border-stone-300"
                }`}
              >
                {v === "all" ? "ทั้งหมด" : `สายพันธุ์ ${v}`}
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
      </div>
    </section>
  );
}

// ===================== RIPENESS PROFILES =====================
function RipenessGuide() {
  const profiles = [
    {
      level: "ระดับ 1",
      name: "กรอบนอกนุ่มใน (ไก่ฉีก)",
      recommend: "คัดยอดนิยมอันดับหนึ่ง",
      desc: "ด้านนอกมีความกรอบแน่น เมื่อเคี้ยวจะได้รสสัมผัสเนื้อที่นุ่มละมุน ไร้กลิ่นฉุน ไม่หวานเลี่ยน เหมาะสำหรับผู้ที่ชื่นชอบความสดใหม่",
      brix: "32° Brix",
      notes: "กลิ่นหอมสะอาด • เคี้ยวมันหนึบ",
    },
    {
      level: "ระดับ 2",
      name: "สุกพอดีรับประทาน (เนื้อเนียนครีม)",
      recommend: "รสชาติเข้มข้นกลมกล่อม",
      desc: "เนื้อสีเหลืองทองเข้ม ละเอียดเหมือนเนื้อคัสตาร์ด หวานมันเต็มพิกัด กลิ่นหอมฟุ้งลึก เป็นระดับสุกที่คนชอบทุเรียนหวานมันต้องหลงรัก",
      brix: "34° Brix",
      notes: "หวานมันเข้มข้น • สัมผัสครีมมี่",
    },
    {
      level: "ระดับ 3",
      name: "สุกนิ่ม (หวานฉ่ำละลายในปาก)",
      recommend: "สำหรับผู้ชอบเนื้อนุ่มหวานจัด",
      desc: "เนื้อสุกงอมธรรมชาติ สัมผัสนุ่มฉ่ำ รสหวานเข้มข้นที่สุด ละลายในปาก เหมาะสำหรับรับประทานทันทีในวันที่จัดส่งถึง",
      brix: "36° Brix",
      notes: "หวานจัดจ้าน • เนื้อฉ่ำเยิ้ม",
    },
  ];

  return (
    <section id="ripeness" className="py-20 bg-[#081c10] text-white border-t border-[#c5a059]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mb-12">
          <p className="text-[11px] font-bold text-[#c5a059] uppercase tracking-widest mb-1">
            TASTE & TEXTURE GUIDE
          </p>
          <h2 className="text-3xl font-serif text-white font-bold mb-3">
            ชอบเนื้อแบบไหน วินคินจัดให้ตรงใจคุณ
          </h2>
          <p className="text-xs sm:text-sm text-white/70 font-light leading-relaxed">
            ระบุระดับความสุกในแบบฟอร์มสั่งซื้อ ทีมงานจะคัดพูตามความต้องการของคุณอย่างประณีต
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {profiles.map((pf) => (
            <div
              key={pf.level}
              className="bg-[#0f291a] border border-[#c5a059]/30 rounded-lg p-6 flex flex-col justify-between space-y-6"
            >
              <div>
                <div className="flex justify-between items-center text-[11px] text-[#c5a059] font-mono tracking-widest mb-2">
                  <span>{pf.level}</span>
                  <span className="uppercase">{pf.recommend}</span>
                </div>
                <h3 className="font-serif text-lg font-bold text-white mb-3">
                  {pf.name}
                </h3>
                <p className="text-xs text-white/70 font-light leading-relaxed">
                  {pf.desc}
                </p>
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-between items-center text-[11px]">
                <span className="text-white/40">{pf.notes}</span>
                <span className="font-mono font-bold text-[#e6c875]">{pf.brix}</span>
              </div>
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
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(1);
  const [ripenessPref, setRipenessPref] = useState("กรอบนอกนุ่มใน (ไก่ฉีก)");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [shipping, setShipping] = useState(shopInfo.shippingMethods[0].name);
  const [submitted, setSubmitted] = useState(false);

  const shippingCost =
    shopInfo.shippingMethods.find((s) => s.name === shipping)?.price || 0;
  const totalPrice = product.price * qty + shippingCost;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div
        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="bg-white w-full max-w-md rounded-lg p-8 text-center shadow-2xl border border-[#c5a059]"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={shopInfo.logo}
            alt={shopInfo.name}
            className="w-16 h-16 rounded-full border-2 border-[#c5a059] mx-auto mb-3 object-cover shadow"
          />
          <h3 className="font-serif text-xl font-bold text-stone-900 mb-1">
            บันทึกการสั่งจองเรียบร้อย!
          </h3>
          <p className="text-xs text-stone-500 mb-4">
            รหัสคำสั่งซื้อ: <strong className="font-mono text-stone-900">WK-{Math.floor(1000 + Math.random() * 9000)}</strong>
          </p>

          <div className="bg-stone-50 border border-stone-200 rounded p-4 text-xs text-stone-700 text-left space-y-1.5 mb-6">
            <p className="font-bold text-stone-900">ข้อมูลการชำระเงิน:</p>
            <p>ยอดชำระสุทธิ: <strong className="text-stone-900 font-mono text-sm">฿{totalPrice.toLocaleString()}</strong></p>
            <p>ธนาคาร: <strong>{shopInfo.bankAccount.bank}</strong></p>
            <p>เลขบัญชี: <strong className="font-mono text-stone-900 text-sm">{shopInfo.bankAccount.number}</strong></p>
            <p>พร้อมเพย์: <strong className="font-mono text-[#166534] text-sm">{shopInfo.bankAccount.promptPay}</strong></p>
            <p>ชื่อบัญชี: <strong>{shopInfo.bankAccount.name}</strong></p>
            <p className="text-[11px] text-stone-500 pt-1">
              *เมื่อโอนเงินแล้ว กรุณาส่งสลิปผ่านทาง LINE OA <strong>{shopInfo.lineOA}</strong> หรือโทร <strong>{shopInfo.phone}</strong> เพื่อให้เจ้าหน้าที่ล็อกคิวส่งของทันที
            </p>
          </div>

          <div className="flex gap-2">
            <a
              href="#"
              className="flex-1 py-3 rounded bg-[#16a34a] text-white text-xs uppercase tracking-wider font-bold hover:bg-[#15803d] transition flex items-center justify-center gap-1.5"
            >
              <span>💬</span> ส่งสลิปผ่าน LINE
            </a>
            <button
              onClick={onClose}
              className="px-5 py-3 rounded border border-stone-200 text-stone-600 text-xs hover:bg-stone-50 transition"
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
        className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl border border-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#081c10] text-white px-6 py-4 flex items-center justify-between border-b border-[#c5a059]/30">
          <div className="flex items-center gap-3">
            <img
              src={shopInfo.logo}
              alt={shopInfo.name}
              className="w-9 h-9 rounded-full border border-[#c5a059] object-cover bg-white"
            />
            <div>
              <h3 className="font-serif text-base font-bold">สั่งจองกับ {shopInfo.name}</h3>
              <p className="text-[10px] text-[#c5a059] font-mono">
                โทร. {shopInfo.phone}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Product Mini Spec */}
          <div className="flex gap-4 p-3 bg-stone-50 border border-stone-200 rounded">
            <img
              src={product.image}
              alt={product.name}
              className="w-16 h-16 object-cover rounded"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-serif font-bold text-stone-900 text-sm truncate">{product.name}</h4>
              <p className="text-[11px] text-stone-500">{product.origin} • {product.weight}</p>
              <p className="font-serif font-bold text-stone-900 text-sm mt-1">
                ฿{product.price.toLocaleString()} /{product.unit}
              </p>
            </div>
          </div>

          {/* ระดับความสุก */}
          <div>
            <label className="block text-xs font-semibold text-stone-800 mb-1.5">
              เลือกระดับความสุกที่ต้องการ *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                "กรอบนอกนุ่มใน (ไก่ฉีก)",
                "สุกพอดีกิน (เนื้อเนียน)",
                "สุกนิ่ม (หวานฉ่ำ)",
              ].map((rf) => (
                <label
                  key={rf}
                  className={`p-2.5 rounded border text-center cursor-pointer transition text-xs ${
                    ripenessPref === rf
                      ? "border-[#081c10] bg-[#081c10] text-[#e6c875] font-semibold"
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
          <div className="flex items-center justify-between p-3 bg-stone-50 rounded border border-stone-200">
            <span className="text-xs font-semibold text-stone-700">จำนวนที่ต้องการสั่งซื้อ</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-7 h-7 bg-white border border-stone-300 rounded text-xs font-bold hover:bg-stone-100"
              >
                −
              </button>
              <span className="font-mono font-bold text-sm w-6 text-center">{qty}</span>
              <button
                type="button"
                onClick={() => setQty(qty + 1)}
                className="w-7 h-7 bg-[#081c10] text-[#e6c875] rounded text-xs font-bold hover:bg-[#0f291a]"
              >
                +
              </button>
              <span className="text-xs text-stone-500">{product.unit}</span>
            </div>
          </div>

          {/* ข้อมูลจัดส่ง */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                ชื่อ-นามสกุล ผู้รับ *
              </label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น คุณกฤษฎา วัฒนกุล"
                className="w-full border border-stone-300 rounded px-3 py-2 text-xs focus:border-[#081c10] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                เบอร์โทรศัพท์ (สำหรับขนส่งโทรส่งของ) *
              </label>
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08X-XXX-XXXX"
                className="w-full border border-stone-300 rounded px-3 py-2 text-xs focus:border-[#081c10] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                ที่อยู่จัดส่งละเอียด *
              </label>
              <textarea
                required
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
                className="w-full border border-stone-300 rounded px-3 py-2 text-xs focus:border-[#081c10] focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* รูปแบบจัดส่ง */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              วิธีการจัดส่ง
            </label>
            <div className="space-y-1.5">
              {shopInfo.shippingMethods.map((s) => (
                <label
                  key={s.name}
                  className={`flex items-start justify-between p-2.5 rounded border cursor-pointer text-xs ${
                    shipping === s.name
                      ? "border-[#081c10] bg-stone-50 font-semibold text-stone-900"
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
                      className="accent-[#081c10] mt-0.5"
                    />
                    <div>
                      <span>{s.name}</span>
                      <p className="text-[10px] text-stone-400 font-normal">{s.note}</p>
                    </div>
                  </div>
                  <span className="font-mono">{s.price === 0 ? "ฟรี" : `฿${s.price}`}</span>
                </label>
              ))}
            </div>
          </div>

          {/* สรุปยอด */}
          <div className="bg-stone-100 rounded p-4 flex items-center justify-between border border-stone-200">
            <div>
              <span className="text-[10px] text-stone-400 uppercase tracking-wider block">ยอดรวมสุทธิ (รวมค่าจัดส่ง)</span>
              <span className="font-serif text-2xl font-black text-stone-900">
                ฿{totalPrice.toLocaleString()}
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#166534] bg-emerald-100 px-2 py-1 rounded border border-emerald-200">
              รับประกันเคลม 100%
            </span>
          </div>

          <button
            type="submit"
            className="w-full bg-[#081c10] hover:bg-[#0f291a] text-[#e6c875] py-3.5 rounded text-xs font-bold uppercase tracking-wider transition"
          >
            ยืนยันคำสั่งจอง ฿{totalPrice.toLocaleString()}
          </button>
        </form>
      </div>
    </div>
  );
}

// ===================== FOOTER =====================
function Footer() {
  return (
    <footer id="contact" className="bg-[#05140b] text-white/70 py-16 border-t border-[#c5a059]/20 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-white/10">
          {/* Brand Col */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={shopInfo.logo}
                alt={shopInfo.name}
                className="w-12 h-12 rounded-full border border-[#c5a059] bg-white object-cover"
              />
              <div>
                <h3 className="font-serif text-lg font-bold text-white tracking-wider">
                  {shopInfo.name}
                </h3>
                <p className="text-[11px] text-[#c5a059] font-mono">
                  โทร. {shopInfo.phone}
                </p>
              </div>
            </div>
            <p className="text-white/60 font-light leading-relaxed text-xs">
              {shopInfo.description}
            </p>
          </div>

          {/* Contact Col */}
          <div className="space-y-2">
            <h4 className="font-semibold text-white tracking-wider uppercase text-[11px] mb-3">
              ติดต่อสอบถาม & สั่งจอง
            </h4>
            <p>เบอร์โทรศัพท์: <strong className="text-white font-mono text-sm">{shopInfo.phone}</strong></p>
            <p>LINE OA: <strong className="text-[#e6c875] font-mono">{shopInfo.lineOA}</strong></p>
            <p>เวลาทำการ: ทุกวัน 08:00 - 21:00 น.</p>
          </div>

          {/* Menu Col */}
          <div className="space-y-2">
            <h4 className="font-semibold text-white tracking-wider uppercase text-[11px] mb-3">
              ระบบและบริการ
            </h4>
            <a href="/tracking" className="block hover:text-white transition">
              ตรวจสอบสถานะจัดส่ง (Tracking)
            </a>
            <a href="/claim" className="block text-[#c5a059] hover:text-[#e6c875] transition font-bold">
              ศูนย์รับประกันและแจ้งเคลม 100%
            </a>
            <a href="/admin" className="block hover:text-white transition">
              เข้าสู่ระบบหลังบ้าน (Admin)
            </a>
          </div>

          {/* Bank Info */}
          <div className="space-y-2 bg-white/5 border border-white/10 p-4 rounded">
            <h4 className="font-semibold text-[#e6c875] tracking-wider uppercase text-[11px]">
              บัญชีชำระเงินทางการ
            </h4>
            <p className="text-white font-medium">{shopInfo.bankAccount.bank}</p>
            <p className="font-mono text-white text-sm font-bold tracking-wider">
              {shopInfo.bankAccount.number}
            </p>
            <p className="text-[#86efac] text-xs font-mono">
              พร้อมเพย์: {shopInfo.bankAccount.promptPay}
            </p>
            <p className="text-white/60 text-[10px]">{shopInfo.bankAccount.name}</p>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-white/40">
          <p>© 2026 {shopInfo.name}. All rights reserved.</p>
          <p>คัดสดแก่จัด วิ่งรถกระบะส่งตรงจากสวนถึงหน้าบ้าน</p>
        </div>
      </div>
    </footer>
  );
}

// ===================== FLOATING CONTACT =====================
function FloatingContact() {
  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
      <a
        href={`tel:${shopInfo.phone.replace(/-/g, "")}`}
        className="bg-[#081c10] hover:bg-[#0f291a] text-[#e6c875] px-4 py-3 rounded-full shadow-2xl flex items-center gap-2 border border-[#c5a059] hover:scale-105 transition-all text-xs font-bold"
      >
        <span>📞</span>
        <span className="font-mono">{shopInfo.phone}</span>
      </a>
    </div>
  );
}

// ===================== MAIN PAGE =====================
export default function Home() {
  const [orderProduct, setOrderProduct] = useState<Product | null>(null);

  return (
    <main className="min-h-screen bg-[#faf8f5]">
      <Navbar />
      <HeroBanner />
      <AboutWinkin />
      <ProductCollection onOrder={setOrderProduct} />
      <RipenessGuide />
      <Footer />
      <FloatingContact />

      {orderProduct && (
        <OrderModal
          product={orderProduct}
          onClose={() => setOrderProduct(null)}
        />
      )}
    </main>
  );
}
