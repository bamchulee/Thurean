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
} from "lucide-react";

function AddressFormContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || searchParams.get("uid") || "";

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

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [advancedOrder, setAdvancedOrder] = useState(false);
  const [savedFullAddress, setSavedFullAddress] = useState("");

  useEffect(() => {
    if (!userId) {
      setFetching(false);
      return;
    }

    fetch(`/api/address?userId=${encodeURIComponent(userId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.user) {
          if (data.user.customerName) setCustomerName(data.user.customerName);
          if (data.user.phone) setPhone(data.user.phone);
          if (data.user.address) {
            setSingleAddress(data.user.address);
          }
        }
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [userId]);

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
          lineUserId: userId,
          customerName: customerName.trim(),
          phone: cleanPhone,
          address: mode === "single" ? singleAddress.trim() : undefined,
          houseNo: mode === "fields" ? houseNo.trim() : undefined,
          subdistrict: mode === "fields" ? subdistrict.trim() : undefined,
          district: mode === "fields" ? district.trim() : undefined,
          province: mode === "fields" ? province.trim() : undefined,
          postalCode: mode === "fields" ? postalCode.trim() : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "บันทึกที่อยู่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      }

      setSavedFullAddress(json.address || "");
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
                แบบฟอร์มกรอกข้อมูลที่อยู่จัดส่งด่วน
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-200 bg-black/20 backdrop-blur-sm px-3 py-1.5 rounded-full w-fit">
            <Truck className="w-3.5 h-3.5" />
            <span>คัดตัดสดส่งตรงถึงหน้าบ้าน • รับประกันเนื้อ 100%</span>
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
                  ? "ระบบสร้างยอดชำระเงินและส่ง QR PromptPay เข้าแชท LINE ของคุณแล้ว"
                  : "ระบบบันทึกที่อยู่เพื่อใช้ในการสั่งซื้อทุเรียนตัดสดเรียบร้อยครับ"}
              </p>

              {/* Summary Card */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-left text-xs mb-6 space-y-2">
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
                <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center gap-1.5">
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
                <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center gap-1.5">
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

              {/* Mode Switcher */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-700" />
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
                      <span>บันทึกที่อยู่จัดส่ง</span>
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
