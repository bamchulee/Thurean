"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { LineIcon, DurianIcon } from "./Icons";
import { useLiff } from "../lib/use-liff";

export function AuthModal() {
  const {
    user,
    isAuthModalOpen,
    closeAuthModal,
    loginWithLine,
    updateProfile,
  } = useAuth();

  const { profile: liffProfile, inLineApp, login: liffLogin } = useLiff();

  // Mode: "connect" (click LINE login) | "details" (fill/update phone & address)
  const [step, setStep] = useState<"connect" | "details">("connect");

  // Form State
  const [lineUserId, setLineUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pictureUrl, setPictureUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Sync state when modal opens or user/LIFF profile changes
  useEffect(() => {
    if (!isAuthModalOpen) return;

    setErrorMsg("");
    setSuccessMsg("");

    if (user) {
      // User is already logged in, opening modal to view/edit address & phone
      setDisplayName(user.firstName || user.username || "");
      setPhone(user.phone || "");
      setAddress(user.address || "");
      setPostalCode(user.postalCode || "");
      setPictureUrl(user.avatarUrl || "");
      setLineUserId(user.lineUserId || "");
      setStep("details");
    } else if (liffProfile) {
      // LIFF detected customer's LINE profile
      setDisplayName(liffProfile.displayName);
      setPictureUrl(liffProfile.pictureUrl || "");
      setLineUserId(liffProfile.userId);
      setStep("details");
    } else {
      setStep("connect");
    }
  }, [isAuthModalOpen, user, liffProfile]);

  if (!isAuthModalOpen) return null;

  // Handle 1-click LINE Connect
  const handleLineConnect = async () => {
    setErrorMsg("");

    // If LIFF is available and in LINE client, try LIFF login
    if (liffProfile) {
      setDisplayName(liffProfile.displayName);
      setPictureUrl(liffProfile.pictureUrl || "");
      setLineUserId(liffProfile.userId);
      setStep("details");
      return;
    }

    if (inLineApp && typeof window !== "undefined" && (window as any).liff) {
      liffLogin();
      return;
    }

    // Default flow: proceed to provide LINE name and address
    setStep("details");
  };

  // Submit Save Profile & Login
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    if (!displayName.trim()) {
      setErrorMsg("กรุณาระบุชื่อของคุณ หรือชื่อบัญชี LINE");
      setSubmitting(false);
      return;
    }

    if (!phone.trim()) {
      setErrorMsg("กรุณาระบุเบอร์โทรศัพท์สำหรับจัดส่ง");
      setSubmitting(false);
      return;
    }

    if (user) {
      // Update existing user profile
      const res = await updateProfile({
        firstName: displayName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        postalCode: postalCode.trim(),
        avatarUrl: pictureUrl || user.avatarUrl,
      });

      setSubmitting(false);
      if (!res.ok) {
        setErrorMsg(res.error || "บันทึกข้อมูลไม่สำเร็จ");
      } else {
        setSuccessMsg("อัปเดตข้อมูลจัดส่งเรียบร้อยแล้ว!");
        setTimeout(() => closeAuthModal(), 1200);
      }
    } else {
      // Login or Register via LINE
      const res = await loginWithLine({
        lineUserId: lineUserId || `manual_${Date.now()}`,
        displayName: displayName.trim(),
        pictureUrl:
          pictureUrl ||
          "https://api.dicebear.com/7.x/bottts/svg?seed=MonthongKing&backgroundColor=fef08a",
        phone: phone.trim(),
        address: address.trim(),
        postalCode: postalCode.trim(),
      });

      setSubmitting(false);
      if (!res.ok) {
        setErrorMsg(res.error || "เข้าสู่ระบบไม่สำเร็จ");
      } else {
        setSuccessMsg("เข้าสู่ระบบด้วย LINE เรียบร้อยแล้ว!");
        setTimeout(() => closeAuthModal(), 1200);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in"
      onClick={closeAuthModal}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-emerald-900/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#11301F] text-white p-5 flex items-center justify-between border-b border-white/10 relative overflow-hidden">
          <div className="absolute right-0 -bottom-4 opacity-10 pointer-events-none">
            <LineIcon className="w-32 h-32 text-[#06C755]" />
          </div>

          <div className="flex items-center gap-3 z-10">
            <div className="w-10 h-10 rounded-2xl bg-[#06C755] flex items-center justify-center shadow-md">
              <LineIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">
                {user ? "ข้อมูลสมาชิกของคุณ" : "เข้าสู่ระบบด้วย LINE"}
              </h3>
              <p className="text-[11px] text-emerald-300">
                {user ? "ผูกบัญชี LINE เรียบร้อยแล้ว" : "คลิกเดียวจบ • ไม่ต้องจำรหัสผ่าน"}
              </p>
            </div>
          </div>

          <button
            onClick={closeAuthModal}
            className="text-white/70 hover:text-white p-1 rounded-lg transition z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-bold">{successMsg}</span>
            </div>
          )}

          {step === "connect" && !user && (
            <div className="text-center py-3 space-y-5">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-[#06C755]/10 border border-[#06C755]/30 flex items-center justify-center">
                <LineIcon className="w-12 h-12 text-[#06C755]" />
              </div>

              <div>
                <h4 className="font-extrabold text-stone-900 text-base">
                  เข้าสู่ระบบผ่าน LINE ง่ายและรวดเร็ว
                </h4>
                <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  ไม่ต้องกรอก Username และไม่ต้องจำ Password! เชื่อมต่อบัญชี LINE เพื่อดึงที่อยู่จัดส่งและรับการแจ้งเตือนพัสดุอัตโนมัติ
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleLineConnect}
                  className="w-full bg-[#06C755] hover:bg-[#05b34c] text-white py-3.5 rounded-2xl font-black text-sm transition shadow-lg shadow-emerald-700/20 flex items-center justify-center gap-2.5 active:scale-[0.99]"
                >
                  <LineIcon className="w-5 h-5" />
                  <span>เข้าสู่ระบบด้วย LINE</span>
                </button>

                <p className="text-[11px] text-stone-400">
                  ข้อมูลการจัดส่งจะถูกบันทึกลงในระบบอย่างปลอดภัย 100%
                </p>
              </div>
            </div>
          )}

          {step === "details" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Profile Card Preview */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 flex items-center gap-3">
                {pictureUrl ? (
                  <img
                    src={pictureUrl}
                    alt={displayName}
                    className="w-12 h-12 rounded-full object-cover border-2 border-[#06C755] bg-white shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#06C755] text-white flex items-center justify-center font-black text-base shrink-0 shadow-xs">
                    {displayName ? displayName.charAt(0) : <LineIcon className="w-6 h-6" />}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-stone-900 text-sm truncate">
                      {displayName || "ลูกค้า LINE"}
                    </span>
                    <span className="bg-[#06C755] text-white text-[9px] font-black px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      LINE
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                    {user ? "บันทึกที่อยู่นี้สำหรับสั่งซื้อรอบถัดไป" : "กรอกที่อยู่ครั้งเดียว ใช้ได้ทุกการสั่งซื้อ"}
                  </p>
                </div>
              </div>

              {/* Form Inputs */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  ชื่อที่แสดง / ชื่อผู้รับ *
                </label>
                <input
                  required
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="เช่น คุณสมชาย หรือชื่อ LINE ของคุณ"
                  className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs bg-white focus:border-[#06C755] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  เบอร์โทรศัพท์ติดต่อ (สำหรับคนส่งทุเรียนโทรหา) *
                </label>
                <div className="relative">
                  <input
                    required
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="08X-XXX-XXXX"
                    className="w-full border border-stone-300 rounded-xl pl-9 pr-3.5 py-2.5 text-xs bg-white focus:border-[#06C755] focus:outline-none"
                  />
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  ที่อยู่จัดส่งพัสดุละเอียด *
                </label>
                <div className="relative">
                  <textarea
                    required
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="บ้านเลขที่, หมู่, ซอย, ถนน, แขวง/ตำบล, เขต/อำเภอ, จังหวัด"
                    className="w-full border border-stone-300 rounded-xl pl-9 pr-3.5 py-2.5 text-xs bg-white focus:border-[#06C755] focus:outline-none resize-none"
                  />
                  <MapPin className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  รหัสไปรษณีย์ *
                </label>
                <input
                  required
                  type="text"
                  maxLength={5}
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="เช่น 10110"
                  className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs bg-white focus:border-[#06C755] focus:outline-none font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#11301F] hover:bg-[#1B4D31] text-amber-300 py-3.5 rounded-2xl font-black text-sm transition shadow-md flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังบันทึกข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-amber-300" />
                    <span>{user ? "บันทึกการเปลี่ยนแปลง" : "ยืนยัน & เข้าสู่ระบบด้วย LINE"}</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
