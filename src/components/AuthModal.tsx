"use client";

// หน้าต่างบัญชีสมาชิก: เข้าสู่ระบบด้วย LINE / Google, เชื่อมช่องทางอื่น, แก้ชื่อ-ที่อยู่
// ทุกคนต้องเชื่อม LINE ก่อนสั่งซื้อ (ร้านส่งยอดเงิน QR และสถานะออเดอร์ทาง LINE)
import React, { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Link2, LogOut, ShieldCheck, X } from "lucide-react";
import { type AuthProviderName, useAuth } from "../context/AuthContext";
import { LineIcon } from "./Icons";
import { shopInfo } from "../data/shop";
import { GOOGLE_LOGIN_ENABLED } from "../lib/feature-flags";
import { AddressForm } from "./address/AddressForm";
import { EMPTY_ADDRESS, addressErrors, formatThaiAddress, inThailand, type AddressValue } from "../lib/thai-address";

// Google ปิดไว้ก่อน (lib/feature-flags.ts) — ไม่โชว์ทั้งปุ่มเข้าสู่ระบบและปุ่มเชื่อมบัญชี
const PROVIDERS: { id: AuthProviderName; label: string }[] = (
  [
    { id: "line", label: "LINE" },
    { id: "google", label: "Google" },
  ] as { id: AuthProviderName; label: string }[]
).filter((p) => p.id !== "google" || GOOGLE_LOGIN_ENABLED);

const ERROR_TEXT: Record<string, string> = {
  invalid_state: "ลิงก์เข้าสู่ระบบหมดอายุ กรุณากดใหม่อีกครั้ง",
  cancelled: "ยกเลิกการเข้าสู่ระบบแล้ว",
  login_required: "กรุณาเข้าสู่ระบบก่อนเชื่อมบัญชี",
  line_failed: "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองใหม่อีกครั้ง",
  google_failed: "เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองใหม่อีกครั้ง",
  line_not_configured: "ร้านยังไม่ได้เปิดใช้การเข้าสู่ระบบด้วย LINE",
  google_not_configured: "ร้านยังไม่ได้เปิดใช้การเข้าสู่ระบบด้วย Google",
};

function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

const PROVIDER_STYLE: Record<AuthProviderName, string> = {
  line: "bg-[#06C755] hover:bg-[#05b34c] text-white",
  google: "bg-white hover:bg-stone-50 text-stone-800 border border-stone-300",
};

function ProviderIcon({ id, className }: { id: AuthProviderName; className?: string }) {
  if (id === "line") return <LineIcon className={className} />;
  return <GoogleIcon className={className} />;
}

function linkedOf(user: { lineUserId?: string; googleId?: string }): Record<AuthProviderName, boolean> {
  return { line: Boolean(user.lineUserId), google: Boolean(user.googleId) };
}

