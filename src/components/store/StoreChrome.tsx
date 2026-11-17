"use client";

import {
  ChevronRight,
  House,
  LogOut,
  MapPin,
  Package,
  Phone,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingBasket,
  User as UserIcon,
  X,
} from "lucide-react";
import { shopInfo } from "../../data/shop";
import { useAuth } from "../../context/AuthContext";
import { LineIcon } from "../Icons";
import { LineDirectLink } from "../LineDirectLink";
import { Sheet } from "./Sheet";
import { displayName } from "./ProductSheet";

const LINE_HELLO = "สวัสดีครับ สนใจสั่งซื้อทุเรียนวินคินครับ";

function CartButton({ count, onClick, className = "" }: { count: number; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={`ตะกร้า ${count} ชิ้น`} className={`relative p-2 rounded-full hover:bg-black/5 ${className}`}>
      <ShoppingBasket className="w-6 h-6" />
      {count > 0 && (
        <span className="absolute top-0.5 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-[#D9480F] text-white text-[10px] font-bold leading-[18px] text-center border-2 border-[#FFFBEA]">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

/** หัวร้านแบบแอปช้อปปิ้ง: แถบประกาศ 1 บรรทัด + โลโก้/ค้นหา/บัญชี/ตะกร้า (ติดด้านบน) */
export function StoreHeader({
  cartCount,
  onOpenCart,
  query,
  onQuery,
  onOpenAccount,
}: {
  cartCount: number;
  onOpenCart: () => void;
  query: string;
  onQuery: (q: string) => void;
  onOpenAccount: () => void;
}) {
  const { user, loading, openAuthModal } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "staff";

  const search = (
    <label className="relative flex-1 min-w-0">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
      <input
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="ค้นหาทุเรียน พันธุ์ สวน…"
        className="w-full h-9 rounded-full bg-white border border-stone-300 pl-9 pr-8 text-sm focus:outline-none focus:border-[#1B4D31] focus:ring-2 focus:ring-[#1B4D31]/15"
      />
      {query && (
        <button type="button" onClick={() => onQuery("")} aria-label="ล้างคำค้น" className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-stone-400">
          <X className="w-4 h-4" />
        </button>
      )}
    </label>
  );

  return (
    <>
      <div className="bg-[#1B4D31] text-[#FFD84D] text-[11px] leading-tight">
        <div className="max-w-6xl mx-auto px-3 py-1.5 flex items-center justify-between gap-3">
          <p className="truncate min-w-0">🚚 คัดสดจากสวนระยอง-จันทบุรี แก่จัด 85%+ เคลมได้ 100%</p>
          <a href={`tel:${shopInfo.phone.replace(/-/g, "")}`} className="hidden sm:inline-flex items-center gap-1 shrink-0 font-semibold hover:underline">
            <Phone className="w-3 h-3" /> {shopInfo.phone}
          </a>
        </div>
      </div>

      <header className="sticky top-0 z-40 bg-[#FFFBEA]/95 backdrop-blur border-b border-amber-200/70 text-[#1B4D31]">
        <div className="max-w-6xl mx-auto px-3 h-14 flex items-center gap-2 sm:gap-4">
          <a href="#top" className="flex items-center gap-2 shrink-0 min-w-0">
            <img src={shopInfo.logo} alt="" className="w-9 h-9 rounded-full border border-amber-200 bg-white object-cover" />
            <span className="min-w-0">
              <span className="block text-[15px] font-extrabold leading-tight whitespace-nowrap">{shopInfo.name}</span>
              <span className="block text-[10px] text-stone-500 leading-tight whitespace-nowrap">ส่งตรงจากสวน</span>
            </span>
          </a>

          <div className="hidden md:flex flex-1 max-w-xl">{search}</div>

          <nav className="hidden lg:flex items-center gap-4 text-xs font-semibold text-stone-600 shrink-0">
            <a href="/tracking" className="hover:text-[#1B4D31]">เช็กออเดอร์</a>
            <a href="/claim" className="hover:text-[#1B4D31]">แจ้งเคลม</a>
            {canManage && (
              <a href="/admin" className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-400 text-stone-950">
                <ShieldAlert className="w-3.5 h-3.5" /> หลังบ้าน
              </a>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-0.5 shrink-0">
            {loading && !user ? (
              <span className="w-8 h-8 rounded-full bg-stone-200 animate-pulse" />
            ) : user ? (
              <button type="button" onClick={onOpenAccount} aria-label="บัญชีของฉัน" className="p-1 rounded-full hover:bg-black/5">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-emerald-300 bg-white" />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-[#1B4D31] text-[#FFD84D] text-xs font-bold flex items-center justify-center">
                    {(displayName(user) || "ส").charAt(0)}
                  </span>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal()}
                className="h-8 px-3 rounded-full bg-[#1B4D31] text-white text-xs font-bold inline-flex items-center gap-1"
              >
                <UserIcon className="w-3.5 h-3.5" /> เข้าสู่ระบบ
              </button>
            )}
            <CartButton count={cartCount} onClick={onOpenCart} className="hidden md:inline-flex" />
          </div>
        </div>
        <div className="md:hidden px-3 pb-2 flex">{search}</div>
      </header>
    </>
  );
}

/** แผ่นบัญชีของฉัน (แทนเมนูดรอปดาวน์/แฮมเบอร์เกอร์เดิม) */
export function AccountSheet({ onClose }: { onClose: () => void }) {
  const { user, logout, openAuthModal } = useAuth();
  if (!user) return null;
  const canManage = user.role === "admin" || user.role === "staff";
  const row = "flex items-center gap-3 px-4 py-3 text-sm text-stone-800 hover:bg-stone-50";
  return (
    <Sheet title="บัญชีของฉัน" onClose={onClose}>
      <div className="px-4 py-3 flex items-center gap-3 border-b border-stone-100">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover border border-emerald-300" />
        ) : (
          <span className="w-11 h-11 rounded-full bg-[#1B4D31] text-[#FFD84D] font-bold flex items-center justify-center">{(displayName(user) || "ส").charAt(0)}</span>
        )}
        <div className="min-w-0">
          <p className="font-bold text-stone-900 truncate">{displayName(user) || "สมาชิก"}</p>
          <p className="text-xs text-stone-500 truncate">
            {user.lineUserId ? "เชื่อม LINE แล้ว" : "ยังไม่เชื่อม LINE"}
            {user.phone ? ` • ${user.phone}` : ""}
          </p>
        </div>
      </div>
      <div className="divide-y divide-stone-100">
        {canManage && (
          <a href="/admin" className={`${row} bg-amber-50 font-bold`}>
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <span className="flex-1">{user.role === "admin" ? "หลังบ้านร้าน" : "งานพนักงาน"}</span>
            <ChevronRight className="w-4 h-4 text-stone-400" />
          </a>
        )}
        <button
          type="button"
          className={`${row} w-full text-left`}
          onClick={() => {
            onClose();
            openAuthModal("line");
          }}
        >
          <MapPin className="w-5 h-5 text-emerald-700" />
          <span className="flex-1">ที่อยู่จัดส่ง & ข้อมูลของฉัน</span>
          <ChevronRight className="w-4 h-4 text-stone-400" />
        </button>
        <a href="/tracking" className={row}>
          <Package className="w-5 h-5 text-emerald-700" />
          <span className="flex-1">ออเดอร์ของฉัน & เช็กพัสดุ</span>
          <ChevronRight className="w-4 h-4 text-stone-400" />
        </a>
        <a href="/claim" className={row}>
          <ShieldCheck className="w-5 h-5 text-amber-600" />
          <span className="flex-1">แจ้งเคลมสินค้า</span>
          <ChevronRight className="w-4 h-4 text-stone-400" />
        </a>
        <button
          type="button"
          className={`${row} w-full text-left text-rose-600`}
          onClick={() => {
            onClose();
            logout();
          }}
        >
          <LogOut className="w-5 h-5" />
          <span className="flex-1">ออกจากระบบ</span>
        </button>
      </div>
    </Sheet>
  );
}

/** แถบเมนูล่างจอสำหรับมือถือ (เหมือนแอปช้อปปิ้ง) */
export function BottomNav({ cartCount, onOpenCart, onOpenAccount }: { cartCount: number; onOpenCart: () => void; onOpenAccount: () => void }) {
  const item = "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-stone-500 active:text-[#1B4D31]";
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-stone-200 pb-[env(safe-area-inset-bottom)]">
      <div className="h-14 flex">
        <a href="#top" className={`${item} text-[#1B4D31]`}>
          <House className="w-5 h-5" />
          หน้าร้าน
        </a>
        <button type="button" onClick={onOpenCart} className={`${item} relative`}>
          <span className="relative">
            <ShoppingBasket className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#D9480F] text-white text-[9px] font-bold leading-4 text-center">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </span>
          ตะกร้า
        </button>
        <LineDirectLink prefillText={LINE_HELLO} className={item} ariaLabel="แชท LINE">
          <LineIcon className="w-5 h-5 text-[#06C755]" />
          แชทร้าน
        </LineDirectLink>
        <a href="/tracking" className={item}>
          <Package className="w-5 h-5" />
          ออเดอร์
        </a>
        <button type="button" onClick={onOpenAccount} className={item}>
          <UserIcon className="w-5 h-5" />
          ฉัน
        </button>
      </div>
    </nav>
  );
}

/** ปุ่มลอยมุมขวาล่างสำหรับจอใหญ่ (มือถือใช้แถบล่างแทน) */
export function DesktopFloating() {
  return (
    <div className="hidden md:flex fixed bottom-5 right-5 z-40 flex-col gap-2 items-end">
      <LineDirectLink
        prefillText={LINE_HELLO}
        ariaLabel="แชท LINE"
        className="h-11 px-4 rounded-full bg-[#06C755] hover:bg-[#05b34c] text-white shadow-lg flex items-center gap-2 text-sm font-bold"
      >
        <LineIcon className="w-5 h-5" /> แชทสั่งทาง LINE
      </LineDirectLink>
    </div>
  );
}

