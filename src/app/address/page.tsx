"use client";

import React, { useState, useEffect, Suspense } from "react";
import { AddressForm } from "../../components/address/AddressForm";
import { EMPTY_ADDRESS, addressErrors, inThailand, stripPrefix, type AddressValue } from "../../lib/thai-address";
import { useSearchParams } from "next/navigation";
import {
  MapPin,
  User,
  Phone,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  MessageCircle,
  Truck,
  ExternalLink,
  Globe,
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

  // ฟอร์มที่อยู่แบบปักหมุด (เหมือนหน้าเว็บร้าน) + ที่อยู่เดิมที่บันทึกไว้
  const [av, setAv] = useState<AddressValue>(EMPTY_ADDRESS);
  const [savedAddress, setSavedAddress] = useState("");
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
          const u = data.user;
          setAv((prev) => ({
            ...prev,
            name: u.customerName || prev.name,
            phone: u.phone || prev.phone,
            ...(inThailand(u.latitude, u.longitude) ? { lat: u.latitude, lng: u.longitude } : {}),
          }));
          if (u.address) setSavedAddress(u.address);
          if (u.mapsUrl) setSavedMapsUrl(u.mapsUrl);
        }
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [hasLink, linkQuery]);

  const handleSubmit = async (e?: React.FormEvent, keepSaved = false) => {
    e?.preventDefault();
    setError("");
    const cleanPhone = av.phone.replace(/[^\d]/g, "");
    if (!av.name.trim()) return setError("กรุณากรอกชื่อผู้รับสินค้า");
    if (cleanPhone.length < 9 || cleanPhone.length > 10) return setError("กรุณากรอกเบอร์โทรศัพท์มือถือ 9-10 หลักให้ถูกต้อง");
    if (!keepSaved) {
      const missing = addressErrors(av, { contact: false });
      if (missing.length) return setError(`กรอกให้ครบ: ${missing.join(", ")}`);
    }

    setLoading(true);

    try {
      const pin = inThailand(av.lat, av.lng) ? { latitude: av.lat, longitude: av.lng } : {};
      const res = await fetch("/api/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...link,
          customerName: av.name.trim(),
          phone: cleanPhone,
          ...(keepSaved
            ? { address: savedAddress }
            : {
                houseNo: av.detail.trim(),
                subdistrict: stripPrefix(av.subdistrict),
                district: stripPrefix(av.district),
                province: av.province,
                postalCode: av.postalCode.trim(),
              }),
          ...pin,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "บันทึกที่อยู่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      }

      setSavedFullAddress(json.address || "");
      setSavedMapsUrl(json.mapsUrl || "");
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
                    <span className="font-bold text-stone-800">{av.name}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-stone-400 block text-[10px]">เบอร์โทรศัพท์</span>
                    <span className="font-bold text-stone-800">{av.phone}</span>
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

              {savedAddress && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm space-y-2">
                  <p className="text-xs font-bold text-emerald-800">ที่อยู่ที่บันทึกไว้</p>
                  <p className="text-stone-800 break-words whitespace-pre-line">{savedAddress}</p>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSubmit(undefined, true)}
                    className="w-full h-10 rounded-lg bg-white border border-[#1B4D31] text-[#1B4D31] text-sm font-bold disabled:opacity-50"
                  >
                    ใช้ที่อยู่นี้
                  </button>
                  <p className="text-[11px] text-emerald-700">หรือกรอกที่อยู่ใหม่ด้านล่าง</p>
                </div>
              )}

              <AddressForm value={av} onChange={setAv} />

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
