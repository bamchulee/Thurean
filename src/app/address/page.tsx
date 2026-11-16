"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  MapPin,
  User,
  Phone,
  Home,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  MessageCircle,
  Truck,
  LocateFixed,
  ExternalLink,
  Globe,
  Navigation,
} from "lucide-react";

function AddressFormContent() {
  const searchParams = useSearchParams();
  // ลิงก์จากบอท LINE เซ็นชื่อไว้ (u = LINE userId, d = ร่างการจอง, e = หมดอายุ, sig) — เปิดได้เฉพาะเจ้าของแชท
  const link = {
    u: searchParams.get("u") || "",
    d: searchParams.get("d") || "",
    e: searchParams.get("e") || "",
    sig: searchParams.get("sig") || "",
  };
  const linkQuery = new URLSearchParams(link).toString();
  const hasLink = Boolean(link.u && link.sig);

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<"fields" | "single">("fields");

  // แบบแยกช่อง
  const [houseNo, setHouseNo] = useState("");
  const [subdistrict, setSubdistrict] = useState("");
  const [district, setDistrict] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // แบบช่องเดียว
  const [singleAddress, setSingleAddress] = useState("");

  // ระบบ Google Maps & GPS Pin
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [mapsUrl, setMapsUrl] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationMsg, setLocationMsg] = useState("");
  const [savedMapsUrl, setSavedMapsUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [advancedOrder, setAdvancedOrder] = useState(false);
  const [savedFullAddress, setSavedFullAddress] = useState("");

  useEffect(() => {
    if (!hasLink) {
      setError("ลิงก์ไม่ครบหรือหมดอายุ — กดปุ่ม \"กรอกที่อยู่\" จากแชท LINE อีกครั้งครับ");
      setFetching(false);
      return;
    }

    fetch(`/api/address?${linkQuery}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) setError(data.error || "ลิงก์หมดอายุ — กดปุ่มจากแชท LINE อีกครั้งครับ");
        if (data.ok && data.user) {
          if (data.user.customerName) setCustomerName(data.user.customerName);
          if (data.user.phone) setPhone(data.user.phone);
          if (data.user.address) {
            setSingleAddress(data.user.address);
          }
          if (data.user.mapsUrl) {
            setMapsUrl(data.user.mapsUrl);
            setSavedMapsUrl(data.user.mapsUrl);
          }
          if (typeof data.user.latitude === "number" && typeof data.user.longitude === "number") {
            setLat(data.user.latitude);
            setLng(data.user.longitude);
          }
        }
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [hasLink, linkQuery]);

  // ฟังก์ชันดึงพิกัด GPS อัตโนมัติและแปลงเป็นที่อยู่อัตโนมัติ (Reverse Geocode)
  const handleGetLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationMsg("เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง GPS");
      return;
    }

    setLocating(true);
    setLocationMsg("กำลังเชื่อมต่อดาวเทียม GPS เพื่อค้นหาตำแหน่งของคุณ...");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        setLat(latitude);
        setLng(longitude);

        const generatedUrl = `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
        setMapsUrl(generatedUrl);
        setLocationMsg(`✅ ปักหมุดสำเร็จ! พิกัด (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);

        // พยายามดึงชื่อถนน/ตำบล/อำเภอ จาก OpenStreetMap
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=th`
          );
          if (res.ok) {
            const geo = await res.json();
            if (geo && geo.address) {
              const a = geo.address;
              const road = a.road || a.street || a.neighbourhood || "";
              const house = a.house_number ? `${a.house_number} ` : "";
              const sub = a.suburb || a.quarter || a.village || "";
              const dist = a.city_district || a.district || a.county || "";
              const prov = a.province || a.state || a.city || "";
              const post = a.postcode || "";

              if (!houseNo && (house || road)) setHouseNo(`${house}${road}`.trim());
              if (!subdistrict && sub) setSubdistrict(sub);
              if (!district && dist) setDistrict(dist);
              if (!province && prov) setProvince(prov);
              if (!postalCode && post) setPostalCode(post);

              if (!singleAddress && geo.display_name) {
                setSingleAddress(geo.display_name);
              }
            }
          }
        } catch {
          // หากเชื่อมต่อ Nominatim ไม่ได้ ยังคงบันทึกพิกัดไว้ได้สมบูรณ์
        }

        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationMsg("กรุณาอนุญาตสิทธิ์ระบุตำแหน่ง (Location Permission) ในเบราว์เซอร์ หรือคัดลอกลิงก์ Google Maps มาวางได้ครับ");
        } else {
          setLocationMsg("ไม่สามารถระบุพิกัดได้ กรุณาลองใหม่อีกครั้ง หรือวางลิงก์ Google Maps ครับ");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // ตรวจจับเมื่อผู้ใช้พิมพ์หรือวางลิงก์ Google Maps เพื่อดึงพิกัด lat/lng
  const handleMapsUrlChange = (val: string) => {
    setMapsUrl(val);
    const qMatch = val.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (qMatch) {
      setLat(parseFloat(qMatch[1]));
      setLng(parseFloat(qMatch[2]));
      return;
    }
    const atMatch = val.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (atMatch) {
      setLat(parseFloat(atMatch[1]));
      setLng(parseFloat(atMatch[2]));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanPhone = phone.replace(/[^\d]/g, "");
    if (!customerName.trim()) {
      setError("กรุณากรอกชื่อผู้รับสินค้า");
      return;
    }
    if (cleanPhone.length < 9 || cleanPhone.length > 10) {
      setError("กรุณากรอกเบอร์โทรศัพท์มือถือ 9-10 หลักให้ถูกต้อง");
      return;
    }

    if (mode === "single" && !singleAddress.trim()) {
      setError("กรุณากรอกที่อยู่จัดส่ง");
      return;
    }
    if (mode === "fields" && (!houseNo.trim() || !province.trim() || !postalCode.trim())) {
      setError("กรุณากรอกบ้านเลขที่/ถนน จังหวัด และรหัสไปรษณีย์");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...link,
          customerName: customerName.trim(),
          phone: cleanPhone,
          address: mode === "single" ? singleAddress.trim() : undefined,
          houseNo: mode === "fields" ? houseNo.trim() : undefined,
          subdistrict: mode === "fields" ? subdistrict.trim() : undefined,
          district: mode === "fields" ? district.trim() : undefined,
          province: mode === "fields" ? province.trim() : undefined,
          postalCode: mode === "fields" ? postalCode.trim() : undefined,
          mapsUrl: mapsUrl.trim() || undefined,
          latitude: lat ?? undefined,
          longitude: lng ?? undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "บันทึกที่อยู่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      }

      setSavedFullAddress(json.address || "");
      setSavedMapsUrl(json.mapsUrl || mapsUrl);
      setAdvancedOrder(Boolean(json.advancedOrder));
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 py-6 px-4 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl overflow-hidden border border-stone-200">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-[#11301F] to-[#1B4D31] text-white p-6 relative">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🍈</span>
            <div>
              <h1 className="text-lg font-black text-amber-300">
                ร้านทุเรียนวินคิน
              </h1>
              <p className="text-xs text-stone-200">
                แบบฟอร์มกรอกที่อยู่จัดส่งด่วน & ปักหมุดแผนที่
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-200 bg-black/20 backdrop-blur-sm px-3 py-1.5 rounded-full w-fit">
            <Truck className="w-3.5 h-3.5" />
            <span>คัดตัดสดส่งตรงถึงหน้าบ้าน • รองรับปักหมุด Google Maps 100%</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {fetching ? (
            <div className="py-12 text-center text-stone-500">
              <div className="animate-spin inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mb-3" />
              <p className="text-sm font-semibold">กำลังโหลดข้อมูล...</p>
            </div>
          ) : success ? (
            /* Success State */
            <div className="py-4 text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-black text-stone-800 mb-1">
                บันทึกที่อยู่เรียบร้อยแล้ว!
              </h2>
              <p className="text-xs text-stone-500 mb-6">
                {advancedOrder
                  ? "ส่งการ์ดยืนยันการจองเข้าแชท LINE แล้ว กลับไปกด \"ยืนยันการจอง\" ในแชทได้เลยครับ"
                  : "ระบบบันทึกที่อยู่และพิกัดแผนที่เพื่อใช้ในการจัดส่งทุเรียนเรียบร้อยครับ"}
              </p>

              {/* Summary Card */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-left text-xs mb-6 space-y-2.5">
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-stone-400 block text-[10px]">ชื่อผู้รับ</span>
                    <span className="font-bold text-stone-800">{customerName}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-stone-400 block text-[10px]">เบอร์โทรศัพท์</span>
                    <span className="font-bold text-stone-800">{phone}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-stone-400 block text-[10px]">ที่อยู่จัดส่ง</span>
                    <span className="font-medium text-stone-700 leading-relaxed">
                      {savedFullAddress}
                    </span>
                  </div>
                </div>

                {savedMapsUrl && (
                  <div className="flex items-start gap-2 pt-2 border-t border-stone-200">
                    <Globe className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-stone-400 block text-[10px]">พิกัด Google Maps</span>
                      <a
                        href={savedMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 font-semibold underline text-[11px] inline-flex items-center gap-1 hover:text-emerald-800"
                      >
                        <span>เปิดดูตำแหน่งบน Google Maps</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <a
                href="https://line.me/R/ti/p/@713imada"
                className="w-full inline-flex items-center justify-center gap-2 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg transition text-sm"
              >
                <MessageCircle className="w-5 h-5" />
                <span>กลับไปที่แชท LINE OA</span>
              </a>
            </div>
          ) : (
            /* Input Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-medium">
                  {error}
                </div>
              )}

              {/* Field: Full Name */}
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-700" />
                  <span>ชื่อ-นามสกุล ผู้รับพัสดุ *</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="เช่น คุณสมชาย ใจดี"
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-stone-800 focus:bg-white focus:border-emerald-600 focus:outline-none transition"
                />
              </div>

              {/* Field: Phone Number */}
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-700" />
                  <span>เบอร์โทรศัพท์มือถือ (10 หลัก) *</span>
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="เช่น 0812345678"
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-stone-800 focus:bg-white focus:border-emerald-600 focus:outline-none transition font-mono tracking-wider"
                />
              </div>

              {/* GPS & Google Maps Pin Section */}
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-bold text-emerald-900">
                      ปักหมุดแผนที่ Google Maps (สะดวกส่งถึงหน้าบ้าน)
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={locating}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-xl text-xs transition shadow-sm disabled:opacity-50"
                  >
                    {locating ? (
                      <>
                        <div className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                        <span>กำลังดึงพิกัด GPS...</span>
                      </>
                    ) : (
                      <>
                        <LocateFixed className="w-3.5 h-3.5" />
                        <span>📍 ดึงตำแหน่งปัจจุบันของฉัน (GPS)</span>
                      </>
                    )}
                  </button>
                </div>

                {locationMsg && (
                  <p className="text-[11px] text-emerald-800 font-medium leading-relaxed bg-white/70 p-2 rounded-lg border border-emerald-100">
                    {locationMsg}
                  </p>
                )}

                {/* Google Maps URL Input */}
                <div>
                  <label className="text-[10px] text-stone-500 font-medium block mb-1">
                    ลิงก์แผนที่ Google Maps (หรือวางลิงก์ที่แชร์จากแอป Google Maps):
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      value={mapsUrl}
                      onChange={(e) => handleMapsUrlChange(e.target.value)}
                      placeholder="เช่น https://maps.google.com/?q=13.7563,100.5018 หรือ https://maps.app.goo.gl/..."
                      className="w-full bg-white border border-stone-300 rounded-xl pl-8 pr-3 py-2 text-xs text-stone-800 focus:border-emerald-600 focus:outline-none font-mono"
                    />
                    <MapPin className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>

                {/* Embedded Map Preview if Lat/Lng available */}
                {lat && lng && (
                  <div className="mt-2 space-y-1.5">
                    <div className="rounded-xl overflow-hidden border border-emerald-300 shadow-sm relative h-40 bg-stone-100">
                      <iframe
                        title="Google Maps Location Preview"
                        src={`https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`}
                        className="w-full h-full border-0"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-emerald-800 font-mono">
                        พิกัด: {lat.toFixed(6)}, {lng.toFixed(6)}
                      </span>
                      <a
                        href={mapsUrl || `https://www.google.com/maps?q=${lat},${lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline"
                      >
                        <span>เปิดดูแผนที่เต็ม</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Mode Switcher */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5 text-emerald-700" />
                    <span>ที่อยู่จัดส่ง *</span>
                  </label>
                  <div className="flex text-[11px] bg-stone-100 p-0.5 rounded-lg border border-stone-200">
                    <button
                      type="button"
                      onClick={() => setMode("fields")}
                      className={`px-2.5 py-1 rounded-md transition font-medium ${
                        mode === "fields"
                          ? "bg-white text-emerald-800 shadow-sm font-bold"
                          : "text-stone-500 hover:text-stone-700"
                      }`}
                    >
                      แบบแยกช่อง
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("single")}
                      className={`px-2.5 py-1 rounded-md transition font-medium ${
                        mode === "single"
                          ? "bg-white text-emerald-800 shadow-sm font-bold"
                          : "text-stone-500 hover:text-stone-700"
                      }`}
                    >
                      แบบช่องเดียว
                    </button>
                  </div>
                </div>

                {mode === "fields" ? (
                  /* Form Fields Mode */
                  <div className="space-y-2.5 bg-stone-50/60 p-3.5 rounded-2xl border border-stone-200">
                    <div>
                      <span className="text-[11px] font-semibold text-stone-600 block mb-1">
                        บ้านเลขที่ / หมู่บ้าน / ซอย / ถนน *
                      </span>
                      <input
                        type="text"
                        required
                        value={houseNo}
                        onChange={(e) => setHouseNo(e.target.value)}
                        placeholder="เช่น 99/1 ม.3 ซอยสุขุมวิท 55 ถนนสุขุมวิท"
                        className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-800 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[11px] font-semibold text-stone-600 block mb-1">
                          ตำบล / แขวง
                        </span>
                        <input
                          type="text"
                          value={subdistrict}
                          onChange={(e) => setSubdistrict(e.target.value)}
                          placeholder="คลองตันเหนือ"
                          className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-800 focus:border-emerald-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-stone-600 block mb-1">
                          อำเภอ / เขต
                        </span>
                        <input
                          type="text"
                          value={district}
                          onChange={(e) => setDistrict(e.target.value)}
                          placeholder="วัฒนา"
                          className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-800 focus:border-emerald-600 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[11px] font-semibold text-stone-600 block mb-1">
                          จังหวัด *
                        </span>
                        <input
                          type="text"
                          required
                          value={province}
                          onChange={(e) => setProvince(e.target.value)}
                          placeholder="กรุงเทพฯ"
                          className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-800 focus:border-emerald-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-stone-600 block mb-1">
                          รหัสไปรษณีย์ *
                        </span>
                        <input
                          type="text"
                          required
                          maxLength={5}
                          value={postalCode}
                          onChange={(e) => setPostalCode(e.target.value.replace(/[^\d]/g, ""))}
                          placeholder="10110"
                          className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-800 focus:border-emerald-600 focus:outline-none font-mono tracking-wider"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Single Textarea Mode */
                  <div>
                    <textarea
                      required
                      rows={3}
                      value={singleAddress}
                      onChange={(e) => setSingleAddress(e.target.value)}
                      placeholder="เช่น 99/1 ถ.สุขุมวิท 55 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110"
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl p-3 text-xs text-stone-800 focus:bg-white focus:border-emerald-600 focus:outline-none transition leading-relaxed"
                    />
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-[#1B4D31] hover:bg-[#153e27] text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg transition disabled:opacity-50 text-xs"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      <span>กำลังบันทึกข้อมูล...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>บันทึกที่อยู่ & พิกัดจัดส่ง</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AddressPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-100 flex items-center justify-center text-xs">กำลังโหลด...</div>}>
      <AddressFormContent />
    </Suspense>
  );
}
