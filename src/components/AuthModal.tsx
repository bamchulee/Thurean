"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  User as UserIcon,
  Lock,
  LogOut,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { LineIcon } from "./Icons";
import { useLiff } from "../lib/use-liff";
import { MapLocationPicker } from "./MapLocationPicker";

export function AuthModal() {
  const {
    user,
    isAuthModalOpen,
    closeAuthModal,
    login,
    register,
    loginWithLine,
    updateProfile,
    logout,
  } = useAuth();

  const { profile: liffProfile, inLineApp, login: liffLogin, getAccessToken } = useLiff();

  // Tab: "line" | "password" | "register" | "profile"
  const [tab, setTab] = useState<"line" | "password" | "register" | "profile">("line");

  // Profile Form State (when logged in or in LIFF)
  const [displayName, setDisplayName] = useState("");
  const [pictureUrl, setPictureUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Password Login State
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register State
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regAddress, setRegAddress] = useState("");
  const [regPostalCode, setRegPostalCode] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Sync state when modal opens or user/LIFF profile changes
  useEffect(() => {
    if (!isAuthModalOpen) return;

    setErrorMsg("");
    setSuccessMsg("");

    // Check if redirected from failed LINE Login
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const loginErr = urlParams.get("line_login_error");
      if (loginErr === "not_configured") {
        setErrorMsg(
          "LINE Login OAuth ยังไม่ได้ตั้งค่า Channel ID ในระบบหลังบ้าน (/admin) คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านหรือสั่งซื้อผ่านตะกร้าได้ทันที"
        );
        setTab("password");
        return;
      } else if (loginErr === "not_admin") {
        setErrorMsg(
          "บัญชี LINE นี้ไม่มีสิทธิ์ผู้ดูแลระบบ (Admin) จึงไม่สามารถเข้าสู่แผงควบคุมหลังบ้านได้"
        );
        setTab("line");
        return;
      } else if (loginErr) {
        setErrorMsg(
          "เข้าสู่ระบบผ่าน LINE ไม่สำเร็จ กรุณากดปุ่มด้านล่างเพื่อลองใหม่ หรือเข้าสู่ระบบด้วยชื่อผู้ใช้"
        );
        setTab("line");
        return;
      }
    }

    if (user) {
      // User is already logged in, show profile tab
      const cleanName =
        (user.displayName && !user.displayName.startsWith("line_") ? user.displayName : "") ||
        (`${user.firstName || ""} ${user.lastName || ""}`.trim() &&
        `${user.firstName || ""} ${user.lastName || ""}`.trim() !== "ลูกค้า LINE"
          ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
          : "") ||
        (user.username && !user.username.startsWith("line_") ? user.username : "");
      setDisplayName(cleanName);
      setPhone(user.phone || "");
      setAddress(user.address || "");
      setPostalCode(user.postalCode || "");
      setPictureUrl(user.avatarUrl || "");
      setTab("profile");
    } else if (liffProfile) {
      // LIFF detected customer's LINE profile
      setDisplayName(liffProfile.displayName || "");
      setPictureUrl(liffProfile.pictureUrl || "");
      setTab("profile");
    } else {
      setTab("line");
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
      setTab("profile");
      return;
    }

    if (inLineApp && typeof window !== "undefined" && (window as any).liff) {
      liffLogin();
      return;
    }

    // Redirect to real LINE Login OAuth v2.1
    window.location.href = "/api/auth/line/login";
  };

  // Submit Password Login
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);
    try {
      const res = await login(loginUsername.trim(), loginPassword.trim());
      setSubmitting(false);
      if (!res.ok) {
        setErrorMsg(res.error || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      } else {
        setSuccessMsg("เข้าสู่ระบบสำเร็จ!");
        setTimeout(() => closeAuthModal(), 1000);
      }
    } catch {
      setSubmitting(false);
      setErrorMsg("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    }
  };

  // Submit Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);
    try {
      const res = await register({
        username: regUsername.trim(),
        password: regPassword.trim(),
        firstName: regFirstName.trim(),
        lastName: regLastName.trim(),
        phone: regPhone.trim(),
        address: regAddress.trim(),
        postalCode: regPostalCode.trim(),
      });
      setSubmitting(false);
      if (!res.ok) {
        setErrorMsg(res.error || "ลงทะเบียนไม่สำเร็จ");
      } else {
        setSuccessMsg("สมัครสมาชิกและเข้าสู่ระบบสำเร็จ!");
        setTimeout(() => closeAuthModal(), 1200);
      }
    } catch {
      setSubmitting(false);
      setErrorMsg("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    }
  };

  // Submit Profile Update (when logged in or LIFF)
  const handleProfileSubmit = async (e: React.FormEvent) => {
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
      // Login via LINE LIFF: ต้องมี access token จาก LIFF ให้เซิร์ฟเวอร์ยืนยันกับ LINE
      const accessToken = getAccessToken();
      if (!accessToken) {
        setSubmitting(false);
        window.location.href = "/api/auth/line/login";
        return;
      }
      const res = await loginWithLine({
        accessToken,
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
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-emerald-900/20 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#11301F] text-white p-5 flex items-center justify-between border-b border-white/10 relative overflow-hidden shrink-0">
          <div className="flex items-center gap-3 z-10">
            <div className="w-10 h-10 rounded-2xl bg-[#06C755] flex items-center justify-center shadow-md">
              <LineIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">
                {user ? "ข้อมูลสมาชิกของคุณ" : "เข้าสู่ระบบร้านทุเรียนวินคิน"}
              </h3>
              <p className="text-[11px] text-emerald-300">
                {user
                  ? "ผูกบัญชีเรียบร้อยแล้ว"
                  : tab === "line"
                  ? "เชื่อมต่อด้วย LINE ง่ายและรวดเร็ว"
                  : tab === "password"
                  ? "เข้าสู่ระบบด้วยชื่อผู้ใช้หรือเบอร์โทร"
                  : "สมัครสมาชิกใหม่เพื่อบันทึกที่อยู่จัดส่ง"}
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

        {/* Tab switchers when unauthenticated */}
        {!user && (
          <div className="flex border-b border-stone-200 bg-stone-50 text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => {
                setTab("line");
                setErrorMsg("");
              }}
              className={`flex-1 py-3 text-center border-b-2 transition ${
                tab === "line"
                  ? "border-[#06C755] text-[#06C755] bg-white"
                  : "border-transparent text-stone-500 hover:text-stone-800"
              }`}
            >
              เข้าสู่ระบบ LINE
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("password");
                setErrorMsg("");
              }}
              className={`flex-1 py-3 text-center border-b-2 transition ${
                tab === "password"
                  ? "border-[#1B4D31] text-[#1B4D31] bg-white"
                  : "border-transparent text-stone-500 hover:text-stone-800"
              }`}
            >
              ชื่อผู้ใช้ / รหัสผ่าน
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("register");
                setErrorMsg("");
              }}
              className={`flex-1 py-3 text-center border-b-2 transition ${
                tab === "register"
                  ? "border-amber-500 text-amber-700 bg-white"
                  : "border-transparent text-stone-500 hover:text-stone-800"
              }`}
            >
              สมัครสมาชิก
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto">
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

          {/* TAB 1: LINE CONNECT */}
          {!user && tab === "line" && (
            <div className="text-center py-2 space-y-4">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-[#06C755]/10 border border-[#06C755]/30 flex items-center justify-center">
                <LineIcon className="w-12 h-12 text-[#06C755]" />
              </div>

              <div>
                <h4 className="font-extrabold text-stone-900 text-base">
                  เข้าสู่ระบบผ่าน LINE สะดวกที่สุด
                </h4>
                <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  คลิกเดียวจบ ไม่ต้องจำรหัสผ่าน เชื่อมต่อบัญชี LINE เพื่อบันทึกที่อยู่จัดส่งและรับการแจ้งเตือนพัสดุอัตโนมัติ
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleLineConnect}
                  className="w-full bg-[#06C755] hover:bg-[#05b34c] text-white py-3.5 rounded-2xl font-black text-sm transition shadow-lg shadow-emerald-700/20 flex items-center justify-center gap-2.5 active:scale-[0.99]"
                >
                  <LineIcon className="w-5 h-5 text-white" />
                  <span>เข้าสู่ระบบด้วย LINE</span>
                </button>

                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 text-left">
                  <p className="text-[11px] text-stone-600 leading-relaxed">
                    💡 <strong>สามารถสั่งซื้อแบบไม่ต้องล็อกอินได้:</strong> คุณสามารถกดเลือกสินค้าลงตะกร้า แล้วกรอกชื่อ-เบอร์โทร-ที่อยู่จัดส่งได้ทันทีตอนกดชำระเงิน
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USERNAME / PASSWORD LOGIN */}
          {!user && tab === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-4 py-1">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  ชื่อผู้ใช้ (Username) หรือเบอร์โทรศัพท์ *
                </label>
                <div className="relative">
                  <input
                    required
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="เช่น somchai หรือ 0812345678"
                    className="w-full border border-stone-300 rounded-xl pl-9 pr-3.5 py-2.5 text-xs bg-white focus:border-[#1B4D31] focus:outline-none"
                  />
                  <UserIcon className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  รหัสผ่าน (Password) *
                </label>
                <div className="relative">
                  <input
                    required
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border border-stone-300 rounded-xl pl-9 pr-3.5 py-2.5 text-xs bg-white focus:border-[#1B4D31] focus:outline-none"
                  />
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#1B4D31] hover:bg-[#143B25] text-white py-3 rounded-2xl font-bold text-xs transition shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังเข้าสู่ระบบ...</span>
                  </>
                ) : (
                  <>
                    <span>เข้าสู่ระบบ</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setTab("register")}
                  className="text-xs text-amber-700 font-bold hover:underline"
                >
                  ยังไม่มีบัญชี? กดสมัครสมาชิกใหม่ที่นี่
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: REGISTER NEW USER */}
          {!user && tab === "register" && (
            <form onSubmit={handleRegister} className="space-y-3.5 py-1">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    ชื่อ *
                  </label>
                  <input
                    required
                    type="text"
                    value={regFirstName}
                    onChange={(e) => setRegFirstName(e.target.value)}
                    placeholder="ชื่อจริง"
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white focus:border-[#1B4D31] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    นามสกุล *
                  </label>
                  <input
                    required
                    type="text"
                    value={regLastName}
                    onChange={(e) => setRegLastName(e.target.value)}
                    placeholder="นามสกุล"
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white focus:border-[#1B4D31] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    ชื่อผู้ใช้ (Username) *
                  </label>
                  <input
                    required
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="ภาษาอังกฤษหรือตัวเลข"
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white focus:border-[#1B4D31] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    รหัสผ่าน *
                  </label>
                  <input
                    required
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="อย่างน้อย 4 ตัวอักษร"
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white focus:border-[#1B4D31] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  เบอร์โทรศัพท์ติดต่อ *
                </label>
                <div className="relative">
                  <input
                    required
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="08X-XXX-XXXX"
                    className="w-full border border-stone-300 rounded-xl pl-9 pr-3 py-2 text-xs bg-white focus:border-[#1B4D31] focus:outline-none"
                  />
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  ที่อยู่จัดส่งพัสดุ *
                </label>
                <textarea
                  required
                  rows={2}
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  placeholder="บ้านเลขที่, ถนน, แขวง/ตำบล, เขต/อำเภอ, จังหวัด"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white focus:border-[#1B4D31] focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  รหัสไปรษณีย์ 5 หลัก *
                </label>
                <input
                  required
                  type="text"
                  maxLength={5}
                  value={regPostalCode}
                  onChange={(e) => setRegPostalCode(e.target.value)}
                  placeholder="เช่น 10110"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white focus:border-[#1B4D31] focus:outline-none font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-amber-500 hover:bg-amber-600 text-stone-950 py-3 rounded-2xl font-black text-xs transition shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังลงทะเบียน...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>สมัครสมาชิก</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 4: PROFILE & SHIPPING ADDRESS (When logged in or LIFF) */}
          {(user || tab === "profile") && (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
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
                    {displayName ? displayName.charAt(0) : <LineIcon className="w-6 h-6 text-white" />}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-stone-900 text-sm truncate">
                      {displayName || "ลูกค้า LINE"}
                    </span>
                    {user?.lineUserId ? (
                      <span className="bg-[#06C755] text-white text-[9px] font-black px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        LINE
                      </span>
                    ) : (
                      <span className="bg-stone-200 text-stone-700 text-[9px] font-black px-1.5 py-0.2 rounded-full">
                        @{user?.username || "user"}
                      </span>
                    )}
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

                <div className="mb-2">
                  <MapLocationPicker
                    address={address}
                    postalCode={postalCode}
                    onAddressChange={(newAddr) => setAddress(newAddr)}
                    onPostalCodeChange={(newPost) => setPostalCode(newPost)}
                  />
                </div>

                <div className="relative">
                  <textarea
                    required
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="บ้านเลขที่, หมู่, ซอย, ถนน, แขวง/ตำบล, เขต/อำเภอ, จังหวัด (หรือกดปุ่มปักหมุดด้านบน)"
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

              <div className="space-y-2 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#11301F] hover:bg-[#1B4D31] text-amber-300 py-3.5 rounded-2xl font-black text-sm transition shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
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

                {user && (
                  <button
                    type="button"
                    onClick={async () => {
                      await logout();
                      closeAuthModal();
                    }}
                    className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>ออกจากระบบ</span>
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
