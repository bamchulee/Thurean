"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  LayoutDashboard,
  Link2,
  Lock,
  LogOut,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  Phone,
  Plug,
  Plus,
  PlusCircle,
  Printer,
  Receipt,
  RefreshCw,
  Scale,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sprout,
  Trash2,
  TrendingUp,
  Truck,
  Unlock,
  UploadCloud,
  User,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { shopInfo } from "../../data/shop";
import { ShippingLabelModal } from "../../components/ShippingLabelModal";
import { LineIcon } from "../../components/Icons";
import { COURIER_OPTIONS, resolveCourierInfo } from "../../lib/courier";
import { formatProductStock, pricePerKgOf } from "../../lib/stock";
import {
  ORDER_STATUSES,
  allowedNextStatuses,
  canWeigh,
  normalizePaymentStatus,
  orderStatusOf,
  type CanonicalOrderStatus,
} from "../../lib/order-status";
import type {
  Claim,
  ClaimStatus,
  LotCost,
  Order,
  OrderStatus,
  Product,
  Round,
  SafeUser,
} from "../../types/durian";

// ============== STATUS HELPERS ==============
const paymentStatusLabel: Record<string, { text: string; color: string }> = {
  pending: {
    text: "ยังไม่ชำระ",
    color: "bg-stone-100 text-stone-700 border border-stone-200",
  },
  slip_submitted: {
    text: "สลิปรอตรวจ",
    color: "bg-amber-50 text-amber-800 border border-amber-300",
  },
  confirmed: {
    text: "ชำระแล้ว",
    color: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  },
  refunded: {
    text: "ต้องคืนเงิน / คืนแล้ว",
    color: "bg-rose-50 text-rose-700 border border-rose-200",
  },
};

// ชุดสถานะเดียวกับ LINE / หน้าเช็กพัสดุ (lib/order-status.ts) — สถานะเก่าแปลงผ่าน orderStatusOf()
const orderStatusLabel: Record<CanonicalOrderStatus, { text: string; color: string }> = {
  สั่งจอง: { text: "⚖️ สั่งจอง (รอชั่ง)", color: "bg-amber-50 text-amber-800 border border-amber-200" },
  รอชำระเงิน: { text: "💳 รอชำระเงิน", color: "bg-orange-50 text-orange-800 border border-orange-200" },
  "ชำระเงินแล้ว/เตรียมจัดส่ง": { text: "📦 ชำระแล้ว/เตรียมส่ง", color: "bg-sky-50 text-sky-800 border border-sky-200" },
  กำลังจัดส่ง: { text: "🚚 กำลังจัดส่ง", color: "bg-indigo-50 text-indigo-800 border border-indigo-200" },
  จัดส่งสำเร็จ: { text: "✅ จัดส่งสำเร็จ", color: "bg-emerald-50 text-emerald-800 border border-emerald-200" },
  ยกเลิก: { text: "❌ ยกเลิก", color: "bg-rose-50 text-rose-700 border border-rose-200" },
};

const claimStatusLabel: Record<string, { text: string; color: string }> = {
  pending: {
    text: "รอตรวจสอบ",
    color: "bg-amber-50 text-amber-800 border border-amber-200",
  },
  approved_replace: {
    text: "ส่งลูกใหม่",
    color: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  },
  approved_refund: {
    text: "โอนคืนแล้ว",
    color: "bg-sky-50 text-sky-800 border border-sky-200",
  },
  rejected: {
    text: "ไม่อนุมัติ",
    color: "bg-stone-100 text-stone-700 border border-stone-200",
  },
};

type TabId =
  | "dashboard"
  | "orders"
  | "products"
  | "lots"
  | "claims"
  | "users"
  | "summary"
  | "settings";

interface ConfigInfo {
  googleSheetsWebAppUrl: string;
  googleSheetViewUrl: string;
  userSheetViewUrl?: string;
  thureanSheetViewUrl?: string;
  lineOaId?: string;
  hasLineToken: boolean;
  lineTokenMasked: string;
  lineAdminUserId: string;
  lineAdminGroupId?: string;
  lineLiffId: string;
  lineLoginChannelId?: string;
  hasLineLoginSecret?: boolean;
  lineLoginSecretMasked?: string;
  publicBaseUrl: string;
  liveStreamPlatform: string;
  liveStreamUrl: string;
  liveStreamNote: string;
  isLiveNow: boolean;
  lastSyncedAt: string | null;
}

// ============== LOGIN SCREEN ==============
function AdminLoginScreen() {
  return (
    <div className="min-h-screen bg-[#11301F] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-stone-200 text-center space-y-6">
        <img
          src={shopInfo.logo}
          alt={shopInfo.name}
          className="w-20 h-20 rounded-full border border-stone-200 mx-auto object-cover shadow-xs"
        />
        <div>
          <h1 className="text-xl font-extrabold text-[#1B4D31]">
            {shopInfo.name}
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            ระบบจัดการหลังบ้าน (Admin Dashboard)
          </p>
        </div>

        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-left space-y-2">
          <div className="flex items-center gap-2 text-emerald-950 font-extrabold text-xs">
            <ShieldCheck className="w-4 h-4 text-[#06C755]" />
            <span>เฉพาะเจ้าของร้านและพนักงาน</span>
          </div>
          <p className="text-[11px] text-emerald-800 leading-relaxed">
            ล็อกอินด้วย LINE ที่เจ้าของร้านตั้งสิทธิ์ไว้แล้ว — ถ้าเข้าแล้วยังไม่เห็นหน้านี้ ให้เจ้าของร้านตั้งสิทธิ์ในแท็บ ผู้ใช้งาน
          </p>
        </div>

        <a
          href="/api/auth/line/login?redirect=/admin"
          className="w-full bg-[#06C755] hover:bg-[#05b34c] text-white py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition shadow-lg shadow-emerald-700/20 active:scale-[0.99]"
        >
          <LineIcon className="w-5 h-5 text-white" />
          <span>เข้าสู่ระบบด้วย LINE</span>
        </a>

        <a
          href="/"
          className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 pt-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>กลับไปหน้าร้านค้า</span>
        </a>
      </div>
    </div>
  );
}