export function AuthModal() {
  const { user, providers, isAuthModalOpen, closeAuthModal, authUrl, updateProfile, logout } = useAuth();

  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [notFriend, setNotFriend] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  // แก้ที่อยู่ด้วยฟอร์มแบบปักหมุด (ไม่กดแก้ = ใช้ที่อยู่เดิม)
  const [editAddr, setEditAddr] = useState(false);
  const [addr, setAddr] = useState<AddressValue>(EMPTY_ADDRESS);

  // ข้อความจากการกลับมาจากหน้าล็อกอิน (?auth_error= / ?linked= / ?line_friend=0)
  useEffect(() => {
    if (!isAuthModalOpen) return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get("auth_error");
    const linked = params.get("linked") as AuthProviderName | null;
    /* eslint-disable react-hooks/set-state-in-effect -- อ่านค่าจาก URL ครั้งเดียวตอนเปิดหน้าต่าง */
    if (err) setNotice({ ok: false, text: params.get("auth_message") || ERROR_TEXT[err] || "เข้าสู่ระบบไม่สำเร็จ" });
    else if (linked) setNotice({ ok: true, text: `เชื่อมบัญชี ${PROVIDERS.find((p) => p.id === linked)?.label || linked} เรียบร้อยแล้ว` });
    setNotFriend(params.get("line_friend") === "0");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isAuthModalOpen]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- เติมฟอร์มจากข้อมูลบัญชีล่าสุด
    setForm({
      firstName: user.firstName || user.displayName || "",
      lastName: user.lastName || "",
      phone: user.phone || "",
      address: user.address || "",
    });
  }, [user]);

  if (!isAuthModalOpen) return null;

  const close = () => {
    const url = new URL(window.location.href);
    for (const k of ["login", "linked", "auth_error", "auth_message", "line_friend"]) url.searchParams.delete(k);
    window.history.replaceState({}, "", url.pathname + url.search);
    setNotice(null);
    closeAuthModal();
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.phone.replace(/\D/g, "").length < 9) {
      setNotice({ ok: false, text: "กรุณากรอกเบอร์โทร 9-10 หลัก" });
      return;
    }
    let patch: Record<string, unknown> = { ...form };
    if (editAddr) {
      const pinned = { ...addr, lat: addr.lat ?? user?.latitude, lng: addr.lng ?? user?.longitude };
      const missing = addressErrors(pinned, { contact: false });
      if (missing.length) {
        setNotice({ ok: false, text: `กรอกที่อยู่ให้ครบ: ${missing.join(", ")}` });
        return;
      }
      patch = {
        ...patch,
        address: formatThaiAddress({ ...pinned, postalCode: "" }),
        postalCode: pinned.postalCode,
        ...(inThailand(pinned.lat, pinned.lng) ? { latitude: pinned.lat, longitude: pinned.lng } : {}),
      };
    }
    setSaving(true);
    const res = await updateProfile(patch);
    if (res.ok) setEditAddr(false);
    setSaving(false);
    setNotice(res.ok ? { ok: true, text: "บันทึกข้อมูลแล้ว" } : { ok: false, text: res.error || "บันทึกไม่สำเร็จ" });
  };

  const enabled = PROVIDERS.filter((p) => providers[p.id]);
  const linked = user ? linkedOf(user) : null;
  const addFriendUrl = `https://line.me/R/ti/p/${encodeURIComponent(shopInfo.lineOA)}`;

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={close}>
      <div
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-lg font-extrabold text-stone-900">{user ? "บัญชีของฉัน" : "เข้าสู่ระบบ"}</h2>
          <button type="button" onClick={close} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700" aria-label="ปิด">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {notice && (
            <div
              className={`text-sm rounded-2xl p-3 flex items-start gap-2 ${
                notice.ok ? "bg-emerald-50 text-emerald-900 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              {notice.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>{notice.text}</span>
            </div>
          )}

          {!user && (
            <>
              <p className="text-sm text-stone-600">
                เลือกช่องทางที่สะดวก — สั่งซื้อได้หลังเชื่อมบัญชี LINE เพื่อรับยอดเงินและสถานะออเดอร์ทาง LINE
              </p>
              <div className="space-y-2.5">
                {enabled.map((p) => (
                  <a
                    key={p.id}
                    href={authUrl(p.id)}
                    className={`w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition ${PROVIDER_STYLE[p.id]}`}
                  >
                    <ProviderIcon id={p.id} className="w-5 h-5" />
                    <span>เข้าสู่ระบบด้วย {p.label}</span>
                  </a>
                ))}
                {enabled.length === 0 && (
                  <p className="text-sm text-stone-500 text-center py-4">ร้านยังไม่ได้เปิดระบบสมาชิก — ติดต่อ LINE {shopInfo.lineOA}</p>
                )}
              </div>
              <p className="text-[11px] text-stone-400 text-center">
                การเข้าสู่ระบบถือว่ายอมรับ{" "}
                <a href="/privacy" className="underline">
                  นโยบายความเป็นส่วนตัว
                </a>
              </p>
            </>
          )}

          {user && linked && (
            <>
              <div className="flex items-center gap-3">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover border border-stone-200" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-lg">🍈</div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-stone-900 truncate">{user.displayName || user.firstName || "สมาชิก"}</p>
                  {user.email && <p className="text-xs text-stone-500 truncate">{user.email}</p>}
                </div>
                {(user.role === "superadmin" || user.role === "admin" || user.role === "staff") && (
                  <a
                    href="/admin"
                    className="ml-auto text-xs font-bold bg-[#1B4D31] text-white px-3 py-1.5 rounded-xl inline-flex items-center gap-1"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {user.role === "staff" ? "งานพนักงาน" : "หลังบ้าน"}
                  </a>
                )}
              </div>

              {!linked.line && (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 text-sm text-amber-900">
                  <p className="font-bold">ต้องเชื่อม LINE ก่อนสั่งซื้อ</p>
                  <p className="text-xs mt-1">ร้านส่งยอดเงินหลังชั่ง QR ชำระเงิน และสถานะจัดส่งให้ทาง LINE</p>
                  {providers.line && (
                    <a
                      href={authUrl("line", "link")}
                      className={`mt-3 w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${PROVIDER_STYLE.line}`}
                    >
                      <LineIcon className="w-4 h-4" /> เชื่อม LINE
                    </a>
                  )}
                </div>
              )}

              {linked.line && notFriend && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3.5 text-sm text-emerald-900">
                  <p className="font-bold">เพิ่มเพื่อน LINE ร้านด้วยนะครับ</p>
                  <p className="text-xs mt-1">ไม่งั้นจะไม่ได้รับยอดเงินและสถานะออเดอร์ทาง LINE</p>
                  <a href={addFriendUrl} target="_blank" rel="noreferrer" className={`mt-3 w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${PROVIDER_STYLE.line}`}>
                    <LineIcon className="w-4 h-4" /> เพิ่มเพื่อน {shopInfo.lineOA}
                  </a>
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-stone-500 mb-2">ช่องทางเข้าสู่ระบบของบัญชีนี้</p>
                <div className="space-y-2">
                  {PROVIDERS.filter((p) => linked[p.id] || providers[p.id]).map((p) => (
                    <div key={p.id} className="flex items-center justify-between border border-stone-200 rounded-xl px-3 py-2">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-stone-800">
                        <ProviderIcon id={p.id} className={`w-4 h-4 ${p.id === "line" ? "text-[#06C755]" : ""}`} />
                        {p.label}
                      </span>
                      {linked[p.id] ? (
                        <span className="text-xs font-bold text-emerald-700 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> เชื่อมแล้ว
                        </span>
                      ) : (
                        <a href={authUrl(p.id, "link")} className="text-xs font-bold text-[#1B4D31] inline-flex items-center gap-1">
                          <Link2 className="w-3.5 h-3.5" /> เชื่อม
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={saveProfile} className="space-y-2.5 pt-1">
                <p className="text-xs font-bold text-stone-500">ข้อมูลผู้รับสินค้า</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    placeholder="ชื่อ"
                    className="border border-stone-300 rounded-xl px-3 py-2.5 text-sm"
                  />
                  <input
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    placeholder="นามสกุล"
                    className="border border-stone-300 rounded-xl px-3 py-2.5 text-sm"
                  />
                </div>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="เบอร์โทร"
                  inputMode="tel"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2.5 text-sm font-mono"
                />
                <p className="text-xs font-bold text-stone-500 pt-1">ที่อยู่จัดส่ง</p>
                {editAddr ? (
                  <div className="rounded-xl border border-stone-200 p-2.5">
                    <AddressForm
                      value={{ ...addr, lat: addr.lat ?? user?.latitude, lng: addr.lng ?? user?.longitude }}
                      onChange={setAddr}
                      showContact={false}
                    />
                    <button type="button" onClick={() => setEditAddr(false)} className="mt-2 text-xs font-bold text-stone-500 underline">
                      ยกเลิก ใช้ที่อยู่เดิม
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-stone-200 p-3 flex items-start gap-2">
                    <span className="text-[#D9480F]">📍</span>
                    <p className="flex-1 text-sm text-stone-700 break-words">
                      {[user?.address, user?.postalCode && !(user?.address || "").includes(user.postalCode) ? user.postalCode : ""].filter(Boolean).join(" ") || "ยังไม่มีที่อยู่"}
                      {inThailand(user?.latitude, user?.longitude) && <span className="block text-[11px] text-emerald-700">📌 มีหมุดแผนที่</span>}
                    </p>
                    <button type="button" onClick={() => setEditAddr(true)} className="shrink-0 text-xs font-bold text-[#D9480F]">
                      {user?.address ? "แก้ไข / ปักหมุด" : "เพิ่มที่อยู่"}
                    </button>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-[#1B4D31] hover:bg-[#143B25] text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                </button>
              </form>

              <button
                type="button"
                onClick={async () => {
                  await logout();
                  close();
                }}
                className="w-full text-sm text-stone-500 hover:text-stone-800 inline-flex items-center justify-center gap-1.5 py-2"
              >
                <LogOut className="w-4 h-4" /> ออกจากระบบ
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
