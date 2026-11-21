"use client";

import {
  ChevronLeft,
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
    <button type="button" onClick={onClick} aria-label={`ตะกร้า ${count} ชิ้น`} className={`relative p-2 rounded-full text-white hover:bg-white/10 ${className}`}>
      <ShoppingBasket className="w-6 h-6" />
      {count > 0 && (
        <span className="absolute top-0.5 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FFD84D] text-[#11301F] text-[10px] font-extrabold leading-[18px] text-center ring-2 ring-[#1B4D31]">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

/**
 * หัวร้านแบบแอปช้อปปิ้ง: แถบเขียวร้าน + ช่องค้นหาสีขาวตรงกลาง + ไอคอนขาว (ติดด้านบนตลอด)
 * มือถือ: โลโก้ · ค้นหา · แชท LINE · ตะกร้า   |   จอใหญ่: โลโก้+ชื่อ · ค้นหา · เมนู · บัญชี · ตะกร้า
 */
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
  const canManage = user?.role === "superadmin" || user?.role === "admin" || user?.role === "staff";

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-[#11301F] via-[#1B4D31] to-[#24603D] shadow-sm">
      <div className="max-w-6xl mx-auto px-3 h-14 md:h-16 flex items-center gap-2.5 md:gap-5">
        <a href="#top" className="flex items-center gap-2 shrink-0">
          <img src={shopInfo.logo} alt={shopInfo.name} className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white object-cover ring-2 ring-[#FFD84D]/70" />
          <span className="hidden md:block leading-tight">
            <span className="block text-base font-extrabold text-white">{shopInfo.name}</span>
            <span className="block text-[11px] text-[#FFD84D]">คัดสดจากสวน ส่งตรงถึงบ้าน</span>
          </span>
        </a>

        <label className="relative flex-1 min-w-0 max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1B4D31] pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="ค้นหาทุเรียน พันธุ์ สวน"
            className="w-full h-9 md:h-10 rounded-full bg-white pl-9 pr-8 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#FFD84D]"
          />
          {query && (
            <button type="button" onClick={() => onQuery("")} aria-label="ล้างคำค้น" className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-stone-400">
              <X className="w-4 h-4" />
            </button>
          )}
        </label>

        <nav className="hidden lg:flex items-center gap-4 text-xs font-semibold text-emerald-50 shrink-0">
          <a href="/tracking" className="hover:text-[#FFD84D]">ออเดอร์ของฉัน</a>
          <a href="/claim" className="hover:text-[#FFD84D]">แจ้งเคลม</a>
          <a href={`tel:${shopInfo.phone.replace(/-/g, "")}`} className="inline-flex items-center gap-1 hover:text-[#FFD84D]">
            <Phone className="w-3.5 h-3.5" /> {shopInfo.phone}
          </a>
          {canManage && (
            <a href="/admin" className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#FFD84D] text-[#11301F]">
              <ShieldAlert className="w-3.5 h-3.5" /> หลังบ้าน
            </a>
          )}
        </nav>

        <div className="flex items-center gap-0.5 shrink-0">
          <LineDirectLink prefillText={LINE_HELLO} ariaLabel="แชท LINE" className="md:hidden p-2 rounded-full text-white hover:bg-white/10">
            <LineIcon className="w-6 h-6" />
          </LineDirectLink>
          <span className="hidden md:inline-flex">
            {loading && !user ? (
              <span className="w-9 h-9 rounded-full bg-white/20 animate-pulse" />
            ) : user ? (
              <button type="button" onClick={onOpenAccount} aria-label="บัญชีของฉัน" className="p-1 rounded-full hover:bg-white/10">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/60 bg-white" />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-[#FFD84D] text-[#11301F] text-xs font-bold flex items-center justify-center">
                    {(displayName(user) || "ส").charAt(0)}
                  </span>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal()}
                className="h-9 px-3.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-bold inline-flex items-center gap-1"
              >
                <UserIcon className="w-4 h-4" /> เข้าสู่ระบบ
              </button>
            )}
          </span>
          <CartButton count={cartCount} onClick={onOpenCart} />
        </div>
      </div>
    </header>
  );
}

/** แผ่นบัญชีของฉัน (แทนเมนูดรอปดาวน์/แฮมเบอร์เกอร์เดิม) */
export function AccountSheet({ onClose }: { onClose: () => void }) {
  const { user, logout, openAuthModal } = useAuth();
  if (!user) return null;
  const canManage = user.role === "superadmin" || user.role === "admin" || user.role === "staff";
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
            <span className="flex-1">{user.role === "staff" ? "งานพนักงาน" : "หลังบ้านร้าน"}</span>
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
/**
 * แถบเมนูล่างจอสำหรับมือถือ (เหมือนแอปช้อปปิ้ง) — ใช้ได้ทุกหน้า
 * หน้าร้านส่ง onOpenCart/onOpenAccount มา, หน้าอื่นกดตะกร้าแล้วกลับไปเปิดตะกร้าที่หน้าร้าน
 */
export function BottomNav({
  cartCount = 0,
  onOpenCart,
  onOpenAccount,
  active = "home",
}: {
  cartCount?: number;
  onOpenCart?: () => void;
  onOpenAccount?: () => void;
  active?: "home" | "orders" | "claim";
}) {
  const item = "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-stone-500 active:text-[#1B4D31]";
  const on = (k: string) => (active === k ? " !text-[#1B4D31] font-bold" : "");
  const cartInner = (
    <>
      <span className="relative">
        <ShoppingBasket className="w-5 h-5" />
        {cartCount > 0 && (
          <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#D9480F] text-white text-[9px] font-bold leading-4 text-center">
            {cartCount > 99 ? "99+" : cartCount}
          </span>
        )}
      </span>
      ตะกร้า
    </>
  );
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-stone-200 pb-[env(safe-area-inset-bottom)]">
      <div className="h-14 flex">
        <a href={active === "home" ? "#top" : "/"} className={item + on("home")}>
          <House className="w-5 h-5" />
          หน้าร้าน
        </a>
        {onOpenCart ? (
          <button type="button" onClick={onOpenCart} className={item}>
            {cartInner}
          </button>
        ) : (
          <a href="/#cart" className={item}>
            {cartInner}
          </a>
        )}
        <LineDirectLink prefillText={LINE_HELLO} className={item} ariaLabel="แชท LINE">
          <LineIcon className="w-5 h-5 text-[#06C755]" />
          แชทร้าน
        </LineDirectLink>
        <a href="/tracking" className={item + on("orders")}>
          <Package className="w-5 h-5" />
          ออเดอร์
        </a>
        {onOpenAccount ? (
          <button type="button" onClick={onOpenAccount} className={item}>
            <UserIcon className="w-5 h-5" />
            ฉัน
          </button>
        ) : (
          <a href="/claim" className={item + on("claim")}>
            <ShieldCheck className="w-5 h-5" />
            เคลม
          </a>
        )}
      </div>
    </nav>
  );
}

/** หัวหน้าย่อย (เช็กออเดอร์ / แจ้งเคลม): ย้อนกลับ + โลโก้ + ชื่อหน้า + ปุ่มด้านขวา */
export function SubPageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 bg-[#FFFBEA]/95 backdrop-blur border-b border-amber-200/70">
      <div className="max-w-3xl mx-auto px-3 h-14 flex items-center gap-2">
        <a href="/" aria-label="กลับหน้าร้าน" className="p-1.5 -ml-1 rounded-full text-[#1B4D31] hover:bg-black/5">
          <ChevronLeft className="w-6 h-6" />
        </a>
        <img src={shopInfo.logo} alt="" className="w-8 h-8 rounded-full border border-amber-200 bg-white object-cover shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-extrabold text-[#1B4D31] leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-[10px] text-stone-500 leading-tight truncate">{subtitle}</p>}
        </div>
        {right && <div className="flex items-center gap-1.5 shrink-0">{right}</div>}
      </div>
    </header>
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