// ============== SIDEBAR ==============
function Sidebar({
  activeTab,
  onTabChange,
  sourceMode,
  pendingClaims,
  pendingPayments,
  onLogout,
  allowedTabs,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  sourceMode: "google-sheets" | "local";
  pendingClaims: number;
  pendingPayments: number;
  onLogout: () => void;
  allowedTabs: TabId[];
}) {
  const allTabs: {
    id: TabId;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    badge?: number;
  }[] = [
    { id: "dashboard", icon: LayoutDashboard, label: "ภาพรวม & ยอดวิ่งรถ" },
    { id: "orders", icon: ClipboardList, label: "คำสั่งซื้อ", badge: pendingPayments },
    { id: "products", icon: Sprout, label: "จัดการสินค้า" },
    { id: "lots", icon: Truck, label: "รอบรถ & ต้นทุนล้ง" },
    { id: "claims", icon: ShieldAlert, label: "ศูนย์เคลม", badge: pendingClaims },
    { id: "users", icon: Users, label: "สมาชิก (Users)" },
    { id: "summary", icon: TrendingUp, label: "กำไร-ขาดทุน" },
    { id: "settings", icon: Link2, label: "เชื่อม Google Sheet" },
  ];
  const tabs = allTabs.filter((t) => allowedTabs.includes(t.id));

  return (
    <>
      <aside className="hidden md:flex flex-col w-64 bg-[#11301F] text-white min-h-screen fixed left-0 top-0 z-40 border-r border-white/10">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img
              src={shopInfo.logo}
              alt={shopInfo.name}
              className="w-11 h-11 rounded-full border border-white/25 bg-white object-cover"
            />
            <div>
              <h1 className="font-extrabold text-sm text-white">
                {shopInfo.name}
              </h1>
              <p className="text-[10px] text-amber-300 font-mono">
                {shopInfo.phone}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
                sourceMode === "google-sheets"
                  ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/40"
                  : "bg-amber-500/15 text-amber-200 border-amber-400/30"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  sourceMode === "google-sheets"
                    ? "bg-emerald-400"
                    : "bg-amber-400 animate-pulse"
                }`}
              />
              {sourceMode === "google-sheets"
                ? "Google Sheets เชื่อมต่อแล้ว"
                : "Local Mode (รอเชื่อมชีต)"}
            </span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === t.id
                    ? "bg-amber-500 text-stone-950 font-bold shadow-sm"
                    : "text-stone-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{t.label}</span>
                </span>
                {t.badge !== undefined && t.badge > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2.5">
          <a
            href="/"
            className="flex items-center justify-between text-emerald-200 text-xs hover:text-white transition font-semibold"
          >
            <span>เปิดดูหน้าร้าน</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-rose-300 text-xs hover:text-rose-200 transition font-medium"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 z-50 flex overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`flex-1 min-w-[58px] flex flex-col items-center py-2 text-[10px] font-semibold transition ${
                activeTab === t.id
                  ? "text-[#1B4D31] bg-emerald-50/70"
                  : "text-stone-400"
              }`}
            >
              <Icon className="w-4 h-4 mb-1" />
              <span className="truncate max-w-[54px]">{t.label.split(" ")[0]}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-xs border border-stone-200 p-4 sm:p-5">
      <div className="flex items-center gap-2.5 mb-2.5">
        <div
          className={`w-9 h-9 ${tone} rounded-xl flex items-center justify-center`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs text-stone-500 font-semibold">{label}</span>
      </div>
      <p className="text-xl sm:text-2xl font-extrabold text-stone-900">{value}</p>
      {sub && <p className="text-[11px] text-stone-400 mt-1">{sub}</p>}
    </div>
  );
}

// ============== TAB 1: DASHBOARD ==============
function DashboardTab({
  orders,
  products,
  lots,
  rounds,
  claims,
  onGoToTab,
}: {
  orders: Order[];
  products: Product[];
  lots: LotCost[];
  rounds: Round[];
  claims: Claim[];
  onGoToTab: (t: TabId) => void;
}) {
  const activeRound = rounds.find((r) => r.status === "open") || rounds[0];
  const totalSales = orders
    .filter((o) => orderStatusOf(o) !== "ยกเลิก")
    .reduce((s, o) => s + o.totalPrice, 0);
  const totalCost = lots.reduce(
    (s, l) => s + l.totalFruitCost + l.packagingCost + l.truckFuelCost,
    0
  );
  const netProfit = totalSales - totalCost;
  const pendingPayments = orders.filter((o) => orderStatusOf(o) === "รอชำระเงิน").length;
  const pendingClaims = claims.filter((c) => c.status === "pending").length;

  const procurement: Record<
    string,
    {
      name: string;
      totalQty: number;
      ripenessMap: Record<string, number>;
      revenue: number;
    }
  > = {};

  orders
    .filter((o) => o.orderStatus !== "claimed")
    .forEach((o) => {
      const rip = o.ripenessPref || "ตามมาตรฐานร้าน";
      o.items.forEach((it) => {
        if (!procurement[it.productId]) {
          procurement[it.productId] = {
            name: it.productName,
            totalQty: 0,
            ripenessMap: {},
            revenue: 0,
          };
        }
        procurement[it.productId].totalQty += it.qty;
        procurement[it.productId].revenue += it.price * it.qty;
        procurement[it.productId].ripenessMap[rip] =
          (procurement[it.productId].ripenessMap[rip] || 0) + it.qty;
      });
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold text-stone-900">
            ภาพรวมร้านทุเรียนวินคิน
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {activeRound
              ? `${activeRound.name} (เหลือโควตา ${activeRound.quotaRemaining}/${activeRound.totalQuota} ลูก)`
              : "ยังไม่มีรอบที่เปิดอยู่"}
          </p>
        </div>
        <button
          onClick={() => onGoToTab("settings")}
          className="text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-[#1B4D31] border border-emerald-200 px-4 py-2 rounded-xl transition self-start inline-flex items-center gap-1.5"
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>ตั้งค่าเชื่อม Google Sheet</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Package}
          label="ออเดอร์ทั้งหมด"
          value={`${orders.length}`}
          sub={`รอตรวจสลิป ${pendingPayments} รายการ`}
          tone="bg-sky-50 text-sky-700 border border-sky-200"
        />
        <StatCard
          icon={Banknote}
          label="ยอดขายค่าทุเรียน"
          value={`฿${totalSales.toLocaleString()}`}
          sub="ยังไม่รวมค่าส่ง"
          tone="bg-emerald-50 text-[#1B4D31] border border-emerald-200"
        />
        <StatCard
          icon={Truck}
          label="ต้นทุนรับจากล้ง+รถ"
          value={`฿${totalCost.toLocaleString()}`}
          sub={`บันทึกแล้ว ${lots.length} บิล`}
          tone="bg-amber-50 text-amber-700 border border-amber-200"
        />
        <StatCard
          icon={TrendingUp}
          label="กำไรสุทธิเบื้องต้น"
          value={`฿${netProfit.toLocaleString()}`}
          sub={`เปิดขาย ${products.filter((p) => p.isAvailable).length}/${products.length} รายการ`}
          tone={
            netProfit >= 0
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-rose-50 text-rose-700 border border-rose-200"
          }
        />
      </div>

      {(pendingPayments > 0 || pendingClaims > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {pendingPayments > 0 && (
            <button
              onClick={() => onGoToTab("orders")}
              className="text-left bg-amber-50 border border-amber-200 p-4 rounded-2xl hover:bg-amber-100/70 transition flex items-center justify-between"
            >
              <div>
                <p className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>มี {pendingPayments} ออเดอร์ รอตรวจสลิปโอนเงิน</span>
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  คลิกเพื่อไปตรวจยอดและยืนยันออเดอร์
                </p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-amber-700" />
            </button>
          )}
          {pendingClaims > 0 && (
            <button
              onClick={() => onGoToTab("claims")}
              className="text-left bg-rose-50 border border-rose-200 p-4 rounded-2xl hover:bg-rose-100/70 transition flex items-center justify-between"
            >
              <div>
                <p className="font-bold text-rose-800 text-sm flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>มี {pendingClaims} คำร้องเคลมทุเรียน รอดำเนินการ</span>
                </p>
                <p className="text-xs text-rose-600 mt-0.5">
                  คลิกเพื่อตรวจสอบล็อตสินค้าและอนุมัติเคลม
                </p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-rose-700" />
            </button>
          )}
        </div>
      )}

      {/* Truck Procurement List */}
      <div className="bg-white rounded-2xl shadow-xs border border-stone-200 p-5">
        <div className="mb-4">
          <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#1B4D31]" />
            <span>ใบสรุปยอดวิ่งรถกระบะไปรับทุเรียนที่สวน</span>
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            รวมยอดสั่งซื้อทั้งหมด แยกตามสายพันธุ์และระดับความสุกที่ลูกค้าเลือก
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="bg-stone-50 text-stone-600 text-xs border-y border-stone-200">
                <th className="text-left px-3 py-2.5">รายการทุเรียน</th>
                <th className="text-left px-3 py-2.5">สเปกความสุกที่ลูกค้าสั่ง</th>
                <th className="text-center px-3 py-2.5">จำนวนรวม</th>
                <th className="text-right px-3 py-2.5">มูลค่าขาย</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {Object.entries(procurement).map(([pid, d]) => (
                <tr key={pid} className="hover:bg-stone-50/70">
                  <td className="px-3 py-3 font-bold text-stone-800">{d.name}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(d.ripenessMap).map(([r, q]) => (
                        <span
                          key={r}
                          className="bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        >
                          {r}: {q}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center font-extrabold text-[#1B4D31] text-base">
                    {d.totalQty}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-stone-800">
                    ฿{d.revenue.toLocaleString()}
                  </td>
                </tr>
              ))}
              {Object.keys(procurement).length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-stone-400 text-xs">
                    ยังไม่มีรายการสั่งซื้อในรอบนี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============== MODAL: NOTIFY CUSTOMER VIA LINE ==============
function NotifyCustomerModal({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const [message, setMessage] = useState(
    `สวัสดีครับคุณ ${order.customerName} ทางร้านทุเรียนวิ่นขิ่นขอแจ้งอัปเดตออเดอร์ ${order.id} ครับ 🍈`
  );
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState("");

  const presets = [
    `สวัสดีครับคุณ ${order.customerName} ทางร้านได้รับออเดอร์ ${order.id} เรียบร้อยแล้ว กำลังจัดเตรียมคัดทุเรียนเกรดพรีเมียมให้ครับ 🍈`,
    `แจ้งอัปเดตออเดอร์ ${order.id}: ทุเรียนของคุณลูกค้าแพ็กเสร็จสมบูรณ์แล้ว เตรียมส่งรอบวันนี้ครับ 📦`,
    `แจ้งเลขพัสดุออเดอร์ ${order.id}: ขนส่ง ${order.courier || "ควบคุมอุณหภูมิ"} เลขพัสดุ ${order.trackingNo || "-"} ครับ 🚚`,
    `ขออนุญาตสอบถามเรื่องสเปกความสุกเพิ่มเติมสำหรับออเดอร์ ${order.id} ครับ ลูกค้าต้องการรับเนื้อกรอบนอกนุ่มใน หรือสุกพร้อมทานดีครับ? 💬`,
    `ขอบพระคุณที่อุดหนุนสวนทุเรียนวิ่นขิ่นครับ หากได้รับสินค้าแล้วอย่าลืมถ่ายคลิปตอนเปิดกล่องไว้ด้วยนะครับ 🙏`,
  ];

  const handleSend = async () => {
    if (!message.trim() || !order.lineUserId) return;
    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/admin/notify-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: order.lineUserId,
          orderId: order.id,
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSendSuccess(true);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setSendError(data.error || "ไม่สามารถส่งข้อความได้ กรุณาลองใหม่");
      }
    } catch (err: any) {
      setSendError(err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl border border-stone-200"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#06C755]/10 text-[#06C755] flex items-center justify-center font-bold">
              <LineIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-stone-900">
                แชท LINE หาคุณ {order.customerName}
              </h3>
              <p className="text-xs text-stone-500 font-mono">
                ออเดอร์ {order.id} {order.lineUserId ? `• ${order.lineUserId}` : "• ไม่พบ LINE ID"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-sm p-1"
          >
            ✕
          </button>
        </div>

        {order.lineUserId ? (
          <>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                เลือกข้อความด่วน (Quick Presets)
              </label>
              <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                {presets.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setMessage(p)}
                    className="text-left text-xs bg-stone-50 hover:bg-[#1B4D31]/5 hover:border-[#1B4D31]/30 border border-stone-200 p-2 rounded-xl transition text-stone-700"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                ข้อความที่จะส่งตรงเข้า LINE ลูกค้า (Push Notification)
              </label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="พิมพ์ข้อความที่ต้องการส่งหาลูกค้า..."
                className="w-full border border-stone-300 rounded-2xl p-3 text-xs leading-relaxed focus:outline-none focus:border-[#1B4D31]"
              />
            </div>

            {sendSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>ส่งข้อความเข้าห้องแชท LINE ลูกค้าเรียบร้อยแล้ว!</span>
              </div>
            )}

            {sendError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold p-3 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{sendError}</span>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                disabled={sending || sendSuccess || !message.trim()}
                onClick={handleSend}
                className="w-full sm:flex-1 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition disabled:opacity-60 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sending ? "กำลังส่งเข้า LINE..." : "ส่งข้อความทันที"}</span>
              </button>
              <a
                href="https://chat.line.biz/"
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition text-center"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>เปิด LINE OA Chat</span>
              </a>
            </div>
          </>
        ) : (
          <div className="space-y-4 py-2">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 leading-relaxed">
              <p className="font-bold mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>ออเดอร์นี้ไม่มี LINE User ID</span>
              </p>
              <p>
                ลูกค้าสั่งซื้อผ่านเว็บไซต์โดยไม่ได้ล็อกอินผ่าน LINE
                คุณสามารถติดต่อลูกค้าผ่านเบอร์โทรศัพท์{" "}
                <a href={`tel:${order.phone}`} className="font-bold underline text-[#1B4D31]">
                  {order.phone}
                </a>{" "}
                หรือเปิดดูประวัติแชทใน LINE Official Account Manager
              </p>
            </div>

            <div className="flex gap-2">
              <a
                href={`tel:${order.phone}`}
                className="flex-1 bg-[#1B4D31] text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>โทรหาลูกค้า ({order.phone})</span>
              </a>
              <a
                href="https://chat.line.biz/"
                target="_blank"
                rel="noreferrer"
                className="flex-1 bg-[#06C755] text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>เปิด LINE OA Chat</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============== MODAL: MANUAL ORDER (POS / OFF-MENU) ==============
function ManualOrderModal({
  products,
  rounds,
  users,
  onClose,
  onOrderCreated,
}: {
  products: Product[];
  rounds: Round[];
  users: SafeUser[];
  onClose: () => void;
  onOrderCreated: (order: Order) => void;
}) {
  const [selectedUserMode, setSelectedUserMode] = useState<"new" | "existing">("new");
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [lineUserId, setLineUserId] = useState("");

  const [productId, setProductId] = useState(products[0]?.id || "");
  const [qty, setQty] = useState(1);
  const [customPrice, setCustomPrice] = useState(products[0] ? pricePerKgOf(products[0]) : 220);
  const [ripenessPref, setRipenessPref] = useState("กรอบนอกนุ่มใน");
  const [roundId, setRoundId] = useState(rounds[0]?.id || "");
  const [shippingMethod, setShippingMethod] = useState("ควบคุมอุณหภูมิ (เย็น)");
  const [shippingCost, setShippingCost] = useState(120);
  const [notifyLine, setNotifyLine] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleProductChange = (id: string) => {
    setProductId(id);
    const prod = products.find((p) => p.id === id);
    if (prod) {
      setCustomPrice(pricePerKgOf(prod));
    }
  };

  const handleSelectUser = (u: SafeUser) => {
    setSelectedUserId(u.userId || "");
    setCustomerName(u.displayName || u.username);
    setPhone(u.phone || "");
    setAddress(u.address || "");
    setMapsUrl(u.mapsUrl || "");
    setLineUserId(u.lineUserId || "");
  };

  const selectedProd = products.find((p) => p.id === productId) || products[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !phone.trim() || !address.trim()) {
      setError("กรุณากรอกชื่อลูกค้า เบอร์โทรศัพท์ และที่อยู่จัดส่งให้ครบถ้วน");
      return;
    }
    if (qty <= 0) {
      setError("จำนวนต้องมากกว่า 0");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        customerName: customerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        mapsUrl: mapsUrl.trim() || undefined,
        items: [
          {
            productId: selectedProd ? selectedProd.id : "manual",
            productName: selectedProd ? selectedProd.name : "ทุเรียนสั่งพิเศษ",
            qty: Number(qty),
            variety: selectedProd ? selectedProd.variety : "หมอนทอง",
          },
        ],
        shippingMethod,
        shippingCost: Number(shippingCost || 0),
        ripenessPref: ripenessPref || "กรอบนอกนุ่มใน",
        roundId: roundId || undefined,
        userId: selectedUserId || undefined,
        lineUserId: lineUserId.trim() || undefined,
        isAdminRequest: true,
        notifyLine: Boolean(notifyLine && lineUserId),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.ok && json.order) {
        onOrderCreated(json.order);
        onClose();
      } else {
        setError(json.error || "ไม่สามารถสร้างออเดอร์ได้");
      }
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.phone?.includes(userSearch) ||
      u.userId?.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-2xl rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl border border-stone-200 my-8 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div>
            <h3 className="font-extrabold text-lg text-stone-900 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-[#1B4D31]" />
              <span>ออกออเดอร์ใหม่ (Manual Order / POS หน้าร้าน)</span>
            </h3>
            <p className="text-xs text-stone-500">
              สร้างคำสั่งซื้อโดยตรงโดยแอดมิน ระบบจะตัดสต็อกและจัดสรรโควตารอบรถให้อัตโนมัติ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-sm p-1"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold p-3 rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* User Selection */}
        <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-stone-800">
              👤 ข้อมูลลูกค้า (Customer Info)
            </span>
            <div className="flex gap-1 bg-white p-1 rounded-xl border border-stone-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setSelectedUserMode("new")}
                className={`px-2.5 py-1 rounded-lg transition ${
                  selectedUserMode === "new"
                    ? "bg-[#1B4D31] text-white"
                    : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                กรอกข้อมูลใหม่
              </button>
              <button
                type="button"
                onClick={() => setSelectedUserMode("existing")}
                className={`px-2.5 py-1 rounded-lg transition ${
                  selectedUserMode === "existing"
                    ? "bg-[#1B4D31] text-white"
                    : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                เลือกจากสมาชิก ({users.length})
              </button>
            </div>
          </div>

          {selectedUserMode === "existing" && (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="ค้นหาชื่อ, เบอร์โทร หรือ User ID..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
              />
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                {filteredUsers.slice(0, 10).map((u) => (
                  <div
                    key={u.userId}
                    onClick={() => handleSelectUser(u)}
                    className={`cursor-pointer p-2 rounded-xl text-xs border flex items-center justify-between transition ${
                      selectedUserId === u.userId
                        ? "bg-[#1B4D31]/10 border-[#1B4D31] font-bold text-[#1B4D31]"
                        : "bg-white border-stone-200 hover:bg-stone-100 text-stone-700"
                    }`}
                  >
                    <span>{u.displayName || u.username} ({u.phone || "ไม่มีเบอร์"})</span>
                    <span className="text-[10px] text-stone-400 font-mono">{u.userId}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                ชื่อผู้รับ *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="เช่น สมชาย ใจดี"
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                เบอร์โทรศัพท์ *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="เช่น 0812345678"
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">
              ที่อยู่จัดส่ง *
            </label>
            <textarea
              rows={2}
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="บ้านเลขที่ ซอย ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                Google Maps URL (ลิงก์หมุดนำทาง)
              </label>
              <input
                type="url"
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder="https://maps.google.com/..."
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-mono text-[11px]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                LINE User ID (ถ้าทราบ เช่น U062...)
              </label>
              <input
                type="text"
                value={lineUserId}
                onChange={(e) => setLineUserId(e.target.value)}
                placeholder="U..."
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-mono text-[11px]"
              />
            </div>
          </div>
        </div>

        {/* Product & Ripeness */}
        <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/60 space-y-3">
          <span className="text-xs font-extrabold text-stone-800">
            🍈 รายการสินค้าและสเปกทุเรียน
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                เลือกสินค้า
              </label>
              <select
                value={productId}
                onChange={(e) => handleProductChange(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-bold"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.variety}) - ฿{pricePerKgOf(p)}/กก. [คงเหลือ: {formatProductStock(p).summary}]
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                จำนวน (กก./ลูก/กล่อง)
              </label>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-bold text-center font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                ราคาต่อกิโล (แก้ได้ตอนชั่ง)
              </label>
              <div className="w-full border border-stone-200 rounded-xl px-3 py-2 text-xs bg-stone-50 font-bold font-mono">
                ฿{customPrice.toLocaleString()}/กก.
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                ระดับความสุก (Ripeness)
              </label>
              <select
                value={ripenessPref}
                onChange={(e) => setRipenessPref(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-bold"
              >
                <option value="กรอบนอกนุ่มใน">กรอบนอกนุ่มใน (ยอดฮิต)</option>
                <option value="พอดีกิน">พอดีกิน (นุ่มละมุน)</option>
                <option value="สุกนิ่ม">สุกนิ่ม (หวานจัด)</option>
                <option value="ไก่ฉีก">ไก่ฉีก (กรอบมาก)</option>
                <option value="นำไปบ่มเอง">นำไปบ่มเอง (ตัดสด)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                รอบตัดส่ง (Round)
              </label>
              <select
                value={roundId}
                onChange={(e) => setRoundId(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-bold"
              >
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.deliveryDate || r.harvestDate || "รอบปัจจุบัน"})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Shipping & Payment */}
        <div className="bg-sky-50/50 p-4 rounded-2xl border border-sky-200/60 space-y-3">
          <span className="text-xs font-extrabold text-stone-800">
            🚚 การจัดส่งและการชำระเงิน
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                วิธีจัดส่ง
              </label>
              <select
                value={shippingMethod}
                onChange={(e) => setShippingMethod(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-bold"
              >
                <option value="ควบคุมอุณหภูมิ (เย็น)">รถห้องเย็นควบคุมอุณหภูมิ (Cold Chain)</option>
                <option value="ด่วนมอเตอร์ไซค์">ส่งด่วน Grab / Lalamove</option>
                <option value="นัดรับที่สวน">นัดรับที่สวน / หน้าร้าน</option>
                <option value="ขนส่งเอกชนทั่วไป">ขนส่งพัสดุด่วนเอกชน (Kerry / Flash)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                ค่าจัดส่ง (฿)
              </label>
              <input
                type="number"
                value={shippingCost}
                onChange={(e) => setShippingCost(Number(e.target.value))}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-bold font-mono"
              />
            </div>
          </div>

          <p className="text-[11px] text-stone-500 bg-stone-50 border border-stone-200 rounded-xl p-2.5">
            ออเดอร์จะเป็น &quot;สั่งจอง&quot; — เปิดหน้าออเดอร์เพื่อชั่งน้ำหนัก (ระบบคิดยอดจากราคาต่อกิโล) แล้วค่อยยืนยันรับเงิน
          </p>

          {lineUserId && (
            <label className="flex items-center gap-2 text-xs text-stone-700 pt-1">
              <input
                type="checkbox"
                checked={notifyLine}
                onChange={(e) => setNotifyLine(e.target.checked)}
                className="accent-[#1B4D31]"
              />
              <span>ส่ง Flex Message สรุปคำสั่งซื้อเข้า LINE ลูกค้าทันที</span>
            </label>
          )}
        </div>

        {/* Total Summary */}
        <div className="bg-[#1B4D31]/5 border border-[#1B4D31]/20 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-stone-500 font-bold">ยอดเงิน = น้ำหนักที่ชั่ง × ฿{customPrice.toLocaleString()}/กก.</p>
            <p className="text-xs text-stone-400">+ ค่าส่ง ฿{shippingCost.toLocaleString()} — คิดยอดตอนชั่งในหน้าออเดอร์</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-[#1B4D31] hover:bg-[#143B25] text-white font-extrabold py-3 rounded-2xl text-xs transition shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <CheckCircle2 className="w-4 h-4 text-amber-300" />
            <span>{submitting ? "กำลังบันทึกออเดอร์..." : "บันทึกและสร้างออเดอร์ (Confirm Order)"}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-2xl text-xs transition"
          >
            ยกเลิก
          </button>
        </div>
      </form>
    </div>
  );
}

// ============== TAB 2: ORDERS ==============
function OrdersTab({
  orders,
  lots,
  products = [],
  rounds = [],
  users = [],
  claims = [],
  onOrderUpdated,
  onOrderCreated,
  onGoToTab,
}: {
  orders: Order[];
  lots: LotCost[];
  products?: Product[];
  rounds?: Round[];
  users?: SafeUser[];
  claims?: Claim[];
  onOrderUpdated: (updated: Order) => void;
  onOrderCreated?: (created: Order) => void;
  onGoToTab?: (tab: TabId) => void;
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [labelOrder, setLabelOrder] = useState<Order | null>(null);
  const [chatModalOrder, setChatModalOrder] = useState<Order | null>(null);
  const [showManualOrder, setShowManualOrder] = useState(false);
  const [trackInput, setTrackInput] = useState("");
  const [courierInput, setCourierInput] = useState("");
  const [lotInput, setLotInput] = useState("");
  const [nextStatus, setNextStatus] = useState<CanonicalOrderStatus>("กำลังจัดส่ง");
  const [cancelReason, setCancelReason] = useState("");
  const [notifyLine, setNotifyLine] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Top alert metrics:
  const toWeighOrders = orders.filter((o) => orderStatusOf(o) === "สั่งจอง");
  const pendingSlipOrders = orders.filter(
    (o) => orderStatusOf(o) === "รอชำระเงิน" && normalizePaymentStatus(o.paymentStatus) === "slip_submitted"
  );
  const readyToShipOrders = orders.filter((o) => orderStatusOf(o) === "ชำระเงินแล้ว/เตรียมจัดส่ง");
  const shippedOrders = orders.filter((o) => orderStatusOf(o) === "กำลังจัดส่ง");
  const claimedOrders = orders.filter((o) => o.orderStatus === "claimed");
  const pendingClaimsCount = claims.filter((c) => c.status === "pending").length;

  const filtered = orders.filter((o) => {
    // Status filter
    if (statusFilter === "pending_slip") {
      if (!pendingSlipOrders.includes(o)) return false;
    } else if (statusFilter === "line_only") {
      if (!o.lineUserId) return false;
    } else if (statusFilter !== "all") {
      if (orderStatusOf(o) !== statusFilter) return false;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = o.id.toLowerCase().includes(q);
      const matchName = o.customerName.toLowerCase().includes(q);
      const matchPhone = o.phone.includes(q);
      const matchAddress = o.address?.toLowerCase().includes(q);
      const matchTrack = o.trackingNo?.toLowerCase().includes(q);
      const matchUser = o.userId?.toLowerCase().includes(q);
      if (!matchId && !matchName && !matchPhone && !matchAddress && !matchTrack && !matchUser) {
        return false;
      }
    }

    return true;
  });

  const patchOrder = async (
    orderId: string,
    payload: Record<string, unknown>
  ) => {
    setSavingId(orderId);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { ok: boolean; order?: Order; error?: string };
      if (res.ok && json.ok && json.order) {
        onOrderUpdated(json.order);
        return true;
      }
      alert(json.error || "บันทึกไม่สำเร็จ");
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const openTrackingModal = (order: Order) => {
    setEditingOrder(order);
    setTrackInput(order.trackingNo || "");
    setCourierInput(order.courier || "");
    setLotInput(order.lotId || lots[0]?.lotId || "");
    const current = orderStatusOf(order);
    setNextStatus(allowedNextStatuses(current).find((s) => s !== "ยกเลิก") || current);
    setCancelReason("");
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    const ok = await patchOrder(editingOrder.id, {
      orderStatus: nextStatus,
      trackingNo: trackInput,
      courier: courierInput || undefined,
      lotId: lotInput,
      cancelReason: cancelReason || undefined,
      notifyLine,
    });
    if (ok) setEditingOrder(null);
  };

  return (
    <div className="space-y-5">
      {/* 1. TOP ALERT SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <button
          type="button"
          onClick={() => setStatusFilter("pending_slip")}
          className={`text-left p-3.5 rounded-2xl border transition ${
            statusFilter === "pending_slip"
              ? "bg-amber-500 text-white border-amber-600 shadow-sm"
              : pendingSlipOrders.length > 0
              ? "bg-amber-50 border-amber-300 text-amber-950 hover:bg-amber-100"
              : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold">⚡ สลิปรอตรวจ</span>
            <span
              className={`w-2 h-2 rounded-full ${
                pendingSlipOrders.length > 0 ? "bg-amber-500 animate-pulse" : "bg-stone-300"
              }`}
            />
          </div>
          <div className="text-xl font-black font-mono">{pendingSlipOrders.length}</div>
          <p className="text-[10px] opacity-80 mt-0.5">ต้องกดเช็คยอด</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("ชำระเงินแล้ว/เตรียมจัดส่ง")}
          className={`text-left p-3.5 rounded-2xl border transition ${
            statusFilter === "ชำระเงินแล้ว/เตรียมจัดส่ง"
              ? "bg-sky-600 text-white border-sky-700 shadow-sm"
              : readyToShipOrders.length > 0
              ? "bg-sky-50 border-sky-200 text-sky-950 hover:bg-sky-100"
              : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold">📦 ต้องจัดส่ง</span>
            <span
              className={`w-2 h-2 rounded-full ${
                readyToShipOrders.length > 0 ? "bg-sky-500 animate-pulse" : "bg-stone-300"
              }`}
            />
          </div>
          <div className="text-xl font-black font-mono">{readyToShipOrders.length}</div>
          <p className="text-[10px] opacity-80 mt-0.5">คัดของ / แพ็กกล่อง</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("กำลังจัดส่ง")}
          className={`text-left p-3.5 rounded-2xl border transition ${
            statusFilter === "กำลังจัดส่ง"
              ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
              : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold">🚚 อยู่ระหว่างส่ง</span>
          </div>
          <div className="text-xl font-black font-mono">{shippedOrders.length}</div>
          <p className="text-[10px] opacity-80 mt-0.5">มี Tracking แล้ว</p>
        </button>

        <button
          type="button"
          onClick={() => (onGoToTab ? onGoToTab("claims") : setStatusFilter("claimed"))}
          className={`text-left p-3.5 rounded-2xl border transition ${
            pendingClaimsCount > 0
              ? "bg-rose-50 border-rose-300 text-rose-950 hover:bg-rose-100"
              : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold">🚨 รายการเคลม</span>
            <span
              className={`w-2 h-2 rounded-full ${
                pendingClaimsCount > 0 ? "bg-rose-500 animate-pulse" : "bg-stone-300"
              }`}
            />
          </div>
          <div className="text-xl font-black font-mono text-rose-600">
            {pendingClaimsCount > 0 ? pendingClaimsCount : claimedOrders.length}
          </div>
          <p className="text-[10px] opacity-80 mt-0.5">กดดูศูนย์เคลม ↗</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("สั่งจอง")}
          className={`text-left p-3.5 rounded-2xl border transition ${
            statusFilter === "สั่งจอง"
              ? "bg-emerald-700 text-white border-emerald-800 shadow-sm"
              : toWeighOrders.length > 0
              ? "bg-emerald-50 border-emerald-300 text-emerald-950 hover:bg-emerald-100"
              : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold">⚖️ รอชั่งน้ำหนัก</span>
            <Scale className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-black font-mono">{toWeighOrders.length}</div>
          <p className="text-[10px] opacity-80 mt-0.5">ลูกค้าจองไว้ ยังไม่ส่งยอด</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`text-left p-3.5 rounded-2xl border transition ${
            statusFilter === "all"
              ? "bg-[#1B4D31] text-white border-[#143B25] shadow-sm"
              : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold">📋 คำสั่งซื้อทั้งหมด</span>
          </div>
          <div className="text-xl font-black font-mono">{orders.length}</div>
          <p className="text-[10px] opacity-80 mt-0.5">รวมทุกสถานะ</p>
        </button>
      </div>

      {/* 2. CONTROLS BAR: SEARCH, STATUS PILLS, NEW ORDER BUTTON */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
            <input
              type="text"
              placeholder="ค้นหา Order ID, ชื่อลูกค้า, เบอร์โทร, ที่อยู่, เลขพัสดุ หรือ User ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-stone-200 rounded-xl text-xs bg-stone-50 focus:bg-white focus:outline-none focus:border-[#1B4D31]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-xs text-stone-400 hover:text-stone-600"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowManualOrder(true)}
              className="w-full sm:w-auto bg-[#1B4D31] hover:bg-[#143B25] text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs inline-flex items-center justify-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4 text-amber-300" />
              <span>ออกออเดอร์ใหม่ (POS / สั่งนอกเมนู)</span>
            </button>
            <a
              href="https://chat.line.biz/"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 bg-[#06C755] hover:bg-[#05b34c] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs"
              title="เปิด LINE Official Account Manager"
            >
              <LineIcon className="w-3.5 h-3.5" />
              <span>LINE Chat</span>
            </a>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-stone-100">
          {[
            { id: "all", label: "ทั้งหมด" },
            { id: "pending_slip", label: "⚡ สลิปรอตรวจ" },
            ...ORDER_STATUSES.map((s) => ({ id: s, label: orderStatusLabel[s].text })),
            { id: "line_only", label: "💬 สั่งผ่าน LINE" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setStatusFilter(item.id)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                statusFilter === item.id
                  ? "bg-[#1B4D31] text-white shadow-xs"
                  : "bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. ORDER CARDS LIST */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-stone-400">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-bold text-stone-600">ไม่พบคำสั่งซื้อที่ตรงกับเงื่อนไข</p>
            <p className="text-xs mt-1">ลองเปลี่ยนตัวกรองสถานะ หรือคำค้นหา</p>
          </div>
        ) : (
          filtered.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-2xl shadow-xs border border-stone-200 p-5 hover:border-stone-300 transition"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-extrabold text-stone-900 font-mono text-base">
                      {order.id}
                    </span>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                        paymentStatusLabel[normalizePaymentStatus(order.paymentStatus)].color
                      }`}
                    >
                      {paymentStatusLabel[normalizePaymentStatus(order.paymentStatus)].text}
                    </span>
                    {order.lotId && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 font-mono font-bold">
                        ล็อต: {order.lotId}
                      </span>
                    )}
                    <button
                      onClick={() => {
                        const currentActive =
                          order.isActive === 0 ||
                          (order.isActive as any) === "0" ||
                          order.isActive === false
                            ? 0
                            : 1;
                        const nextVal = currentActive === 1 ? 0 : 1;
                        patchOrder(order.id, { isActive: nextVal });
                      }}
                      title="สลับสถานะ Is Active (1 = ใช้งาน, 0 = ปิดใช้งาน/ยกเลิก)"
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border transition inline-flex items-center gap-1 ${
                        order.isActive === 0 ||
                        (order.isActive as any) === "0" ||
                        order.isActive === false
                          ? "bg-stone-100 text-stone-500 border-stone-300 hover:bg-stone-200"
                          : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          order.isActive === 0 ||
                          (order.isActive as any) === "0" ||
                          order.isActive === false
                            ? "bg-stone-400"
                            : "bg-emerald-500"
                        }`}
                      />
                      <span>
                        {order.isActive === 0 ||
                        (order.isActive as any) === "0" ||
                        order.isActive === false
                          ? "IsActive: 0"
                          : "IsActive: 1"}
                      </span>
                    </button>
                  </div>
                  <p className="text-[11px] text-stone-400 font-mono">
                    {new Date(order.createDate || order.createdAt).toLocaleString("th-TH")} • โดย:{" "}
                    {order.createdBy || order.userId || "customer"}
                  </p>
                </div>
                <span
                  className={`text-xs px-3 py-1 rounded-full font-bold ${
                    orderStatusLabel[orderStatusOf(order)].color
                  }`}
                >
                  {orderStatusLabel[orderStatusOf(order)].text}
                </span>
              </div>

              {/* Customer Box */}
              <div className="bg-stone-50 rounded-xl p-3.5 mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-stone-100">
                <div>
                  <p className="font-bold text-sm text-stone-900 flex items-center gap-1.5 flex-wrap">
                    <User className="w-3.5 h-3.5 text-stone-400" />
                    <span>{order.customerName}</span>
                    <a
                      href={`tel:${order.phone}`}
                      className="text-xs font-mono text-[#1B4D31] hover:underline font-bold inline-flex items-center gap-1 bg-stone-200/60 px-2 py-0.5 rounded-md"
                      title="กดเพื่อโทรออก"
                    >
                      <Phone className="w-3 h-3 text-stone-500" />
                      <span>{order.phone}</span>
                    </a>
                    {order.userId && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 font-mono font-bold"
                        title="User ID เชื่อมโยงกับแท็บ User Sheet"
                      >
                        User ID: {order.userId}
                      </span>
                    )}
                    {order.lineUserId && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[#06C755]/10 text-[#06C755] border border-[#06C755]/30 font-bold inline-flex items-center gap-1"
                        title={`LINE User ID: ${order.lineUserId}`}
                      >
                        <LineIcon className="w-3 h-3" />
                        <span>LINE</span>
                      </span>
                    )}
                  </p>
                  {order.address && (
                    <div className="text-xs text-stone-600 mt-1 flex items-start gap-1.5 flex-wrap">
                      <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                      <span>{order.address}</span>
                      {order.mapsUrl && (
                        <a
                          href={order.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-100/70 hover:bg-emerald-200 px-2 py-0.5 rounded-md transition"
                        >
                          <Navigation className="w-3 h-3 text-emerald-700" />
                          <span>เปิดหมุด Google Maps ↗</span>
                        </a>
                      )}
                    </div>
                  )}
                  {order.ripenessPref && (
                    <p className="text-xs text-amber-800 font-semibold mt-1 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>สเปกความสุก: {order.ripenessPref}</span>
                    </p>
                  )}
                </div>
                <p className="text-xl font-extrabold text-[#1B4D31] shrink-0">
                  {orderStatusOf(order) === "สั่งจอง" ? "รอชั่ง" : `฿${(order.totalPrice + order.shippingCost).toLocaleString()}`}
                </p>
              </div>

              {/* Items List */}
              <div className="space-y-1 mb-3 text-xs">
                {order.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-stone-700 font-medium">
                    <span>
                      {it.productName} <strong>x{it.qty}</strong>
                    </span>
                    <span className="font-mono">
                      {it.actualWeightKg && it.pricePerKg
                        ? `${it.actualWeightKg} กก. × ฿${it.pricePerKg} = ฿${Math.round(it.actualWeightKg * it.pricePerKg).toLocaleString()}`
                        : `฿${(it.pricePerKg || it.price).toLocaleString()}/กก. (รอชั่ง)`}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-stone-400 pt-1.5 border-t border-stone-100">
                  <span className="flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" />
                    <span>{order.shippingMethod}</span>
                  </span>
                  <span className="font-mono">฿{order.shippingCost}</span>
                </div>
              </div>

              {/* Tracking / Slip alert */}
              {(order.trackingNo || order.courier) && (
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-2.5 text-xs text-sky-900 mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />
                    <span>
                      ขนส่ง:{" "}
                      <strong>
                        {resolveCourierInfo(order.trackingNo, order.courier, order.shippingMethod).name}
                      </strong>
                      {order.trackingNo && (
                        <>
                          {" "}
                          • เลขพัสดุ: <strong className="font-mono">{order.trackingNo}</strong>
                        </>
                      )}
                    </span>
                  </span>
                  {order.slipUrl && (
                    <a
                      href={order.slipUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-white border border-sky-300 text-sky-800 px-2.5 py-0.5 rounded-lg font-bold hover:bg-sky-100 inline-flex items-center gap-1"
                    >
                      <Receipt className="w-3 h-3" />
                      <span>ดูสลิป</span>
                    </a>
                  )}
                </div>
              )}
              {!order.trackingNo && !order.courier && order.slipUrl && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-900 mb-3 flex items-center justify-between">
                  <span>ลูกค้าแนบสลิปทาง LINE แล้ว</span>
                  <a
                    href={order.slipUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-white border border-emerald-300 text-emerald-800 px-2.5 py-0.5 rounded-lg font-bold hover:bg-emerald-100 inline-flex items-center gap-1"
                  >
                    <Receipt className="w-3 h-3" />
                    <span>ดูสลิป</span>
                  </a>
                </div>
              )}

              {/* Product Weighed Details Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-amber-50/70 p-3 rounded-xl border border-amber-200/70 mb-3">
                <div>
                  <span className="text-stone-500 block text-[10px]">ประเภท / สินค้า:</span>
                  <span className="font-bold text-amber-950">
                    {order.productType || "รับคัดลูก"} ({order.productName || order.items[0]?.productName || "-"})
                  </span>
                  <span className="text-[10px] text-stone-400 block font-mono">
                    รหัส: {order.productId || order.items[0]?.productId || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px]">น้ำหนักต่อลูก (ชั่งจริง):</span>
                  <span className="font-black text-emerald-800 text-sm font-mono">
                    {order.weightPerItem || "⏳ ยังไม่ชั่งน้ำหนัก"}
                  </span>
                  <span className="text-[10px] text-stone-500 block">
                    ราคา: ฿{(order.pricePerItem || order.items[0]?.price || 0).toLocaleString()} /ลูก
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px]">จำนวนที่สั่ง:</span>
                  <span className="font-extrabold text-stone-900 font-mono text-sm">
                    {order.quantity || order.items.reduce((s, it) => s + it.qty, 0)} ลูก
                  </span>
                  <span className="text-[10px] text-stone-500 block">
                    ช่องทาง: <strong className="text-emerald-700">{order.channel || "LINE Official"}</strong>
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px]">ขนส่ง / รถจัดส่ง:</span>
                  <span className="font-bold text-stone-800">
                    {order.courier || "Flash Express"}
                  </span>
                  <span className="text-[10px] text-stone-500 block">
                    รถ: {order.vehicleType || "รถห้องเย็นปรับอุณหภูมิ"}
                  </span>
                </div>
              </div>

              {/* Actions row: Chat LINE, Call, Map, Update, Label, Confirm */}
              <div className="flex flex-wrap gap-2 pt-3 border-t border-stone-100">
                {/* ⚖️ หน้าออเดอร์เดี่ยว: ชั่ง / ยืนยันสลิป / จัดส่ง / ยกเลิก */}
                <a
                  href={`/admin/orders/${encodeURIComponent(order.id)}`}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5"
                  title="เปิดหน้าออเดอร์นี้ — ชั่งน้ำหนัก ยืนยันสลิป จัดส่ง"
                >
                  <Scale className="w-3.5 h-3.5 text-amber-300" />
                  <span>{canWeigh(order) ? "⚖️ ชั่ง / เปิดออเดอร์" : "เปิดออเดอร์"}</span>
                </a>

                {/* 💬 LINE Chat button */}
                <button
                  type="button"
                  onClick={() => setChatModalOrder(order)}
                  className="bg-[#06C755] hover:bg-[#05b34c] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5"
                  title="ส่งข้อความแจ้งเตือนเข้าห้องแชท LINE ลูกค้า หรือเปิด LINE OA Manager"
                >
                  <LineIcon className="w-3.5 h-3.5" />
                  <span>แชท LINE</span>
                </button>

                {/* 📞 Call Phone */}
                <a
                  href={`tel:${order.phone}`}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-800 px-3.5 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5 text-stone-500" />
                  <span>โทรหาลูกค้า</span>
                </a>

                {/* 📍 Map */}
                <a
                  href={
                    order.mapsUrl ||
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      order.address || order.customerName
                    )}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="bg-stone-100 hover:bg-stone-200 text-stone-800 px-3.5 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5 text-stone-500" />
                  <span>แผนที่นำทาง</span>
                </a>

                {/* Confirm Slip */}
                {orderStatusOf(order) === "รอชำระเงิน" && (
                  <button
                    disabled={savingId === order.id}
                    onClick={() => {
                      if (
                        normalizePaymentStatus(order.paymentStatus) === "slip_submitted" ||
                        confirm(`ออเดอร์ #${order.id} ยังไม่มีสลิป — ยืนยันว่าได้รับเงินแล้ว?`)
                      ) {
                        patchOrder(order.id, { orderStatus: "ชำระเงินแล้ว/เตรียมจัดส่ง" });
                      }
                    }}
                    className="bg-[#1B4D31] hover:bg-[#143B25] text-white px-4 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>✅ ยืนยันยอดชำระ</span>
                  </button>
                )}

                {/* Tracking & Lot */}
                <button
                  disabled={savingId === order.id}
                  onClick={() => openTrackingModal(order)}
                  className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-4 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>อัปเดตสถานะ / ใส่ Tracking &amp; ล็อต</span>
                </button>

                {/* Label Print */}
                <button
                  onClick={() => setLabelOrder(order)}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-800 px-4 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>พิมพ์ใบปะหน้ากล่อง</span>
                </button>
              </div>

              {/* Order Full Columns Audit Bar */}
              <div className="flex items-center gap-2 text-[10px] text-stone-400 pt-2 font-mono flex-wrap border-t border-stone-100 mt-2">
                <span>Order ID: <strong className="text-stone-700">{order.id}</strong></span>
                <span>• รอบ: {order.roundId}</span>
                <span>• ช่องทาง: <strong className="text-emerald-700">{order.channel || "LINE Official"}</strong></span>
                <span>• รถ: {order.vehicleType || "รถห้องเย็นปรับอุณหภูมิ"}</span>
                <span>• ผู้สร้าง: {order.createdBy || "customer"}</span>
                <span>• Update By: <strong className="text-stone-600 underline font-bold">{order.updatedBy || "Admin"}</strong></span>
                <span>• วันที่: {new Date(order.createDate || order.createdAt).toLocaleDateString("th-TH")}</span>
                {order.updatedAt && <span>• เวลาอัปเดต: {new Date(order.updatedAt).toLocaleTimeString("th-TH")}</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODALS */}
      {showManualOrder && (
        <ManualOrderModal
          products={products}
          rounds={rounds}
          users={users}
          onClose={() => setShowManualOrder(false)}
          onOrderCreated={(newOrder) => {
            if (onOrderCreated) onOrderCreated(newOrder);
          }}
        />
      )}

      {chatModalOrder && (
        <NotifyCustomerModal
          order={chatModalOrder}
          onClose={() => setChatModalOrder(null)}
        />
      )}

      {labelOrder && (
        <ShippingLabelModal
          order={labelOrder}
          onClose={() => setLabelOrder(null)}
        />
      )}

      {editingOrder && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setEditingOrder(null)}
        >
          <form
            onSubmit={handleSaveModal}
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl border border-stone-200"
          >
            <h3 className="font-extrabold text-lg text-stone-900">
              อัปเดตออเดอร์ {editingOrder.id}
            </h3>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                สถานะ (ตอนนี้: {orderStatusLabel[orderStatusOf(editingOrder)].text})
              </label>
              <select
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as CanonicalOrderStatus)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold"
              >
                <option value={orderStatusOf(editingOrder)}>คงสถานะเดิม (แก้แค่เลขพัสดุ/ล็อต)</option>
                {allowedNextStatuses(orderStatusOf(editingOrder)).map((s) => (
                  <option key={s} value={s}>
                    → {orderStatusLabel[s].text}
                  </option>
                ))}
              </select>
              {orderStatusOf(editingOrder) === "สั่งจอง" && (
                <p className="text-[10px] text-amber-700 mt-1">
                  ทุเรียนต้องชั่ง — ใช้ปุ่ม &quot;ชั่ง &amp; ส่งยอด&quot; แทน (เลือก &quot;รอชำระเงิน&quot; ที่นี่ = ส่งยอดตามราคาจอง)
                </p>
              )}
            </div>

            {nextStatus === "ยกเลิก" && (
              <div>
                <label className="block text-xs font-bold text-rose-700 mb-1">เหตุผลที่ยกเลิก (แจ้งลูกค้า)</label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="เช่น ของหมด / ลูกค้าขอยกเลิก"
                  className="w-full border border-rose-300 rounded-xl px-3 py-2 text-xs"
                />
                <p className="text-[10px] text-stone-500 mt-1">ระบบคืนสต็อกให้อัตโนมัติ — ถ้าลูกค้าจ่ายแล้ว ต้องโอนคืนเอง</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                บริษัทขนส่ง (เว้นว่างเพื่อให้จับจากเลขพัสดุอัตโนมัติ)
              </label>
              <select
                value={courierInput}
                onChange={(e) => setCourierInput(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold bg-white"
              >
                <option value="">จับอัตโนมัติจากเลขพัสดุ ({resolveCourierInfo(trackInput).name})</option>
                {COURIER_OPTIONS.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                เลขพัสดุ (Tracking No.)
              </label>
              <input
                type="text"
                value={trackInput}
                onChange={(e) => setTrackInput(e.target.value)}
                placeholder="เช่น TH0123456789AB / SCGTH... / EF...TH"
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                ผูกกับล็อตทุเรียน (Lot ID จากสวน/ล้งไหน)
              </label>
              <input
                type="text"
                list="lot-suggestions"
                value={lotInput}
                onChange={(e) => setLotInput(e.target.value)}
                placeholder="เช่น LOT-RY-01"
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono"
              />
              <datalist id="lot-suggestions">
                {lots.map((l) => (
                  <option key={l.lotId} value={l.lotId}>
                    {l.supplierName}
                  </option>
                ))}
              </datalist>
            </div>

            <label className="flex items-center gap-2 text-xs text-stone-700">
              <input
                type="checkbox"
                checked={notifyLine}
                onChange={(e) => setNotifyLine(e.target.checked)}
                className="accent-[#1B4D31]"
              />
              <span>ส่งการ์ดสถานะซ้ำให้ลูกค้าทาง LINE (เปลี่ยนสถานะแล้วระบบแจ้งลูกค้าเองอยู่แล้ว)</span>
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 bg-[#1B4D31] hover:bg-[#143B25] text-white font-bold py-2.5 rounded-xl text-xs"
              >
                บันทึกการเปลี่ยนแปลง
              </button>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="px-4 py-2.5 bg-stone-100 rounded-xl text-xs font-bold text-stone-600"
              >
                ยกเลิก
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

// ============== TAB 3: PRODUCTS ==============
function ProductsTab({
  products,
  onProductUpdated,
  onProductCreated,
}: {
  products: Product[];
  onProductUpdated: (p: Product) => void;
  onProductCreated: (p: Product) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states matching user's exact specification
  const [productType, setProductType] = useState<"รับคัดลูก" | "รับมาเป็นโลแล้วขายเลย">("รับคัดลูก");
  const [idInput, setIdInput] = useState("");
  const [name, setName] = useState("");
  const [maturity, setMaturity] = useState("แก่จัด 85%+");
  const [texture, setTexture] = useState("กรอบนอกนุ่มใน");
  const [stockQty, setStockQty] = useState(10);
  const [grade, setGrade] = useState("เกรด A+ พรีเมียม");
  const [weight, setWeight] = useState("3.0 - 3.5 กก.");
  const [image, setImage] = useState("https://images.unsplash.com/photo-1519544442-93857b48665e?auto=format&fit=crop&w=800&q=80");
  const [description, setDescription] = useState("หมอนทองคัดผลแก่จัด 85%+ หวานมันกลมกล่อม เม็ดลีบ ไม่ป้ายยาเร่งสุก");
  const [pricePerKg, setPricePerKg] = useState("220");
  const [isActiveState, setIsActiveState] = useState<number>(1);
  const [updatedByInput, setUpdatedByInput] = useState<string>("Admin");
  const [saving, setSaving] = useState(false);

  const openAddModal = () => {
    setEditingProduct(null);
    setIdInput("");
    setProductType("รับคัดลูก");
    setName("");
    setMaturity("แก่จัด 85%+");
    setTexture("กรอบนอกนุ่มใน");
    setStockQty(10);
    setGrade("เกรด A+ พรีเมียม");
    setWeight("3.0 - 3.5 กก.");
    setImage("https://images.unsplash.com/photo-1519544442-93857b48665e?auto=format&fit=crop&w=800&q=80");
    setDescription("หมอนทองคัดผลแก่จัด 85%+ หวานมันกลมกล่อม เม็ดลีบ ไม่ป้ายยาเร่งสุก");
    setPricePerKg("220");
    setIsActiveState(1);
    setUpdatedByInput("Admin");
    setShowModal(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setIdInput(p.id);
    setProductType((p.productType as any) || (p.type === "flesh" ? "รับมาเป็นโลแล้วขายเลย" : "รับคัดลูก"));
    setName(p.name);
    setMaturity(p.maturity || (p.specs?.maturity as any) || "แก่จัด 85%+");
    setTexture(p.texture || (p.specs?.texture as any) || "กรอบนอกนุ่มใน");
    setStockQty(p.stockQty ?? 0);
    setGrade(p.grade || "เกรด A+ พรีเมียม");
    setWeight(p.weight || "3.0 - 3.5 กก.");
    setImage(p.image || "https://images.unsplash.com/photo-1519544442-93857b48665e?auto=format&fit=crop&w=800&q=80");
    setDescription(p.description || "");
    setPricePerKg(String(p.pricePerKg || p.price || 220));
    const active = p.isActive === 0 || (p.isActive as any) === "0" || p.isActive === false ? 0 : 1;
    setIsActiveState(active);
    setUpdatedByInput(p.updatedBy || "Admin");
    setShowModal(true);
  };

  const toggleAvailability = async (p: Product) => {
    const res = await fetch(`/api/products/${encodeURIComponent(p.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable: !p.isAvailable, updatedBy: "Admin" }),
    });
    const json = (await res.json()) as { ok: boolean; product?: Product };
    if (res.ok && json.ok && json.product) {
      onProductUpdated(json.product);
    }
  };

  const toggleProductActive = async (p: Product) => {
    const currentActive =
      p.isActive === 0 || (p.isActive as any) === "0" || p.isActive === false
        ? 0
        : 1;
    const nextVal = currentActive === 1 ? 0 : 1;
    const res = await fetch(`/api/products/${encodeURIComponent(p.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        isActive: nextVal, 
        isAvailable: nextVal === 1,
        updatedBy: "Admin" 
      }),
    });
    const json = (await res.json()) as { ok: boolean; product?: Product };
    if (res.ok && json.ok && json.product) {
      onProductUpdated(json.product);
    }
  };

  const handleQuickEditPrice = async (p: Product) => {
    const input = window.prompt(
      `แก้ไขราคาต่อโลของ "${p.name}" (บาท/กก.):`,
      String(p.pricePerKg || p.price)
    );
    if (!input) return;
    const nextPrice = Number(input);
    if (!nextPrice || nextPrice <= 0) return;

    const res = await fetch(`/api/products/${encodeURIComponent(p.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pricePerKg: nextPrice, price: nextPrice, updatedBy: "Admin" }),
    });
    const json = (await res.json()) as { ok: boolean; product?: Product };
    if (res.ok && json.ok && json.product) {
      onProductUpdated(json.product);
    }
  };

  const handleQuickEditStock = async (p: Product) => {
    const currentVal = p.stockQty ?? 0;
    const input = window.prompt(
      `อัปเดตจำนวนลูกคงเหลือของ "${p.name}" (ลูก):`,
      String(currentVal)
    );
    if (input === null) return;
    const val = Number(input);
    if (Number.isNaN(val) || val < 0) return;

    const res = await fetch(`/api/products/${encodeURIComponent(p.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockQty: val, isAvailable: val > 0, updatedBy: "Admin" }),
    });
    const json = (await res.json()) as { ok: boolean; product?: Product };
    if (res.ok && json.ok && json.product) {
      onProductUpdated(json.product);
    }
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        id: idInput.trim() || undefined,
        productType,
        name: name.trim(),
        maturity,
        texture,
        stockQty: Number(stockQty || 0),
        grade,
        weight: weight.trim(),
        image: image.trim(),
        description: description.trim(),
        pricePerKg: Number(pricePerKg || 0),
        price: Number(pricePerKg || 0),
        isActive: isActiveState,
        isAvailable: isActiveState === 1 && Number(stockQty || 0) >= 1,
        updatedBy: updatedByInput.trim() || "Admin",
      };

      if (editingProduct) {
        const res = await fetch(`/api/products/${encodeURIComponent(editingProduct.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (res.ok && json.ok && json.product) {
          onProductUpdated(json.product);
          setShowModal(false);
        }
      } else {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (res.ok && json.ok && json.product) {
          onProductCreated(json.product);
          setShowModal(false);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-stone-900">
            คลังสินค้าและสต็อกทุเรียน ({products.length} รายการ)
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            โครงสร้างฐานข้อมูลใหม่: แยกประเภทคัดลูก/ชั่งโล, ระดับความสุก, Texture, ไซส์เกรด, จำนวนลูก, และราคาต่อโล
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-[#1B4D31] hover:bg-[#143B25] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-xs inline-flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4 text-amber-300" />
          <span>เพิ่มทุเรียนรายการใหม่</span>
        </button>
      </div>

      <div className="grid gap-3">
        {products.map((p) => {
          const isActive = p.isActive !== 0 && (p.isActive as any) !== "0" && p.isActive !== false;
          const stockNum = p.stockQty ?? 0;
          const hasStock = isActive && stockNum >= 1;

          return (
            <div
              key={p.id}
              className={`bg-white rounded-2xl shadow-xs border p-4 sm:p-5 flex flex-col md:flex-row md:items-center gap-4 transition ${
                isActive ? "border-stone-200 hover:border-stone-300" : "border-rose-200 bg-rose-50/20"
              }`}
            >
              <div className="relative shrink-0">
                <img
                  src={p.image}
                  alt={p.name}
                  className={`w-20 h-20 rounded-2xl object-cover bg-stone-100 border shadow-xs ${
                    isActive ? "border-stone-200" : "border-rose-200 opacity-70"
                  }`}
                />
                {!isActive && (
                  <span className="absolute inset-x-0 bottom-0 bg-rose-600/90 text-white text-[9px] font-bold text-center py-0.5 rounded-b-2xl">
                    ปิดการขาย
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-md font-bold text-stone-700">
                    {p.id}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      p.productType === "รับมาเป็นโลแล้วขายเลย"
                        ? "bg-purple-50 text-purple-800 border-purple-200"
                        : "bg-emerald-50 text-emerald-800 border-emerald-200"
                    }`}
                  >
                    {p.productType || "รับคัดลูก"}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                    {p.grade || "เกรด A+ พรีเมียม"}
                  </span>
                  {isActive ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      IS_ACTIVE: 1 (เปิดขาย)
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      IS_ACTIVE: 0 (ปิดขาย — หมดสต็อกทันที)
                    </span>
                  )}
                </div>

                <h3 className="font-extrabold text-base text-stone-900 flex items-center gap-2">
                  <span>{p.name}</span>
                  {!isActive && (
                    <span className="text-xs text-rose-600 font-bold bg-rose-100 px-2 py-0.5 rounded-md">
                      [หมดสต็อกทันที]
                    </span>
                  )}
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-stone-600 pt-1">
                  <div>
                    <span className="text-stone-400 block text-[10px]">ระดับความสุก:</span>
                    <span className="font-bold text-amber-800">
                      {p.maturity || p.specs?.maturity || "แก่จัด 85%+"}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">Texture:</span>
                    <span className="font-bold text-teal-800">
                      {p.texture || p.specs?.texture || "กรอบนอกนุ่มใน"}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">น้ำหนักต่อลูก:</span>
                    <span className="font-bold text-stone-800">{p.weight}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">จำนวนคงเหลือ:</span>
                    <span className={`font-bold font-mono text-sm ${hasStock ? "text-emerald-800" : "text-rose-600"}`}>
                      {stockNum} ลูก
                    </span>
                    <span className="text-[10px] block font-semibold">
                      {!isActive ? (
                        <span className="text-rose-600">หมดทันที (ปิดขาย)</span>
                      ) : stockNum >= 1 ? (
                        <span className="text-emerald-700">✓ มีสินค้าพร้อมขาย</span>
                      ) : (
                        <span className="text-rose-600">✕ หมดสต็อก (0 ลูก)</span>
                      )}
                    </span>
                  </div>
                </div>

                {p.description && (
                  <p className="text-xs text-stone-500 pt-1 line-clamp-2">
                    📝 {p.description}
                  </p>
                )}

                {/* Audit: Update By & Last Update Time */}
                <div className="flex items-center gap-2 text-[11px] text-stone-600 pt-1.5 font-mono flex-wrap bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-200">
                  <span className="font-bold text-stone-700 inline-flex items-center gap-1">
                    👤 Update By: <span className="text-emerald-800 underline font-semibold">{p.updatedBy || p.createdBy || "Admin"}</span>
                  </span>
                  <span className="text-stone-300">•</span>
                  <span>🕒 อัปเดตเมื่อ: {p.updatedAt ? new Date(p.updatedAt).toLocaleString("th-TH") : (p.createDate ? new Date(p.createDate).toLocaleString("th-TH") : "-")}</span>
                  <span className="text-stone-300">•</span>
                  <span className="text-stone-400">สร้าง: {p.createdBy || "admin"}</span>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-2.5 shrink-0 flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-stone-100">
                <div className="text-right pr-2">
                  <span className="text-[10px] text-stone-400 block">ราคาต่อโล</span>
                  <p className="font-black text-[#1B4D31] text-lg font-mono">
                    ฿{(p.pricePerKg || p.price).toLocaleString()}
                    <span className="text-xs font-normal text-stone-500"> /กก.</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(p)}
                    className="bg-stone-100 hover:bg-stone-200 text-stone-800 px-3 py-1.5 rounded-xl text-xs font-bold transition"
                    title="แก้ไขข้อมูลสินค้าครบทุกช่อง"
                  >
                    แก้ไข
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickEditStock(p)}
                    className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-1.5 rounded-xl text-xs font-bold transition font-mono"
                    title="แก้จำนวนลูกคงเหลือด่วน"
                  >
                    แก้สต็อก ({stockNum})
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickEditPrice(p)}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 px-2.5 py-1.5 rounded-xl text-xs font-bold transition font-mono"
                    title="แก้ราคาต่อโลด่วน"
                  >
                    แก้ราคา
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleProductActive(p)}
                    title="คลิกเพื่อสลับเปิดขาย (1) หรือ ปิดการขายหมดสต็อกทันที (0)"
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition border shadow-xs inline-flex items-center gap-1 ${
                      isActive
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700"
                        : "bg-rose-600 hover:bg-rose-700 text-white border-rose-700"
                    }`}
                  >
                    {isActive ? (
                      <>
                        <span>🟢 เปิดขายอยู่</span>
                        <span className="text-[10px] opacity-80">(คลิกเพื่อปิด)</span>
                      </>
                    ) : (
                      <>
                        <span>🔴 ปิดการขาย</span>
                        <span className="text-[10px] opacity-80">(คลิกเพื่อเปิด)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: ADD / EDIT PRODUCT */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setShowModal(false)}
        >
          <form
            onSubmit={handleSubmitModal}
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-xl rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl border border-stone-200 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-extrabold text-lg text-stone-900">
                {editingProduct ? `แก้ไขข้อมูลทุเรียน (${editingProduct.id})` : "เพิ่มสินค้าทุเรียนใหม่"}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-stone-400 hover:text-stone-600 text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  ประเภทสินค้า (ดรอปดาวน์) *
                </label>
                <select
                  value={productType}
                  onChange={(e) => setProductType(e.target.value as any)}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-bold"
                >
                  <option value="รับคัดลูก">รับคัดลูก (คัดพิเศษเฉพาะลูก)</option>
                  <option value="รับมาเป็นโลแล้วขายเลย">รับมาเป็นโลแล้วขายเลย (ชั่งกิโลขาย)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  รหัสสินค้า (Product ID)
                </label>
                <input
                  value={idInput}
                  onChange={(e) => setIdInput(e.target.value)}
                  placeholder="เว้นว่างเพื่อสร้างรหัส WK-XX อัตโนมัติ"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                ชื่อสินค้า (Product Name) *
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น หมอนทองระยอง คัดเกรดพรีเมียม A+"
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  ระดับความสุก maturity (ดรอปดาวน์) *
                </label>
                <select
                  value={maturity}
                  onChange={(e) => setMaturity(e.target.value)}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-bold"
                >
                  <option value="แก่จัด 85%+">แก่จัด 85%+</option>
                  <option value="สุกพอดีกิน">สุกพอดีกิน</option>
                  <option value="สุกพร้อมทาน 100%">สุกพร้อมทาน 100%</option>
                  <option value="ห่าม/ตัดสดบ่มเอง 80%">ห่าม/ตัดสดบ่มเอง 80%</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Texture สัมผัสเนื้อ (ดรอปดาวน์) *
                </label>
                <select
                  value={texture}
                  onChange={(e) => setTexture(e.target.value)}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-bold"
                >
                  <option value="กรอบนอกนุ่มใน">กรอบนอกนุ่มใน</option>
                  <option value="เนื้อไก่ฉีก">เนื้อไก่ฉีก</option>
                  <option value="นุ่มละมุน/ครีมมี่">นุ่มละมุน/ครีมมี่</option>
                  <option value="สุกนิ่มหวานฉ่ำ">สุกนิ่มหวานฉ่ำ</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  ไซส์ / เกรด (ดรอปดาวน์) *
                </label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white font-bold"
                >
                  <option value="เกรด A+ พรีเมียม">เกรด A+ พรีเมียม</option>
                  <option value="เกรด A ทรงสวย">เกรด A ทรงสวย</option>
                  <option value="เกรด B ผลไม่สมมาตร">เกรด B ผลไม่สมมาตร</option>
                  <option value="เกรดจัมโบ้">เกรดจัมโบ้</option>
                  <option value="เกรดมินิ">เกรดมินิ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  น้ำหนักต่อลูก *
                </label>
                <input
                  required
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="เช่น 3.0 - 3.5 กก."
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  จำนวนลูก (สต็อก) *
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={stockQty}
                  onChange={(e) => setStockQty(Number(e.target.value))}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-center"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  ราคาต่อโล (บาท/กก.) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={pricePerKg}
                  onChange={(e) => setPricePerKg(e.target.value)}
                  placeholder="เช่น 220"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold font-mono text-emerald-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  ลิงก์รูปภาพ (Image URL)
                </label>
                <input
                  type="url"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono text-[11px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                รายละเอียดสินค้า (รสชาติ หวานน้อย หวานมัน กลิ่นหอม) *
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="อธิบายระดับความหวาน ความมัน เม็ดลีบ หรือความพิเศษของทุเรียนล็อตนี้..."
                className="w-full border border-stone-300 rounded-xl p-3 text-xs leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-200">
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  สถานะการขาย (IS_ACTIVE) *
                </label>
                <select
                  value={isActiveState}
                  onChange={(e) => setIsActiveState(Number(e.target.value))}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold bg-white"
                >
                  <option value={1}>1: เปิดขาย (นับสต็อกจริง ต้องมี 1 ลูกขึ้นไป)</option>
                  <option value={0}>0: ปิดการขาย (หมดสต็อกทันที ไม่สนสต็อก)</option>
                </select>
                <p className="text-[10px] text-stone-500 mt-1">
                  {isActiveState === 1
                    ? "✓ เริ่มนับตามสต็อกจริง (ถ้าสต็อก 0 แสดงว่าหมด, 1 ลูกขึ้นไปแสดงว่ามี)"
                    : "✕ ระบบจะขึ้นว่าหมดสต็อกทันที ไม่สนว่าจะมีในสต็อกกี่ลูก"}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  ผู้บันทึก / อัปเดตสถานะ (Update By) *
                </label>
                <input
                  type="text"
                  required
                  value={updatedByInput}
                  onChange={(e) => setUpdatedByInput(e.target.value)}
                  placeholder="เช่น Admin, ผู้จัดการร้าน"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold font-mono"
                />
                <p className="text-[10px] text-stone-500 mt-1">
                  บันทึกลงคอลัมน์ UpdatedBy เพื่อตรวจเช็คว่าใครเป็นคนเปลี่ยนสถานะ
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-stone-100">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-[#1B4D31] hover:bg-[#143B25] text-white font-bold py-2.5 rounded-xl text-xs transition disabled:opacity-50"
              >
                {saving ? "กำลังบันทึกข้อมูล..." : editingProduct ? "บันทึกการแก้ไข" : "เพิ่มสินค้าใหม่"}
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs transition"
              >
                ยกเลิก
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ============== TAB 4: LOTS & ROUNDS ==============
function LotsAndRoundsTab({
  rounds,
  lots,
  onLotCreated,
  onRoundCreated,
  onRoundUpdated,
}: {
  rounds: Round[];
  lots: LotCost[];
  onLotCreated: (l: LotCost) => void;
  onRoundCreated: (r: Round) => void;
  onRoundUpdated: (r: Round) => void;
}) {
  const [supplierName, setSupplierName] = useState("");
  const [variety, setVariety] = useState("หมอนทอง");
  const [weightKg, setWeightKg] = useState("");
  const [costPerKg, setCostPerKg] = useState("");
  const [packagingCost, setPackagingCost] = useState("400");
  const [truckFuelCost, setTruckFuelCost] = useState("1000");
  const [notes, setNotes] = useState("");
  const [savingLot, setSavingLot] = useState(false);

  const [newRoundName, setNewRoundName] = useState("");
  const [newRoundRoute, setNewRoundRoute] = useState(
    "ระยอง (แกลง) → จันทบุรี → ส่งตรงถึงบ้าน"
  );
  const [newRoundQuota, setNewRoundQuota] = useState("100");
  const [showNewRound, setShowNewRound] = useState(false);

  const handleAddLot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLot(true);
    try {
      const res = await fetch("/api/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId: rounds[0]?.id || "WK-ROUND-46",
          supplierName,
          variety,
          weightKg: Number(weightKg),
          costPerKg: Number(costPerKg),
          packagingCost: Number(packagingCost) || 0,
          truckFuelCost: Number(truckFuelCost) || 0,
          notes,
        }),
      });
      const json = (await res.json()) as { ok: boolean; lot?: LotCost };
      if (res.ok && json.ok && json.lot) {
        onLotCreated(json.lot);
        setSupplierName("");
        setWeightKg("");
        setCostPerKg("");
        setNotes("");
      }
    } finally {
      setSavingLot(false);
    }
  };

  const handleCreateRound = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/rounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newRoundName,
        truckRoute: newRoundRoute,
        totalQuota: Number(newRoundQuota) || 100,
      }),
    });
    const json = (await res.json()) as { ok: boolean; round?: Round };
    if (res.ok && json.ok && json.round) {
      onRoundCreated(json.round);
      setShowNewRound(false);
      setNewRoundName("");
    }
  };

  const toggleRoundStatus = async (r: Round) => {
    const next = r.status === "open" ? "closed" : "open";
    const res = await fetch(`/api/rounds/${encodeURIComponent(r.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const json = (await res.json()) as { ok: boolean; round?: Round };
    if (res.ok && json.ok && json.round) {
      onRoundUpdated(json.round);
    }
  };

  return (
    <div className="space-y-6">
      {/* Rounds section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-stone-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#1B4D31]" />
            <span>รอบวิ่งรถกระบะ</span>
          </h2>
          <button
            onClick={() => setShowNewRound(true)}
            className="bg-[#1B4D31] hover:bg-[#143B25] text-white px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>เปิดรอบวิ่งรถใหม่</span>
          </button>
        </div>

        <div className="grid gap-3">
          {rounds.map((r) => (
            <div
              key={r.id}
              className="bg-gradient-to-r from-[#11301F] to-[#1B4D31] text-white rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
            >
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      r.status === "open"
                        ? "bg-amber-500 text-stone-950"
                        : "bg-white/20 text-stone-200"
                    }`}
                  >
                    {r.status === "open" ? "กำลังเปิดรับออเดอร์" : "ปิดรอบแล้ว"}
                  </span>
                  <span className="text-xs font-mono text-emerald-200">{r.id}</span>
                </div>
                <h3 className="font-bold text-base">{r.name}</h3>
                <p className="text-xs text-emerald-100/80 mt-0.5">{r.truckRoute}</p>
                <p className="text-xs text-amber-300 mt-1 font-semibold">
                  โควตาคงเหลือ: {r.quotaRemaining} / {r.totalQuota} ลูก • ส่ง:{" "}
                  {r.deliveryDate}
                </p>
              </div>
              <button
                onClick={() => toggleRoundStatus(r)}
                className="bg-white/15 hover:bg-white/25 px-4 py-2 rounded-xl text-xs font-bold shrink-0 inline-flex items-center gap-1.5"
              >
                {r.status === "open" ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>ปิดรับรอบนี้</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>เปิดรับอีกครั้ง</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Lots Cost */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleAddLot}
          className="lg:col-span-5 bg-white rounded-2xl p-5 shadow-xs border border-stone-200 space-y-3"
        >
          <h3 className="font-extrabold text-base text-stone-900 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#1B4D31]" />
            <span>บันทึกบิลรับทุเรียนจากสวน / ล้ง</span>
          </h3>
          <p className="text-[11px] text-stone-500">
            บันทึกต้นทุนจริงแต่ละล็อตเพื่อคำนวณกำไรสุทธิ (ลงแท็บ Lots_Cost)
          </p>

          <div>
            <label className="block text-xs font-bold mb-1">
              ชื่อสวน / ล้งที่ไปรับ *
            </label>
            <input
              required
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="เช่น สวนเจ๊พร อ.แกลง จ.ระยอง"
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-bold mb-1">พันธุ์</label>
              <input
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">น้ำหนัก (กก.) *</label>
              <input
                type="number"
                required
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="50"
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">ทุน/กก. (฿) *</label>
              <input
                type="number"
                required
                value={costPerKg}
                onChange={(e) => setCostPerKg(e.target.value)}
                placeholder="135"
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold mb-1">
                ค่ากล่อง/แพ็กเกจ (฿)
              </label>
              <input
                type="number"
                value={packagingCost}
                onChange={(e) => setPackagingCost(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">
                ค่าน้ำมันรถกระบะ (฿)
              </label>
              <input
                type="number"
                value={truckFuelCost}
                onChange={(e) => setTruckFuelCost(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">หมายเหตุคุณภาพ</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เช่น แก่ 85% เนื้อสวย ไม่มีหนอน"
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
            />
          </div>

          {weightKg && costPerKg && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs font-bold text-amber-900">
              รวมต้นทุนทุเรียนล็อตนี้: ฿
              {(Number(weightKg) * Number(costPerKg)).toLocaleString()}
            </div>
          )}

          <button
            type="submit"
            disabled={savingLot}
            className="w-full bg-[#1B4D31] hover:bg-[#143B25] text-white font-bold py-3 rounded-xl text-xs transition"
          >
            {savingLot ? "กำลังบันทึก..." : "บันทึกต้นทุนล็อตนี้"}
          </button>
        </form>

        <div className="lg:col-span-7 space-y-3">
          <h3 className="font-extrabold text-base text-stone-900">
            ประวัติการรับของจากสวน/ล้ง ({lots.length} ล็อต)
          </h3>
          {lots.map((l) => (
            <div
              key={l.lotId}
              className="bg-white rounded-2xl p-4 shadow-xs border border-stone-200 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="bg-amber-50 text-amber-900 border border-amber-200 font-mono text-xs font-bold px-2 py-0.5 rounded">
                    {l.lotId}
                  </span>
                  <h4 className="font-bold text-sm text-stone-900">
                    {l.supplierName}
                  </h4>
                </div>
                <span className="text-xs text-stone-400">{l.date}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs bg-stone-50 rounded-xl p-2.5 border border-stone-100">
                <div>
                  <span className="text-stone-400 block text-[10px]">น้ำหนัก</span>
                  <strong>{l.weightKg} กก.</strong>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px]">ทุน/กก.</span>
                  <strong>฿{l.costPerKg}</strong>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px]">
                    ค่ากล่อง+น้ำมัน
                  </span>
                  <strong>
                    ฿{(l.packagingCost + l.truckFuelCost).toLocaleString()}
                  </strong>
                </div>
                <div className="text-right">
                  <span className="text-stone-400 block text-[10px]">
                    ต้นทุนรวม
                  </span>
                  <strong className="text-rose-600">
                    ฿
                    {(
                      l.totalFruitCost +
                      l.packagingCost +
                      l.truckFuelCost
                    ).toLocaleString()}
                  </strong>
                </div>
              </div>
              {l.notes && <p className="text-xs text-stone-500">{l.notes}</p>}
            </div>
          ))}
        </div>
      </div>

      {showNewRound && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowNewRound(false)}
        >
          <form
            onSubmit={handleCreateRound}
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md rounded-2xl p-6 space-y-3 shadow-2xl border border-stone-200"
          >
            <h3 className="font-extrabold text-lg text-stone-900">
              เปิดรอบวิ่งรถกระบะใหม่
            </h3>
            <div>
              <label className="block text-xs font-bold mb-1">ชื่อรอบ *</label>
              <input
                required
                value={newRoundName}
                onChange={(e) => setNewRoundName(e.target.value)}
                placeholder="เช่น รอบวันอังคารที่ 18 พ.ย. (ระยอง)"
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">สายวิ่งรถ</label>
              <input
                value={newRoundRoute}
                onChange={(e) => setNewRoundRoute(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">
                โควตารับจอง (ลูก)
              </label>
              <input
                type="number"
                value={newRoundQuota}
                onChange={(e) => setNewRoundQuota(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 bg-[#1B4D31] text-white font-bold py-2.5 rounded-xl text-xs"
              >
                เปิดรอบใหม่
              </button>
              <button
                type="button"
                onClick={() => setShowNewRound(false)}
                className="px-4 py-2.5 bg-stone-100 rounded-xl text-xs font-bold text-stone-600"
              >
                ยกเลิก
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ============== TAB 5: CLAIMS ==============
function ClaimsTab({
  claims,
  lots,
  onClaimUpdated,
}: {
  claims: Claim[];
  lots: LotCost[];
  onClaimUpdated: (c: Claim) => void;
}) {
  const handleDecision = async (claimId: string, status: ClaimStatus) => {
    const note = window.prompt(
      "ระบุหมายเหตุการเคลม (เช่น โอนคืน 300 บ. / ส่งลูกใหม่รอบหน้า):",
      ""
    );
    const res = await fetch(`/api/claims/${encodeURIComponent(claimId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolutionNote: note || "" }),
    });
    const json = (await res.json()) as { ok: boolean; claim?: Claim };
    if (res.ok && json.ok && json.claim) {
      onClaimUpdated(json.claim);
    }
  };

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-extrabold text-stone-900">
        ศูนย์จัดการคำร้องเคลมทุเรียน ({claims.length})
      </h2>

      <div className="space-y-3">
        {claims.map((c) => {
          const sourceLot = lots.find((l) => l.lotId === c.lotId);
          return (
            <div
              key={c.claimId}
              className="bg-white rounded-2xl shadow-xs border border-stone-200 p-5 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-sm text-stone-900">
                      {c.claimId}
                    </span>
                    <span className="text-xs font-mono text-[#1B4D31] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                      ออเดอร์: {c.orderId}
                    </span>
                    {c.lotId && (
                      <span className="text-xs font-mono text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-bold">
                        ล็อต: {c.lotId}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    {new Date(c.createdAt).toLocaleString("th-TH")} • เบอร์:{" "}
                    {c.phone}
                  </p>
                </div>
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full ${
                    claimStatusLabel[c.status]?.color || "bg-stone-100"
                  }`}
                >
                  {claimStatusLabel[c.status]?.text || c.status}
                </span>
              </div>

              <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3 text-xs space-y-1">
                <p className="font-bold text-rose-900">สาเหตุ: {c.reason}</p>
                <p className="text-stone-700">{c.description || "-"}</p>
                {c.evidenceName && (
                  <p className="text-stone-500">ไฟล์แนบ: {c.evidenceName}</p>
                )}
              </div>

              {sourceLot && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-950">
                  <strong>สืบย้อนกลับถึงต้นทาง:</strong> ล็อต {sourceLot.lotId} รับมาจาก{" "}
                  <strong>{sourceLot.supplierName}</strong> ({sourceLot.date})
                </div>
              )}

              {c.resolutionNote && (
                <p className="text-xs text-[#1B4D31] font-bold">
                  ผลการเคลม: {c.resolutionNote}
                </p>
              )}

              {c.status === "pending" && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-100">
                  <button
                    onClick={() => handleDecision(c.claimId, "approved_replace")}
                    className="bg-[#1B4D31] hover:bg-[#143B25] text-white px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>อนุมัติส่งลูกใหม่</span>
                  </button>
                  <button
                    onClick={() => handleDecision(c.claimId, "approved_refund")}
                    className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>อนุมัติโอนเงินคืน</span>
                  </button>
                  <button
                    onClick={() => handleDecision(c.claimId, "rejected")}
                    className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>ไม่อนุมัติ</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {claims.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center text-xs text-stone-400 border border-stone-200">
            ยังไม่มีคำร้องแจ้งเคลมเข้ามาครับ
          </div>
        )}
      </div>
    </div>
  );
}

// ============== TAB 6: SUMMARY P&L ==============
function SummaryTab({ orders, lots }: { orders: Order[]; lots: LotCost[] }) {
  const totalSales = orders.reduce((s, o) => s + o.totalPrice, 0);
  const totalShipping = orders.reduce((s, o) => s + o.shippingCost, 0);
  const fruitCost = lots.reduce((s, l) => s + l.totalFruitCost, 0);
  const packCost = lots.reduce((s, l) => s + l.packagingCost, 0);
  const fuelCost = lots.reduce((s, l) => s + l.truckFuelCost, 0);
  const totalExpenses = fruitCost + packCost + fuelCost;
  const grossProfit = totalSales - totalExpenses;
  const margin = totalSales > 0 ? Math.round((grossProfit / totalSales) * 100) : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-extrabold text-stone-900">
        สรุปยอดขาย &amp; กำไรจริง
      </h2>

      <div className="bg-white rounded-2xl shadow-xs border border-stone-200 p-6 space-y-4">
        <div className="flex justify-between items-center py-2 border-b border-stone-100">
          <span className="text-sm text-stone-600">
            ยอดขายทุเรียน ({orders.length} ออเดอร์)
          </span>
          <span className="font-bold text-stone-900 font-mono">
            ฿{totalSales.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-stone-100">
          <span className="text-sm text-stone-600">ค่าจัดส่งที่เก็บจากลูกค้า</span>
          <span className="font-bold text-stone-900 font-mono">
            ฿{totalShipping.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-stone-100">
          <span className="text-sm text-rose-600">
            ต้นทุนรับทุเรียนจากสวน/ล้ง ({lots.length} บิล)
          </span>
          <span className="font-bold text-rose-600 font-mono">
            -฿{fruitCost.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-stone-100">
          <span className="text-sm text-rose-600">ค่ากล่องและอุปกรณ์แพ็ก</span>
          <span className="font-bold text-rose-600 font-mono">
            -฿{packCost.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-stone-100">
          <span className="text-sm text-rose-600">
            ค่าน้ำมันรถกระบะวิ่งรับของ
          </span>
          <span className="font-bold text-rose-600 font-mono">
            -฿{fuelCost.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center py-4 bg-emerald-50 rounded-2xl px-4 border border-emerald-200">
          <div>
            <span className="font-extrabold text-[#1B4D31] block">
              กำไรสุทธิหลังหักต้นทุนทั้งหมด
            </span>
            <span className="text-xs text-emerald-700">
              อัตรากำไรขั้นต้น: {margin}%
            </span>
          </div>
          <span className="text-3xl font-black text-[#1B4D31] font-mono">
            ฿{grossProfit.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============== TAB 7: GOOGLE SHEET & LINE SETTINGS ==============
function SettingsTab({
  sourceMode,
  onConfigChanged,
}: {
  sourceMode: "google-sheets" | "local";
  onConfigChanged: () => void;
}) {
  const [config, setConfig] = useState<ConfigInfo | null>(null);
  const [appsScriptCode, setAppsScriptCode] = useState("");
  const [webAppUrl, setWebAppUrl] = useState("");
  const [sheetViewUrl, setSheetViewUrl] = useState("");
  const [userSheetUrl, setUserSheetUrl] = useState("https://docs.google.com/spreadsheets/d/16Np4KAWCGv9RGIrj3hAqUCeNK1EXjiHLXmBfg849yHQ/edit?usp=sharing");
  const [thureanSheetUrl, setThureanSheetUrl] = useState("https://docs.google.com/spreadsheets/d/1QQcCxxnuHg9nmAQ-JHmTdIaC2kA-vnJEJpmOvWlgMb8/edit?usp=sharing");
  const [lineToken, setLineToken] = useState("");
  const [lineOaId, setLineOaId] = useState("");
  const [lineAdminId, setLineAdminId] = useState("");
  const [lineGroupId, setLineGroupId] = useState("");
  const [lineLiffId, setLineLiffId] = useState("");
  const [lineLoginChannelId, setLineLoginChannelId] = useState("");
  const [lineLoginSecret, setLineLoginSecret] = useState("");
  const [publicBaseUrl, setPublicBaseUrl] = useState("");
  const [livePlatform, setLivePlatform] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [liveNote, setLiveNote] = useState("");
  const [isLiveNow, setIsLiveNow] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [isCloudServerless, setIsCloudServerless] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          setConfig(json.config);
          setIsCloudServerless(Boolean(json.isCloudServerless));
          setWebAppUrl(json.config.googleSheetsWebAppUrl || "");
          setSheetViewUrl(json.config.googleSheetViewUrl || "");
          if (json.config.userSheetViewUrl) setUserSheetUrl(json.config.userSheetViewUrl);
          if (json.config.thureanSheetViewUrl) setThureanSheetUrl(json.config.thureanSheetViewUrl);
          setLineOaId(json.config.lineOaId || "");
          setLineAdminId(json.config.lineAdminUserId || "");
          setLineGroupId(json.config.lineAdminGroupId || "");
          setLineLiffId(json.config.lineLiffId || "");
          setLineLoginChannelId(json.config.lineLoginChannelId || "");
          setPublicBaseUrl(json.config.publicBaseUrl || "");
          setLivePlatform(json.config.liveStreamPlatform || "");
          setLiveUrl(json.config.liveStreamUrl || "");
          setLiveNote(json.config.liveStreamNote || "");
          setIsLiveNow(Boolean(json.config.isLiveNow));
          setAppsScriptCode(json.appsScriptCode || "");
        }
      });
  }, []);

  const callConfigApi = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        ok: boolean;
        message?: string;
        error?: string;
        counts?: Record<string, number>;
      };
      if (res.ok && json.ok) {
        const extra = json.counts
          ? ` (สินค้า ${json.counts.products}, ออเดอร์ ${json.counts.orders}, ล็อต ${json.counts.lots})`
          : "";
        setStatusMsg({ ok: true, text: (json.message || "สำเร็จ") + extra });
        onConfigChanged();
      } else {
        setStatusMsg({ ok: false, text: json.error || "เกิดข้อผิดพลาด" });
      }
    } catch {
      setStatusMsg({ ok: false, text: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้" });
    } finally {
      setBusy(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleDeployRichMenu = async () => {
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/line/richmenu", { method: "POST" });
      const json = (await res.json()) as {
        ok: boolean;
        richMenuId?: string;
        message?: string;
        error?: string;
      };
      if (res.ok && json.ok) {
        setStatusMsg({
          ok: true,
          text: `${json.message || "ติดตั้ง Rich Menu สำเร็จ"} (ID: ${json.richMenuId})`,
        });
      } else {
        setStatusMsg({ ok: false, text: json.error || "ติดตั้ง Rich Menu ไม่สำเร็จ" });
      }
    } catch {
      setStatusMsg({ ok: false, text: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-stone-900">
          เชื่อมต่อ Google Sheet &amp; LINE OA
        </h2>
        <p className="text-xs text-stone-500 mt-1 flex items-center gap-1.5">
          <span>สถานะปัจจุบัน:</span>
          <span
            className={`inline-flex items-center gap-1.5 font-bold ${
              sourceMode === "google-sheets" ? "text-[#1B4D31]" : "text-amber-700"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                sourceMode === "google-sheets" ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            {sourceMode === "google-sheets"
              ? "เชื่อมต่อ Google Sheets แบบเรียลไทม์แล้ว"
              : "Local Mode (เก็บในเครื่องชั่วคราว — รอลิงก์ Google Sheet)"}
          </span>
        </p>
      </div>

      {isCloudServerless && sourceMode !== "google-sheets" && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-xs text-amber-950 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">ตรวจพบว่ากำลังรันบน Cloud Serverless (Vercel)</p>
            <p className="text-amber-800 leading-relaxed">
              กรุณา Deploy โค้ด Apps Script ด้านล่างเป็น Web App แล้วนำ URL มาใส่ใน Vercel Environment Variables (
              <code>GOOGLE_SHEETS_WEBAPP_URL</code>, <code>LINE_CHANNEL_ACCESS_TOKEN</code>, <code>LINE_ADMIN_USER_ID</code>) เพื่อให้ข้อมูลออเดอร์และสต็อกบันทึกลง Google Sheet ถาวรครับ
            </p>
          </div>
        </div>
      )}

      {/* Step-by-step Guide */}
      <div className="bg-[#11301F] text-white rounded-2xl p-6 space-y-4 shadow-sm border border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="bg-amber-500 text-stone-950 text-[10px] font-black px-2.5 py-0.5 rounded-full">
              SETUP GUIDE (4 ขั้นตอนง่าย ๆ)
            </span>
            <h3 className="font-bold text-base mt-1.5 text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-amber-300" />
              <span>วิธีสร้าง Google Sheet ให้เป็นฐานข้อมูลร้านทุเรียนวินคิน</span>
            </h3>
          </div>
          {appsScriptCode && (
            <button
              onClick={handleCopyCode}
              className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-4 py-2 rounded-xl text-xs font-bold shrink-0 inline-flex items-center gap-1.5"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>คัดลอกโค้ดแล้ว</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>คัดลอกโค้ดทั้งหมด (รวม 7 ไฟล์)</span>
                </>
              )}
            </button>
          )}
        </div>

        <ol className="text-xs text-stone-200 space-y-2 list-decimal list-inside leading-relaxed">
          <li>
            เปิด Google Sheet แล้วคลิกเมนู{" "}
            <strong className="text-white">ส่วนขยาย (Extensions) → Apps Script</strong>
          </li>
          <li>
            ลบไฟล์และโค้ดเดิมออกทั้งหมด แล้วกด{" "}
            <strong className="text-amber-300">&quot;คัดลอกโค้ดทั้งหมด&quot;</strong>{" "}
            ด้านบนมาวางในไฟล์เดียว แล้วกดบันทึก (Ctrl+S) — หรือแยกเป็น 7 ไฟล์ตามโฟลเดอร์{" "}
            <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-300">google-apps-script/</code> ก็ได้ ผลเหมือนกัน
          </li>
          <li>
            เลือกฟังก์ชัน <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-300">generateApiKey</code> แล้วกด <strong>Run</strong> 1 ครั้ง
            คัดลอก key จาก Execution log ไปใส่ตัวแปร <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-300">GOOGLE_SHEETS_API_KEY</code> บน Vercel
            แล้ว Redeploy เว็บ
          </li>
          <li>
            กด{" "}
            <strong className="text-white">Deploy → Manage deployments → แก้ไข → New version</strong>{" "}
            (ถ้ายังไม่เคย Deploy ให้เลือก New deployment → Web app, Execute as: Me, Who has access: Anyone)
            แล้วนำ <strong>Web app URL</strong> มาวางช่องด้านล่าง
          </li>
          <li>
            ถ้ามีข้อมูลเก่าอยู่แล้ว เลือกฟังก์ชัน <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-300">migrateToRunningIds</code> แล้วกด <strong>Run</strong> 1 ครั้ง
            เพื่อลบแถวซ้ำและเปลี่ยนรหัสสมาชิกเป็นเลขรัน
          </li>
        </ol>
      </div>

      {/* Configuration Form */}
      <div className="bg-white rounded-2xl shadow-xs border border-stone-200 p-6 space-y-4">
        <h3 className="font-extrabold text-base text-stone-900">ตั้งค่าการเชื่อมต่อ</h3>

        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1">
            Google Apps Script Web App URL *
          </label>
          <input
            type="url"
            value={webAppUrl}
            onChange={(e) => setWebAppUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/AKfycb.../exec"
            className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs font-mono"
          />
        </div>

        {/* Dual Google Sheet Links */}
        <div className="space-y-3 bg-stone-50 p-4 rounded-2xl border border-stone-200">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#1B4D31]" />
            <span className="text-xs font-black text-stone-900">
              ฐานข้อมูล 2 Google Sheets (Relational DB เชื่อมโยงผ่าน User ID)
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">
              🍈 1. THUREAN Sheet (สต็อกสินค้า, คำสั่งซื้อ Orders, แจ้งเคลม Claims, รอบส่ง)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={thureanSheetUrl}
                onChange={(e) => setThureanSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1QQcCxxnuHg9nmAQ-JHmTdIaC2kA-vnJEJpmOvWlgMb8/..."
                className="flex-1 border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono bg-white"
              />
              <a
                href={thureanSheetUrl || "https://docs.google.com/spreadsheets/d/1QQcCxxnuHg9nmAQ-JHmTdIaC2kA-vnJEJpmOvWlgMb8/edit?usp=sharing"}
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 inline-flex items-center gap-1.5 transition"
              >
                <span>เปิดชีต THUREAN</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">
              📘 2. User Sheet (สมาชิก, ข้อมูลคนลงทะเบียน, LINE User ID, ชื่อ-สกุล, ที่อยู่)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={userSheetUrl}
                onChange={(e) => setUserSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/16Np4KAWCGv9RGIrj3hAqUCeNK1EXjiHLXmBfg849yHQ/..."
                className="flex-1 border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono bg-white"
              />
              <a
                href={userSheetUrl || "https://docs.google.com/spreadsheets/d/16Np4KAWCGv9RGIrj3hAqUCeNK1EXjiHLXmBfg849yHQ/edit?usp=sharing"}
                target="_blank"
                rel="noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 inline-flex items-center gap-1.5 transition"
              >
                <span>เปิดชีต User</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        <hr className="border-stone-100" />

        <div className="space-y-4">
          <div className="border border-emerald-900/10 bg-emerald-50/50 rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#06C755]" />
              LINE Official Account & บ็อตแจ้งเตือน (Messaging API)
            </h3>
            <p className="text-xs text-stone-500">
              กำหนด LINE Official Account ของร้านคุณ และ LINE Admin ID ของคุณเพื่อรับแจ้งเตือนออเดอร์ใหม่โดยตรง ไม่ปนกับคนอื่น
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  LINE OA ID ของร้าน (เช่น @durianwinkin)
                </label>
                <input
                  type="text"
                  value={lineOaId}
                  onChange={(e) => setLineOaId(e.target.value)}
                  placeholder="@ชื่อร้านคุณ (สำหรับปุ่มแชท)"
                  className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  LINE Admin Group ID (กลุ่มไลน์แจ้งเตือนทีมงาน แยก 100%)
                </label>
                <input
                  type="text"
                  value={lineGroupId}
                  onChange={(e) => setLineGroupId(e.target.value)}
                  placeholder="c... (ดึงบอทเข้ากลุ่ม ระบบจะตรวจจับและผูกให้อัตโนมัติ)"
                  className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs font-mono"
                />
                <p className="text-[10px] text-emerald-700 mt-1">
                  💡 สร้างกลุ่ม LINE แล้วเชิญบอท @713imada เข้ากลุ่ม ระบบจะบันทึก Group ID ให้อัตโนมัติทันที
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  LINE Channel Access Token (Messaging API)
                </label>
                <input
                  type="password"
                  value={lineToken}
                  onChange={(e) => setLineToken(e.target.value)}
                  placeholder={
                    config?.hasLineToken
                      ? `บันทึกแล้ว (${config.lineTokenMasked})`
                      : "วาง Token บ็อตของคุณจาก LINE Developers"
                  }
                  className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <div className="border border-blue-900/10 bg-blue-50/50 rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              ระบบล็อกอินด้วย LINE (LINE Login v2.1 OAuth & LIFF)
            </h3>
            <p className="text-xs text-stone-500">
              สร้าง Channel ชนิด &quot;LINE Login&quot; บน LINE Developers Console เพื่อให้ลูกค้ากดปุ่มล็อกอินด้วย LINE ได้ทันทีโดยไม่ต้องจำรหัสผ่าน
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  LINE Login Channel ID
                </label>
                <input
                  type="text"
                  value={lineLoginChannelId}
                  onChange={(e) => setLineLoginChannelId(e.target.value)}
                  placeholder="เช่น 2001234567"
                  className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  LINE Login Channel Secret
                </label>
                <input
                  type="password"
                  value={lineLoginSecret}
                  onChange={(e) => setLineLoginSecret(e.target.value)}
                  placeholder={
                    config?.hasLineLoginSecret
                      ? `บันทึกแล้ว (${config.lineLoginSecretMasked})`
                      : "วาง Secret จากแท็บ Basic settings"
                  }
                  className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  LINE LIFF ID (เปิดเว็บในแอป LINE)
                </label>
                <input
                  type="text"
                  value={lineLiffId}
                  onChange={(e) => setLineLiffId(e.target.value)}
                  placeholder="เช่น 2001234567-AbCdEfGh"
                  className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs font-mono"
                />
              </div>
            </div>

            <div className="bg-white border border-stone-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-bold text-stone-800">Callback URL สำหรับตั้งใน LINE Developers Console:</span>
                <p className="font-mono text-blue-700 text-[11px] select-all mt-0.5">
                  {(publicBaseUrl || "https://durianwinkin.vercel.app").replace(/\/+$/, "")}/api/auth/line/callback
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const cb = `${(publicBaseUrl || "https://durianwinkin.vercel.app").replace(/\/+$/, "")}/api/auth/line/callback`;
                  navigator.clipboard.writeText(cb);
                  alert("คัดลอก Callback URL เรียบร้อยแล้ว!");
                }}
                className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg font-bold shrink-0 text-xs transition"
              >
                คัดลอก Callback URL
              </button>
            </div>
          </div>
        </div>

        <hr className="border-stone-100" />

        <div className="space-y-3">
          <h3 className="text-sm font-extrabold text-stone-900">
            ตั้งค่าเว็บสาธารณะ (QR PromptPay ใน LINE) &amp; ช่องทางไลฟ์สด
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Public HTTPS Base URL (โดเมนเว็บ / Cloudflare Tunnel)
              </label>
              <input
                type="url"
                value={publicBaseUrl}
                onChange={(e) => setPublicBaseUrl(e.target.value)}
                placeholder="https://xxx.trycloudflare.com หรือโดเมนเว็บจริง"
                className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                แพลตฟอร์มไลฟ์สด (TikTok / Facebook / YouTube)
              </label>
              <input
                type="text"
                value={livePlatform}
                onChange={(e) => setLivePlatform(e.target.value)}
                placeholder="เช่น TikTok @durianwinkin หรือ Facebook Live"
                className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                ลิงก์ห้องไลฟ์สด (เว้นว่างไว้ถ้ายังไม่เลือกแพลตฟอร์ม)
              </label>
              <input
                type="url"
                value={liveUrl}
                onChange={(e) => setLiveUrl(e.target.value)}
                placeholder="https://www.tiktok.com/@.../live"
                className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                ข้อความแจ้งลูกค้าตอนกดปุ่มดูไลฟ์สด
              </label>
              <input
                type="text"
                value={liveNote}
                onChange={(e) => setLiveNote(e.target.value)}
                placeholder="เช่น ไลฟ์คัดทุเรียนหน้าสวนทุกวัน 19:00 น."
                className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-rose-700">
            <input
              type="checkbox"
              checked={isLiveNow}
              onChange={(e) => setIsLiveNow(e.target.checked)}
              className="accent-rose-600"
            />
            <span>สถานะกำลังไลฟ์สดตอนนี้ (แสดงป้าย LIVE NOW ใน LINE)</span>
          </label>
        </div>

        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
          <div className="flex items-center gap-2 text-emerald-950 font-extrabold text-xs mb-1">
            <ShieldCheck className="w-4 h-4 text-[#06C755]" />
            <span>ความปลอดภัยหลังบ้าน: เข้าสู่ระบบผ่าน LINE เท่านั้น</span>
          </div>
          <p className="text-[11px] text-emerald-800 leading-relaxed">
            ระบบยกเลิกการใช้รหัส PIN แล้วเพื่อความปลอดภัย โดยอนุญาตเฉพาะบัญชี LINE ที่มีสิทธิ์แอดมิน (สามารถตั้งค่าบทบาทผู้ใช้เป็น admin ได้ในแท็บ &quot;สมาชิก&quot;)
          </p>
        </div>

        {statusMsg && (
          <div
            className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
              statusMsg.ok
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}
          >
            {statusMsg.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              callConfigApi({
                action: "save",
                googleSheetsWebAppUrl: webAppUrl,
                googleSheetViewUrl: thureanSheetUrl || sheetViewUrl,
                thureanSheetViewUrl: thureanSheetUrl,
                userSheetViewUrl: userSheetUrl,
                lineOaId: lineOaId,
                lineChannelAccessToken: lineToken || undefined,
                lineAdminUserId: lineAdminId,
                lineAdminGroupId: lineGroupId,
                lineLiffId: lineLiffId,
                lineLoginChannelId: lineLoginChannelId,
                lineLoginChannelSecret: lineLoginSecret || undefined,
                publicBaseUrl: publicBaseUrl,
                liveStreamPlatform: livePlatform,
                liveStreamUrl: liveUrl,
                liveStreamNote: liveNote,
                isLiveNow: isLiveNow,
              })
            }
            className="bg-[#1B4D31] hover:bg-[#143B25] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>บันทึกการตั้งค่า</span>
          </button>

          <button
            type="button"
            disabled={busy || !webAppUrl}
            onClick={() =>
              callConfigApi({ action: "test", googleSheetsWebAppUrl: webAppUrl })
            }
            className="bg-sky-600 hover:bg-sky-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Plug className="w-3.5 h-3.5" />
            <span>ทดสอบเชื่อมต่อชีต</span>
          </button>

          <button
            type="button"
            disabled={busy || !webAppUrl}
            onClick={() =>
              callConfigApi({ action: "setupSheets", googleSheetsWebAppUrl: webAppUrl })
            }
            className="bg-emerald-700 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50 inline-flex items-center gap-1.5 shadow-xs"
            title="อัปเกรดหัวตารางทุกชีตให้มี createDate, createdBy, isActive (0/1), updatedAt, updatedBy"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>ปรับโครงสร้างชีตใหม่ (เพิ่มคอลัมน์ Log & IsActive 0/1)</span>
          </button>

          <button
            type="button"
            disabled={busy || !webAppUrl}
            onClick={() => {
              if (
                window.confirm(
                  "⚠️ คำเตือน: คุณต้องการล้างแถวข้อมูลเดิมทั้งหมดใน Google Sheet ทั้ง 2 ไฟล์ แล้วสร้างโครงสร้างใหม่พร้อมคอลัมน์ Log หรือไม่?"
                )
              ) {
                callConfigApi({ action: "rebuildSheets", googleSheetsWebAppUrl: webAppUrl });
              }
            }}
            className="bg-rose-700 hover:bg-rose-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50 inline-flex items-center gap-1.5"
            title="ล้างข้อมูลแถวเดิมและสร้างชีตใหม่ทั้งหมด"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>ล้างและสร้างตารางใหม่ (Wipe &amp; Rebuild)</span>
          </button>

          <button
            type="button"
            disabled={busy || !webAppUrl}
            onClick={() =>
              callConfigApi({ action: "sync", googleSheetsWebAppUrl: webAppUrl })
            }
            className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-5 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>ส่งข้อมูลตั้งต้นลงชีต (1-Click Sync)</span>
          </button>

          <button
            type="button"
            disabled={busy || (!config?.hasLineToken && !lineToken)}
            onClick={handleDeployRichMenu}
            className="bg-[#06C755] hover:bg-[#05b34c] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <LineIcon className="w-3.5 h-3.5" />
            <span>ติดตั้งเมนู 6 ปุ่มใน LINE (Rich Menu)</span>
          </button>

          {sourceMode === "google-sheets" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => callConfigApi({ action: "disconnect" })}
              className="bg-stone-100 hover:bg-stone-200 text-stone-600 px-4 py-2.5 rounded-xl text-xs font-bold transition"
            >
              สลับกลับ Local Mode
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============== TAB 8: USERS (REGISTERED MEMBERS) ==============
function UsersTab({
  users,
  onRefresh,
}: {
  users: SafeUser[];
  onRefresh: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, newRole: "user" | "staff" | "admin") => {
    setUpdatingId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        alert(json.error || "ไม่สามารถเปลี่ยนสิทธิ์ได้");
      } else {
        onRefresh();
      }
    } catch {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleUserActive = async (u: SafeUser) => {
    const userId = (u as any).userId || u.id;
    setUpdatingId(userId);
    const currentActive = (u.isActive === 0 || (u.isActive as any) === "0" || u.isActive === false) ? 0 : 1;
    const nextVal = currentActive === 1 ? 0 : 1;
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, isActive: nextVal }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        alert(json.error || "ไม่สามารถเปลี่ยนสถานะได้");
      } else {
        onRefresh();
      }
    } catch {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      (u.username || "").toLowerCase().includes(term) ||
      (u.displayName || "").toLowerCase().includes(term) ||
      (u.lineUserId || "").toLowerCase().includes(term) ||
      (u.firstName || "").toLowerCase().includes(term) ||
      (u.lastName || "").toLowerCase().includes(term) ||
      (u.phone || "").includes(term) ||
      (u.address || "").toLowerCase().includes(term) ||
      (u.postalCode || "").includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-stone-900">
              รายชื่อสมาชิกที่ลงทะเบียน ({users.length} คน)
            </h3>
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-full">
              <Lock className="w-3 h-3 text-emerald-600" />
              Users Sheet (แท็บซ่อนปลอดภัย)
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            ข้อมูลสมาชิกที่ลงทะเบียนผ่านหน้าร้าน บันทึกลง Google Sheet อัตโนมัติ พร้อมเข้ารหัสความปลอดภัย
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="ค้นหาชื่อ, เบอร์, Username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-stone-300 rounded-xl px-3 py-2 text-xs bg-white focus:border-[#1B4D31] focus:outline-none w-56 sm:w-64"
          />
          <button
            onClick={onRefresh}
            className="p-2 border border-stone-300 rounded-xl hover:bg-stone-100 transition bg-white"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className="w-4 h-4 text-stone-700" />
          </button>
        </div>
      </div>

      {/* Cards summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-stone-500 font-semibold">สมาชิกทั้งหมด</p>
            <p className="text-xl font-black text-[#1B4D31]">{users.length} คน</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-stone-500 font-semibold">สมาชิกล่าสุด</p>
            <p className="text-xs font-bold text-stone-900 truncate max-w-[150px]">
              {users.length > 0
                ? `${users[0].firstName} ${users[0].lastName}`
                : "ยังไม่มีสมาชิก"}
            </p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-800">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-stone-500 font-semibold">การป้องกันข้อมูล</p>
            <p className="text-xs font-bold text-stone-900">
              Scrypt Hash + แท็บชีตซ่อน
            </p>
          </div>
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1B4D31] text-white">
              <tr>
                <th className="py-3 px-4 font-bold">โปรไฟล์</th>
                <th className="py-3 px-4 font-bold">User ID &amp; ชื่อ</th>
                <th className="py-3 px-4 font-bold">เบอร์โทรศัพท์</th>
                <th className="py-3 px-4 font-bold">ที่อยู่จัดส่ง &amp; รหัสไปรษณีย์</th>
                <th className="py-3 px-4 font-bold text-center">ออเดอร์ (JOIN)</th>
                <th className="py-3 px-4 font-bold">Log (สร้างเมื่อ / โดย)</th>
                <th className="py-3 px-4 font-bold text-center">สถานะ (Is Active)</th>
                <th className="py-3 px-4 font-bold text-center">สิทธิ์ (Role)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">
                    <User className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold">ไม่พบข้อมูลสมาชิก</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      {searchTerm ? "ลองค้นหาด้วยคำอื่น" : "ยังไม่มีผู้ใช้งานลงทะเบียนในระบบ"}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-stone-50/80 transition">
                    <td className="py-3 px-4">
                      {u.avatarUrl ? (
                        <img
                          src={u.avatarUrl}
                          alt={u.firstName}
                          className="w-9 h-9 rounded-full object-cover border border-stone-200 bg-white"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#1B4D31] text-amber-300 flex items-center justify-center font-black text-xs">
                          {u.firstName ? u.firstName.charAt(0) : "U"}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {u.lineUserId ? (
                          <span className="inline-flex items-center gap-0.5 bg-[#06C755]/10 text-[#06C755] font-extrabold text-[10px] px-1.5 py-0.5 rounded border border-[#06C755]/30">
                            LINE
                          </span>
                        ) : null}
                        <span className="font-mono font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 text-[11px]">
                          {(u as any).userId || u.id}
                        </span>
                        {u.role === "admin" && (
                          <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                            ADMIN
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-stone-900 mt-1">
                        {u.firstName} {u.lastName}
                        {u.displayName && u.displayName !== u.firstName && (
                          <span className="text-[11px] text-stone-400 font-normal ml-1">
                            ({u.displayName})
                          </span>
                        )}
                      </div>
                      {u.source && (
                        <span className="text-[10px] text-stone-400 block font-sans">
                          {u.source === "line-chat"
                            ? "💬 แชท LINE OA"
                            : u.source === "line-login"
                            ? "🟢 LINE Login"
                            : u.source}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-emerald-800">
                      {u.phone}
                    </td>
                    <td className="py-3 px-4 text-stone-600 max-w-xs truncate" title={`${u.address} ${u.postalCode}`}>
                      {u.address} <span className="font-mono font-bold text-stone-800">{u.postalCode}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-[#1B4D31] font-bold text-xs px-2.5 py-1 rounded-full border border-emerald-200">
                        <ShoppingBag className="w-3 h-3 text-emerald-600" />
                        <span>{(u as any).orderCount || 0} รายการ</span>
                      </span>
                      {Number((u as any).totalSpent || 0) > 0 && (
                        <span className="block text-[10px] text-stone-500 font-mono mt-0.5">
                          ฿{((u as any).totalSpent || 0).toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-stone-500 font-mono text-[11px]">
                      <div>{u.createDate || u.createdAt ? new Date(u.createDate || u.createdAt).toLocaleDateString("th-TH") : "-"}</div>
                      <div className="text-[10px] text-stone-400">โดย: {(u as any).createdBy || u.source || "line"}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleUserActive(u)}
                        disabled={updatingId === u.id || updatingId === (u as any).userId}
                        title="คลิกสลับสถานะ Is Active (1 = ใช้งาน, 0 = ปิดใช้งาน)"
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition inline-flex items-center gap-1 ${
                          (u.isActive === 0 || (u.isActive as any) === "0" || u.isActive === false)
                            ? "bg-stone-100 text-stone-500 border-stone-300 hover:bg-stone-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            (u.isActive === 0 || (u.isActive as any) === "0" || u.isActive === false)
                              ? "bg-stone-400"
                              : "bg-emerald-500"
                          }`}
                        />
                        <span>
                          {(u.isActive === 0 || (u.isActive as any) === "0" || u.isActive === false)
                            ? "ปิด (0)"
                            : "ใช้งาน (1)"}
                        </span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <select
                        value={u.role || "user"}
                        disabled={updatingId === u.id}
                        onChange={(e) =>
                          handleRoleChange(
                            (u as any).userId || u.id,
                            e.target.value as "user" | "staff" | "admin"
                          )
                        }
                        className={`text-[11px] font-bold rounded-lg px-2.5 py-1.5 border transition cursor-pointer ${
                          u.role === "admin"
                            ? "bg-amber-100 text-amber-900 border-amber-300 font-extrabold shadow-xs"
                            : "bg-stone-50 text-stone-700 border-stone-200"
                        }`}
                      >
                        <option value="user">👤 ลูกค้า</option>
                        <option value="staff">🧑‍🔧 พนักงาน (ชั่ง/สลิป/ส่งของ)</option>
                        <option value="admin">🛡️ เจ้าของร้าน (ทุกอย่าง)</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============== MAIN ADMIN PAGE ==============
export default function AdminPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [role, setRole] = useState<"admin" | "staff" | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

  const [sourceMode, setSourceMode] = useState<"google-sheets" | "local">(
    "local"
  );
  const [warning, setWarning] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [lots, setLots] = useState<LotCost[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const loadAllAdminData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [shopRes, ordRes, rndRes, lotRes, clmRes, usrRes] = await Promise.all([
        fetch("/api/shop"),
        fetch("/api/orders"),
        fetch("/api/rounds"),
        fetch("/api/lots"),
        fetch("/api/claims"),
        fetch("/api/admin/users"),
      ]);

      const shopJson = await shopRes.json();
      const ordJson = await ordRes.json();
      const rndJson = await rndRes.json();
      const lotJson = await lotRes.json();
      const clmJson = await clmRes.json();
      const usrJson = await usrRes.json().catch(() => ({ ok: false }));

      if (shopJson.ok) {
        setProducts(shopJson.products || []);
        setSourceMode(shopJson.source || "local");
        setWarning(shopJson.warning || null);
      }
      if (ordJson.ok) setOrders(ordJson.orders || []);
      if (rndJson.ok) setRounds(rndJson.rounds || []);
      if (lotJson.ok) setLots(lotJson.lots || []);
      if (clmJson.ok) setClaims(clmJson.claims || []);
      if (usrJson.ok) setUsers(usrJson.users || []);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin/auth")
      .then((r) => r.json())
      .then((json) => {
        setAuthenticated(Boolean(json.authenticated));
        setRole(json.role === "admin" || json.role === "staff" ? json.role : null);
        // พนักงานเริ่มที่หน้าออเดอร์ (ไม่เห็นภาพรวมยอดขาย/ต้นทุน)
        if (json.role === "staff") setActiveTab("orders");
        setAuthChecked(true);
        if (json.authenticated) {
          loadAllAdminData();
        }
      })
      .catch(() => setAuthChecked(true));
  }, [loadAllAdminData]);

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    setAuthenticated(false);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#F8F7F3] flex items-center justify-center text-sm font-bold text-stone-500">
        กำลังตรวจสอบสิทธิ์...
      </div>
    );
  }

  if (!authenticated) {
    return <AdminLoginScreen />;
  }

  // พนักงาน: ออเดอร์ + เคลม / เจ้าของร้าน: ทุกแท็บ (API ตรวจสิทธิ์ซ้ำอีกชั้น)
  const allowedTabs: TabId[] =
    role === "admin"
      ? ["dashboard", "orders", "products", "lots", "claims", "users", "summary", "settings"]
      : ["orders", "claims"];
  const pendingPayments = orders.filter(
    (o) => o.paymentStatus === "pending"
  ).length;
  const pendingClaims = claims.filter((c) => c.status === "pending").length;

  return (
    <div className="min-h-screen bg-[#F8F7F3]">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sourceMode={sourceMode}
        pendingClaims={pendingClaims}
        pendingPayments={pendingPayments}
        onLogout={handleLogout}
        allowedTabs={allowedTabs}
      />

      <div className="md:ml-64 pb-24 md:pb-10">
        {/* Top bar */}
        <header className="bg-white border-b border-stone-200 px-4 md:px-6 py-4 sticky top-0 z-30 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={shopInfo.logo}
                alt={shopInfo.name}
                className="md:hidden w-9 h-9 rounded-full border border-stone-200 bg-white object-cover"
              />
              <div>
                <h1 className="font-extrabold text-stone-900 text-sm sm:text-base">
                  หลังบ้าน {shopInfo.name}
                </h1>
                <p className="text-[11px] text-stone-400">
                  {new Date().toLocaleDateString("th-TH", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadAllAdminData}
                disabled={loadingData}
                className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-3.5 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loadingData ? "animate-spin" : ""}`}
                />
                <span>{loadingData ? "กำลังโหลด..." : "รีเฟรชข้อมูล"}</span>
              </button>
            </div>
          </div>
        </header>

        {warning && (
          <div className="mx-4 md:mx-6 mt-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold p-3 rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{warning}</span>
          </div>
        )}

        <div className="p-4 md:p-6">
          {activeTab === "dashboard" && (
            <DashboardTab
              orders={orders}
              products={products}
              lots={lots}
              rounds={rounds}
              claims={claims}
              onGoToTab={setActiveTab}
            />
          )}
          {activeTab === "orders" && (
            <OrdersTab
              orders={orders}
              lots={lots}
              products={products}
              rounds={rounds}
              users={users}
              claims={claims}
              onGoToTab={setActiveTab}
              onOrderUpdated={(updated) =>
                setOrders((prev) =>
                  prev.map((o) => (o.id === updated.id ? updated : o))
                )
              }
              onOrderCreated={(newOrder) =>
                setOrders((prev) => [newOrder, ...prev])
              }
            />
          )}
          {activeTab === "products" && (
            <ProductsTab
              products={products}
              onProductUpdated={(updated) =>
                setProducts((prev) =>
                  prev.map((p) => (p.id === updated.id ? updated : p))
                )
              }
              onProductCreated={(created) =>
                setProducts((prev) => [...prev, created])
              }
            />
          )}
          {activeTab === "lots" && (
            <LotsAndRoundsTab
              rounds={rounds}
              lots={lots}
              onLotCreated={(lot) => setLots((prev) => [lot, ...prev])}
              onRoundCreated={(round) => setRounds((prev) => [round, ...prev])}
              onRoundUpdated={(updated) =>
                setRounds((prev) =>
                  prev.map((r) => (r.id === updated.id ? updated : r))
                )
              }
            />
          )}
          {activeTab === "claims" && (
            <ClaimsTab
              claims={claims}
              lots={lots}
              onClaimUpdated={(updated) =>
                setClaims((prev) =>
                  prev.map((c) => (c.claimId === updated.claimId ? updated : c))
                )
              }
            />
          )}
          {activeTab === "users" && (
            <UsersTab
              users={users}
              onRefresh={loadAllAdminData}
            />
          )}
          {activeTab === "summary" && <SummaryTab orders={orders} lots={lots} />}
          {activeTab === "settings" && (
            <SettingsTab
              sourceMode={sourceMode}
              onConfigChanged={loadAllAdminData}
            />
          )}
        </div>
      </div>
    </div>
  );
}
