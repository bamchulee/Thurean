"use client";

// ก่อนกดสั่งซื้อ: ต้องเข้าสู่ระบบ และเชื่อม LINE แล้ว (ร้านส่งยอด/QR/สถานะทาง LINE)
import { LineIcon } from "./Icons";
import { useAuth } from "../context/AuthContext";
import type { SafeUser } from "../types/durian";

export function canCheckout(user: SafeUser | null): boolean {
  return Boolean(user?.lineUserId);
}

export function CheckoutAccountGate() {
  const { user, providers, openAuthModal, authUrl } = useAuth();

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => openAuthModal()}
        className="w-full bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl p-3 text-xs flex items-center justify-between text-amber-950 transition text-left"
      >
        <span className="font-semibold">เข้าสู่ระบบก่อนสั่งซื้อ (LINE / Google / Facebook)</span>
        <span className="font-extrabold underline text-[11px] shrink-0">เข้าสู่ระบบ</span>
      </button>
    );
  }

  if (!user.lineUserId) {
    return (
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-950 space-y-2">
        <p className="font-semibold">เชื่อมบัญชี LINE ก่อนสั่งซื้อ — ร้านส่งยอดเงินหลังชั่งและสถานะออเดอร์ทาง LINE</p>
        {providers.line && (
          <a
            href={authUrl("line", "link")}
            className="w-full bg-[#06C755] hover:bg-[#05b34c] text-white rounded-lg py-2 font-bold flex items-center justify-center gap-1.5"
          >
            <LineIcon className="w-4 h-4" /> เชื่อม LINE
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-800 flex items-center justify-between">
      <span className="flex items-center gap-1.5 font-bold">
        <LineIcon className="w-4 h-4 text-[#06C755]" />
        {user.displayName || user.firstName || "สมาชิก"} — รับแจ้งเตือนทาง LINE
      </span>
      <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-bold">เชื่อมแล้ว</span>
    </div>
  );
}
