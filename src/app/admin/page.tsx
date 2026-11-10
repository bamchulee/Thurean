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
  Package,
  Plug,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sprout,
  TrendingUp,
  Truck,
  Unlock,
  UploadCloud,
  User,
  XCircle,
} from "lucide-react";
import { shopInfo } from "../../data/mock";
import { ShippingLabelModal } from "../../components/ShippingLabelModal";
import type {
  Claim,
  ClaimStatus,
  LotCost,
  Order,
  OrderStatus,
  Product,
  Round,
} from "../../types/durian";

// ============== STATUS HELPERS ==============
const paymentStatusLabel: Record<string, { text: string; color: string }> = {
  pending: {
    text: "รอตรวจสลิป",
    color: "bg-amber-50 text-amber-800 border border-amber-200",
  },
  confirmed: {
    text: "ชำระแล้ว",
    color: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  },
  refunded: {
    text: "คืนเงินแล้ว",
    color: "bg-rose-50 text-rose-700 border border-rose-200",
  },
};

const orderStatusLabel: Record<string, { text: string; color: string }> = {
  received: {
    text: "รับออเดอร์",
    color: "bg-sky-50 text-sky-800 border border-sky-200",
  },
  preparing: {
    text: "คัดของจากสวน",
    color: "bg-amber-50 text-amber-800 border border-amber-200",
  },
  packed: {
    text: "แพ็กเสร็จ",
    color: "bg-teal-50 text-teal-800 border border-teal-200",
  },
  shipped: {
    text: "จัดส่งแล้ว",
    color: "bg-indigo-50 text-indigo-800 border border-indigo-200",
  },
  delivered: {
    text: "สำเร็จ",
    color: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  },
  claimed: {
    text: "แจ้งเคลม",
    color: "bg-rose-50 text-rose-700 border border-rose-200",
  },
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
  | "summary"
  | "settings";

interface ConfigInfo {
  googleSheetsWebAppUrl: string;
  googleSheetViewUrl: string;
  hasLineToken: boolean;
  lineTokenMasked: string;
  lineAdminUserId: string;
  lineLiffId: string;
  lastSyncedAt: string | null;
}

// ============== LOGIN SCREEN ==============
function PinLoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (res.ok && json.ok) {
        onSuccess();
      } else {
        setError(json.error || "รหัส PIN ไม่ถูกต้อง");
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#11301F] flex items-center justify-center p-4">
      <form
        onSubmit={handleLogin}
        className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-stone-200 text-center space-y-5"
      >
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

        <div>
          <label className="block text-xs font-bold text-stone-700 mb-2">
            กรอกรหัส PIN เข้าสู่ระบบ
          </label>
          <input
            type="password"
            inputMode="numeric"
            required
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            className="w-full text-center text-2xl tracking-[0.5em] font-mono border border-stone-300 rounded-2xl py-3 focus:border-[#1B4D31] focus:outline-none"
          />
          <p className="text-[11px] text-stone-400 mt-2">
            รหัสเริ่มต้น:{" "}
            <code className="bg-stone-100 px-1.5 py-0.5 rounded font-bold text-stone-700">
              2824
            </code>{" "}
            (เปลี่ยนได้ในตั้งค่า)
          </p>
        </div>

        {error && (
          <p className="text-xs text-rose-700 font-semibold bg-rose-50 border border-rose-200 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#1B4D31] hover:bg-[#143B25] text-white font-bold py-3.5 rounded-xl text-sm transition shadow-md disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          <Unlock className="w-4 h-4 text-amber-300" />
          <span>{loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบหลังบ้าน"}</span>
        </button>

        <a
          href="/"
          className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 pt-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>กลับไปหน้าร้านค้า</span>
        </a>
      </form>
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
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  sourceMode: "google-sheets" | "local";
  pendingClaims: number;
  pendingPayments: number;
  onLogout: () => void;
}) {
  const tabs: {
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
    { id: "summary", icon: TrendingUp, label: "กำไร-ขาดทุน" },
    { id: "settings", icon: Link2, label: "เชื่อม Google Sheet" },
  ];

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
  const totalSales = orders.reduce((s, o) => s + o.totalPrice, 0);
  const totalCost = lots.reduce(
    (s, l) => s + l.totalFruitCost + l.packagingCost + l.truckFuelCost,
    0
  );
  const netProfit = totalSales - totalCost;
  const pendingPayments = orders.filter((o) => o.paymentStatus === "pending").length;
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

// ============== TAB 2: ORDERS ==============
function OrdersTab({
  orders,
  lots,
  onOrderUpdated,
}: {
  orders: Order[];
  lots: LotCost[];
  onOrderUpdated: (updated: Order) => void;
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [labelOrder, setLabelOrder] = useState<Order | null>(null);
  const [trackInput, setTrackInput] = useState("");
  const [lotInput, setLotInput] = useState("");
  const [nextStatus, setNextStatus] = useState<OrderStatus>("shipped");
  const [notifyLine, setNotifyLine] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const filtered =
    statusFilter === "all"
      ? orders
      : orders.filter((o) => o.orderStatus === statusFilter);

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
      const json = (await res.json()) as { ok: boolean; order?: Order };
      if (res.ok && json.ok && json.order) {
        onOrderUpdated(json.order);
      }
    } finally {
      setSavingId(null);
    }
  };

  const openTrackingModal = (order: Order) => {
    setEditingOrder(order);
    setTrackInput(order.trackingNo || "");
    setLotInput(order.lotId || lots[0]?.lotId || "");
    setNextStatus(
      order.orderStatus === "received" || order.orderStatus === "preparing"
        ? "shipped"
        : order.orderStatus
    );
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    await patchOrder(editingOrder.id, {
      orderStatus: nextStatus,
      trackingNo: trackInput,
      lotId: lotInput,
      notifyLine,
    });
    setEditingOrder(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-extrabold text-stone-900">
          คำสั่งซื้อ ({filtered.length})
        </h2>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {["all", "received", "preparing", "packed", "shipped", "delivered", "claimed"].map(
            (s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  statusFilter === s
                    ? "bg-[#1B4D31] text-white"
                    : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
                }`}
              >
                {s === "all" ? "ทั้งหมด" : orderStatusLabel[s]?.text || s}
              </button>
            )
          )}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((order) => (
          <div
            key={order.id}
            className="bg-white rounded-2xl shadow-xs border border-stone-200 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-extrabold text-stone-900 font-mono text-base">
                    {order.id}
                  </span>
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                      paymentStatusLabel[order.paymentStatus]?.color || "bg-stone-100"
                    }`}
                  >
                    {paymentStatusLabel[order.paymentStatus]?.text || order.paymentStatus}
                  </span>
                  {order.lotId && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 font-mono font-bold">
                      ล็อต: {order.lotId}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-400">
                  {new Date(order.createdAt).toLocaleString("th-TH")}
                </p>
              </div>
              <span
                className={`text-xs px-3 py-1 rounded-full font-bold ${
                  orderStatusLabel[order.orderStatus]?.color || "bg-stone-100"
                }`}
              >
                {orderStatusLabel[order.orderStatus]?.text || order.orderStatus}
              </span>
            </div>

            <div className="bg-stone-50 rounded-xl p-3.5 mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-stone-100">
              <div>
                <p className="font-bold text-sm text-stone-900 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-stone-400" />
                  <span>{order.customerName}</span>
                  <span className="text-xs font-mono text-stone-500">
                    ({order.phone})
                  </span>
                </p>
                {order.address && (
                  <p className="text-xs text-stone-500 mt-1 flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                    <span>{order.address}</span>
                  </p>
                )}
                {order.ripenessPref && (
                  <p className="text-xs text-amber-800 font-semibold mt-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>สเปกความสุก: {order.ripenessPref}</span>
                  </p>
                )}
              </div>
              <p className="text-xl font-extrabold text-[#1B4D31] shrink-0">
                ฿{(order.totalPrice + order.shippingCost).toLocaleString()}
              </p>
            </div>

            <div className="space-y-1 mb-3 text-xs">
              {order.items.map((it, i) => (
                <div key={i} className="flex justify-between text-stone-700 font-medium">
                  <span>
                    {it.productName} <strong>x{it.qty}</strong>
                  </span>
                  <span className="font-mono">฿{(it.price * it.qty).toLocaleString()}</span>
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

            {order.trackingNo && (
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-2.5 text-xs text-sky-900 mb-3 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" />
                <span>
                  เลขพัสดุ: <strong className="font-mono">{order.trackingNo}</strong>
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-3 border-t border-stone-100">
              {order.paymentStatus === "pending" && (
                <button
                  disabled={savingId === order.id}
                  onClick={() =>
                    patchOrder(order.id, {
                      paymentStatus: "confirmed",
                      orderStatus: "preparing",
                      notifyLine: true,
                    })
                  }
                  className="bg-[#1B4D31] hover:bg-[#143B25] text-white px-4 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>ยืนยันสลิป + ส่งคัดของ</span>
                </button>
              )}
              <button
                disabled={savingId === order.id}
                onClick={() => openTrackingModal(order)}
                className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-4 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>อัปเดตสถานะ / ใส่ Tracking &amp; ล็อต</span>
              </button>
              <button
                onClick={() => setLabelOrder(order)}
                className="bg-stone-100 hover:bg-stone-200 text-stone-800 px-4 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>พิมพ์ใบปะหน้ากล่อง</span>
              </button>
            </div>
          </div>
        ))}
      </div>

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
                สถานะการจัดส่ง
              </label>
              <select
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as OrderStatus)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold"
              >
                <option value="received">รับออเดอร์</option>
                <option value="preparing">กำลังคัดของจากสวน</option>
                <option value="packed">แพ็กเสร็จแล้ว</option>
                <option value="shipped">จัดส่งแล้ว</option>
                <option value="delivered">ส่งสำเร็จแล้ว</option>
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
                placeholder="เช่น FL123456789TH"
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
              <span>ส่งแจ้งเตือน Flex Message หาลูกค้าผ่าน LINE (ถ้ามี LINE ID)</span>
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
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [variety, setVariety] = useState("หมอนทอง");
  const [type, setType] = useState<"whole" | "flesh">("whole");
  const [weight, setWeight] = useState("3.0 - 3.5 กก.");
  const [price, setPrice] = useState("890");
  const [origin, setOrigin] = useState("สวนระยองแท้");
  const [saving, setSaving] = useState(false);

  const toggleAvailability = async (p: Product) => {
    const res = await fetch(`/api/products/${encodeURIComponent(p.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable: !p.isAvailable }),
    });
    const json = (await res.json()) as { ok: boolean; product?: Product };
    if (res.ok && json.ok && json.product) {
      onProductUpdated(json.product);
    }
  };

  const handleEditPrice = async (p: Product) => {
    const input = window.prompt(
      `แก้ไขราคาของ "${p.name}" (บาท):`,
      String(p.price)
    );
    if (!input) return;
    const nextPrice = Number(input);
    if (!nextPrice || nextPrice <= 0) return;

    const res = await fetch(`/api/products/${encodeURIComponent(p.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: nextPrice }),
    });
    const json = (await res.json()) as { ok: boolean; product?: Product };
    if (res.ok && json.ok && json.product) {
      onProductUpdated(json.product);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          variety,
          type,
          weight,
          price: Number(price),
          unit: type === "flesh" ? "กล่อง" : "ลูก",
          origin,
        }),
      });
      const json = (await res.json()) as { ok: boolean; product?: Product };
      if (res.ok && json.ok && json.product) {
        onProductCreated(json.product);
        setShowAdd(false);
        setName("");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-stone-900">
          จัดการเมนูทุเรียน ({products.length})
        </h2>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-[#1B4D31] hover:bg-[#143B25] text-white px-4 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มสินค้าใหม่</span>
        </button>
      </div>

      <div className="grid gap-3">
        {products.map((p) => (
          <div
            key={p.id}
            className="bg-white rounded-2xl shadow-xs border border-stone-200 p-4 flex flex-col sm:flex-row sm:items-center gap-4"
          >
            <img
              src={p.image}
              alt={p.name}
              className="w-16 h-16 rounded-xl object-cover shrink-0 bg-stone-100 border border-stone-200"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-mono bg-stone-100 px-1.5 py-0.5 rounded font-bold text-stone-600">
                  {p.id}
                </span>
                <h3 className="font-bold text-sm text-stone-900 truncate">
                  {p.name}
                </h3>
              </div>
              <p className="text-xs text-stone-500">
                {p.variety} • {p.weight} • {p.origin}
              </p>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
              <button
                onClick={() => handleEditPrice(p)}
                className="text-right hover:bg-stone-50 px-2.5 py-1 rounded-xl transition"
                title="คลิกเพื่อแก้ราคา"
              >
                <p className="font-extrabold text-[#1B4D31] text-base">
                  ฿{p.price.toLocaleString()}
                </p>
                <p className="text-[10px] text-stone-400 underline">แก้ราคา</p>
              </button>

              <button
                onClick={() => toggleAvailability(p)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition inline-flex items-center gap-1.5 border ${
                  p.isAvailable
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                    : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                }`}
              >
                {p.isAvailable ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>เปิดขายอยู่</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>ปิดขาย (หมด)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowAdd(false)}
        >
          <form
            onSubmit={handleAddProduct}
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md rounded-2xl p-6 space-y-3 shadow-2xl border border-stone-200"
          >
            <h3 className="font-extrabold text-lg text-stone-900">
              เพิ่มรายการทุเรียนใหม่
            </h3>

            <div>
              <label className="block text-xs font-bold mb-1">ชื่อสินค้า *</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น หมอนทองจันทบุรี เกรดคัดพิเศษ"
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">สายพันธุ์ *</label>
                <input
                  required
                  value={variety}
                  onChange={(e) => setVariety(e.target.value)}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">รูปแบบ</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as "whole" | "flesh")}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
                >
                  <option value="whole">ชั่งทั้งลูก</option>
                  <option value="flesh">แกะเนื้อพร้อมทาน</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">น้ำหนัก *</label>
                <input
                  required
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">ราคาขาย (บาท) *</label>
                <input
                  type="number"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">แหล่งที่มา / สวน</label>
              <input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-[#1B4D31] text-white font-bold py-2.5 rounded-xl text-xs"
              >
                {saving ? "กำลังบันทึก..." : "เพิ่มสินค้า"}
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
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
  const [lineToken, setLineToken] = useState("");
  const [lineAdminId, setLineAdminId] = useState("");
  const [lineLiffId, setLineLiffId] = useState("");
  const [newPin, setNewPin] = useState("");
  const [statusMsg, setStatusMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          setConfig(json.config);
          setWebAppUrl(json.config.googleSheetsWebAppUrl || "");
          setSheetViewUrl(json.config.googleSheetViewUrl || "");
          setLineAdminId(json.config.lineAdminUserId || "");
          setLineLiffId(json.config.lineLiffId || "");
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
                  <span>คัดลอกโค้ด Code.gs แล้ว</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>คัดลอกโค้ด Code.gs</span>
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
            ลบโค้ดเดิมออกทั้งหมด แล้วกดปุ่ม{" "}
            <strong className="text-amber-300">&quot;คัดลอกโค้ด Code.gs&quot;</strong>{" "}
            ด้านบนมาวาง แล้วกดบันทึก (Ctrl+S)
          </li>
          <li>
            เลือกฟังก์ชันชื่อ{" "}
            <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-300">
              setupDurianWinkinSheets
            </code>{" "}
            ด้านบน แล้วกด <strong>Run (เรียกใช้)</strong> 1 ครั้ง — ระบบจะสร้าง 6 แท็บ (
            <code className="text-amber-200">
              Products, Rounds, Orders, Lots_Cost, Claims, Summary
            </code>
            ) พร้อมสูตรกำไรให้อัตโนมัติ
          </li>
          <li>
            กดปุ่ม{" "}
            <strong className="text-white">
              Deploy → New deployment → Type: Web app
            </strong>{" "}
            ตั้งค่า <em>Who has access: Anyone</em> แล้วนำ{" "}
            <strong>Web app URL</strong> (ขึ้นต้นด้วย{" "}
            <code className="text-amber-200">https://script.google.com/...</code>)
            มาวางช่องด้านล่างนี้ได้เลยครับ
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

        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1">
            ลิงก์ Google Sheet (เผื่อไว้กดเปิดดูตารางเร็ว ๆ)
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={sheetViewUrl}
              onChange={(e) => setSheetViewUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="flex-1 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs font-mono"
            />
            {sheetViewUrl && (
              <a
                href={sheetViewUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-50 text-[#1B4D31] border border-emerald-200 px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 inline-flex items-center gap-1"
              >
                <span>เปิดชีต</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        <hr className="border-stone-100" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              LINE Channel Access Token
            </label>
            <input
              type="password"
              value={lineToken}
              onChange={(e) => setLineToken(e.target.value)}
              placeholder={
                config?.hasLineToken
                  ? `บันทึกแล้ว (${config.lineTokenMasked})`
                  : "วาง Token จาก LINE Developers"
              }
              className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              LINE Admin User ID (รับแจ้งเตือน)
            </label>
            <input
              type="text"
              value={lineAdminId}
              onChange={(e) => setLineAdminId(e.target.value)}
              placeholder="U1234... (พิมพ์ myid ในแชท Bot)"
              className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              LINE LIFF ID (เปิดร้านในแอป LINE)
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

        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1">
            เปลี่ยนรหัส PIN เข้าหลังบ้าน (เว้นว่างถ้าไม่เปลี่ยน)
          </label>
          <input
            type="password"
            inputMode="numeric"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            placeholder="อย่างน้อย 4 หลัก"
            className="w-full sm:w-64 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs font-mono"
          />
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
                googleSheetViewUrl: sheetViewUrl,
                lineChannelAccessToken: lineToken || undefined,
                lineAdminUserId: lineAdminId,
                lineLiffId: lineLiffId,
                adminPin: newPin || undefined,
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
              callConfigApi({ action: "sync", googleSheetsWebAppUrl: webAppUrl })
            }
            className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-5 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>ส่งข้อมูลตั้งต้นลงชีต (1-Click Sync)</span>
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

// ============== MAIN ADMIN PAGE ==============
export default function AdminPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
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
  const [loadingData, setLoadingData] = useState(false);

  const loadAllAdminData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [shopRes, ordRes, rndRes, lotRes, clmRes] = await Promise.all([
        fetch("/api/shop"),
        fetch("/api/orders"),
        fetch("/api/rounds"),
        fetch("/api/lots"),
        fetch("/api/claims"),
      ]);

      const shopJson = await shopRes.json();
      const ordJson = await ordRes.json();
      const rndJson = await rndRes.json();
      const lotJson = await lotRes.json();
      const clmJson = await clmRes.json();

      if (shopJson.ok) {
        setProducts(shopJson.products || []);
        setSourceMode(shopJson.source || "local");
        setWarning(shopJson.warning || null);
      }
      if (ordJson.ok) setOrders(ordJson.orders || []);
      if (rndJson.ok) setRounds(rndJson.rounds || []);
      if (lotJson.ok) setLots(lotJson.lots || []);
      if (clmJson.ok) setClaims(clmJson.claims || []);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin/auth")
      .then((r) => r.json())
      .then((json) => {
        setAuthenticated(Boolean(json.authenticated));
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
    return (
      <PinLoginScreen
        onSuccess={() => {
          setAuthenticated(true);
          loadAllAdminData();
        }}
      />
    );
  }

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
              onOrderUpdated={(updated) =>
                setOrders((prev) =>
                  prev.map((o) => (o.id === updated.id ? updated : o))
                )
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
