"use client";

import React, { useState, useRef } from "react";
import {
  X,
  User as UserIcon,
  Lock,
  Phone,
  MapPin,
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { DurianIcon } from "./Icons";

// Preset cute avatar icons for users who don't want to take/upload a photo
const PRESET_AVATARS = [
  { name: "พูทองคิง", url: "https://api.dicebear.com/7.x/bottts/svg?seed=MonthongKing&backgroundColor=fef08a" },
  { name: "สายกรอบ", url: "https://api.dicebear.com/7.x/bottts/svg?seed=CrispyDurian&backgroundColor=bbf7d0" },
  { name: "สายหวานมัน", url: "https://api.dicebear.com/7.x/bottts/svg?seed=CreamyDurian&backgroundColor=fed7aa" },
  { name: "นักชิมวินคิน", url: "https://api.dicebear.com/7.x/bottts/svg?seed=WinkinFan&backgroundColor=e9d5ff" },
];

export function AuthModal() {
  const {
    isAuthModalOpen,
    authModalMode,
    closeAuthModal,
    setAuthModalMode,
    login,
    register,
  } = useAuth();

  // Login Form State
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register Form State
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regAddress, setRegAddress] = useState("");
  const [regPostalCode, setRegPostalCode] = useState("");
  const [regAvatarUrl, setRegAvatarUrl] = useState(PRESET_AVATARS[0].url);

  // Upload state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isAuthModalOpen) return null;

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setErrorMsg("");

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/upload/avatar", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.ok || !json.url) {
        setErrorMsg(json.error || "อัปโหลดรูปไม่สำเร็จ");
      } else {
        setRegAvatarUrl(json.url);
      }
    } catch (err) {
      setErrorMsg(`เกิดข้อผิดพลาดในการอัปโหลดรูป: ${String(err)}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    const res = await login(loginUsername, loginPassword);
    setSubmitting(false);

    if (!res.ok) {
      setErrorMsg(res.error || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    } else {
      setSuccessMsg("เข้าสู่ระบบสำเร็จ!");
      setTimeout(() => {
        closeAuthModal();
      }, 700);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (regPassword !== regConfirmPassword) {
      setErrorMsg("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    if (regPostalCode.trim().length !== 5) {
      setErrorMsg("รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก");
      return;
    }

    setSubmitting(true);

    const res = await register({
      username: regUsername.trim(),
      password: regPassword,
      firstName: regFirstName.trim(),
      lastName: regLastName.trim(),
      phone: regPhone.trim(),
      address: regAddress.trim(),
      postalCode: regPostalCode.trim(),
      avatarUrl: regAvatarUrl,
    });

    setSubmitting(false);

    if (!res.ok) {
      setErrorMsg(res.error || "สมัครสมาชิกไม่สำเร็จ");
    } else {
      setSuccessMsg("สมัครสมาชิกและบันทึกข้อมูลลง Google Sheet สำเร็จ!");
      setTimeout(() => {
        closeAuthModal();
      }, 900);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-amber-300 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#11301F] via-[#1B4D31] to-[#143B25] text-white p-5 sm:p-6 relative shrink-0">
          <button
            type="button"
            onClick={closeAuthModal}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg bg-[#FFD84D] text-[#1B4D31] flex items-center justify-center">
              <DurianIcon className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-amber-300">
              สมาชิกทุเรียนวินคิน (Durian Winkin Member)
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-extrabold text-white">
            {authModalMode === "login" ? "เข้าสู่ระบบสมาชิก" : "สมัครสมาชิกใหม่"}
          </h3>
          <p className="text-xs text-stone-200 mt-1">
            {authModalMode === "login"
              ? "เข้าสู่ระบบเพื่อสั่งซื้อสะดวกรวดเร็ว ไม่ต้องพิมพ์ที่อยู่ซ้ำ"
              : "สมัครสมาชิกครั้งเดียว กรอกที่อยู่จัดส่งให้อัตโนมัติทุกรอบ"}
          </p>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-black/25 p-1 rounded-xl mt-4 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setAuthModalMode("login");
                setErrorMsg("");
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                authModalMode === "login"
                  ? "bg-[#FFD84D] text-stone-950 shadow-sm"
                  : "text-stone-300 hover:text-white"
              }`}
            >
              เข้าสู่ระบบ
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthModalMode("register");
                setErrorMsg("");
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                authModalMode === "register"
                  ? "bg-[#FFD84D] text-stone-950 shadow-sm"
                  : "text-stone-300 hover:text-white"
              }`}
            >
              สมัครสมาชิกใหม่
            </button>
          </div>
        </div>

        {/* Form Body (Scrollable) */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-bold">{successMsg}</span>
            </div>
          )}

          {/* ===================== LOGIN FORM ===================== */}
          {authModalMode === "login" && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  ชื่อผู้ใช้ (Username) หรือเบอร์โทรศัพท์ *
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="เช่น somchai99 หรือ 0812345678"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-[#1B4D31] focus:ring-1 focus:ring-[#1B4D31] outline-hidden transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  รหัสผ่าน (Password) *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="กรอกรหัสผ่านของคุณ"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-[#1B4D31] focus:ring-1 focus:ring-[#1B4D31] outline-hidden transition"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-[#1B4D31] hover:bg-[#143B25] text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                      <span>กำลังเข้าสู่ระบบ...</span>
                    </>
                  ) : (
                    <span>เข้าสู่ระบบ</span>
                  )}
                </button>
              </div>

              <p className="text-center text-xs text-stone-500 pt-2">
                ยังไม่มีบัญชีสมาชิก?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalMode("register");
                    setErrorMsg("");
                  }}
                  className="text-[#1B4D31] font-bold underline hover:text-[#143B25] cursor-pointer"
                >
                  สมัครสมาชิกใหม่ที่นี่
                </button>
              </p>
            </form>
          )}

          {/* ===================== REGISTER FORM ===================== */}
          {authModalMode === "register" && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              
              {/* Profile Image / Avatar Picker */}
              <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200 space-y-2">
                <span className="block text-xs font-bold text-stone-800">
                  รูปภาพประจำตัว (Avatar) *
                </span>
                
                <div className="flex items-center gap-4">
                  {/* Avatar Preview */}
                  <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-white border-2 border-[#1B4D31] shadow-xs shrink-0 flex items-center justify-center">
                    <img
                      src={regAvatarUrl}
                      alt="รูปโปรไฟล์"
                      className="w-full h-full object-cover"
                    />
                    {uploadingImage && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Upload Button & Action */}
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageFileChange}
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-amber-600" />
                      <span>{uploadingImage ? "กำลังอัปโหลด..." : "แนบรูปจากเครื่อง"}</span>
                    </button>
                    <p className="text-[10px] text-stone-500">
                      รองรับ JPG, PNG หรือเลือกมาสคอตน่ารักด้านล่าง
                    </p>
                  </div>
                </div>

                {/* Presets */}
                <div className="pt-1 flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-[10px] font-bold text-stone-500 shrink-0">
                    หรือเลือกรูป:
                  </span>
                  {PRESET_AVATARS.map((av, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRegAvatarUrl(av.url)}
                      className={`w-7 h-7 rounded-lg overflow-hidden border-2 shrink-0 transition cursor-pointer ${
                        regAvatarUrl === av.url
                          ? "border-[#1B4D31] ring-2 ring-[#1B4D31]/30 scale-105"
                          : "border-stone-200 hover:border-amber-400 opacity-70 hover:opacity-100"
                      }`}
                      title={av.name}
                    >
                      <img src={av.url} alt={av.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Username & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    ชื่อผู้ใช้ (Username) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ภาษาอังกฤษหรือตัวเลข"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-[#1B4D31] focus:ring-1 focus:ring-[#1B4D31] outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    เบอร์โทรศัพท์ติดต่อ *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="เช่น 0812345678"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-[#1B4D31] focus:ring-1 focus:ring-[#1B4D31] outline-hidden"
                  />
                </div>
              </div>

              {/* Password & Confirm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    รหัสผ่าน (Password) *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="อย่างน้อย 4 ตัวอักษร"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-[#1B4D31] focus:ring-1 focus:ring-[#1B4D31] outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    ยืนยันรหัสผ่าน *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="กรอกรหัสผ่านซ้ำอีกครั้ง"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-[#1B4D31] focus:ring-1 focus:ring-[#1B4D31] outline-hidden"
                  />
                </div>
              </div>

              {/* First Name & Last Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    ชื่อจริง *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น สมชาย"
                    value={regFirstName}
                    onChange={(e) => setRegFirstName(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-[#1B4D31] focus:ring-1 focus:ring-[#1B4D31] outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    นามสกุล *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ใจดี"
                    value={regLastName}
                    onChange={(e) => setRegLastName(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-[#1B4D31] focus:ring-1 focus:ring-[#1B4D31] outline-hidden"
                  />
                </div>
              </div>

              {/* Address & Postal Code */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  ที่อยู่จัดส่งทุเรียน (บ้านเลขที่ / หมู่บ้าน / ถนน / ตำบล / อำเภอ / จังหวัด) *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="เช่น 123/45 หมู่บ้านพฤกษา ซอย 5 ถ.สุขุมวิท ต.เนินพระ อ.เมือง จ.ระยอง"
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-[#1B4D31] focus:ring-1 focus:ring-[#1B4D31] outline-hidden resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  รหัสไปรษณีย์ (5 หลัก) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  placeholder="เช่น 21000"
                  value={regPostalCode}
                  onChange={(e) => setRegPostalCode(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:w-1/2 focus:bg-white focus:border-[#1B4D31] focus:ring-1 focus:ring-[#1B4D31] outline-hidden font-mono"
                />
              </div>

              {/* Privacy Notice */}
              <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 text-[11px] text-stone-500">
                🔒 ข้อมูลของท่านจะถูกบันทึกอย่างปลอดภัยลงใน Google Sheet ฐานข้อมูลร้านทุเรียนวินคิน และรหัสผ่านจะถูกเข้ารหัสระดับสูง (One-way Hash) เพื่อความปลอดภัยสูงสุด
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || uploadingImage}
                  className="w-full py-3 bg-[#1B4D31] hover:bg-[#143B25] text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                      <span>กำลังบันทึกลง Google Sheet...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>ยืนยันสมัครสมาชิก &amp; บันทึกข้อมูล</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-center text-xs text-stone-500 pt-1">
                มีบัญชีอยู่แล้ว?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalMode("login");
                    setErrorMsg("");
                  }}
                  className="text-[#1B4D31] font-bold underline hover:text-[#143B25] cursor-pointer"
                >
                  เข้าสู่ระบบที่นี่
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
