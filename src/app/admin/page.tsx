"use client";

import { useState } from "react";
import { sampleOrders, currentRound, products, shopInfo } from "../../data/mock";
import type { Order } from "../../data/mock";

// ============== MOCK DATA for Admin ==============
const mockOrders: Order[] = [
  ...sampleOrders,
  {
    id: "ORD-1002",
    createdAt: "2026-11-09T11:15:00",
    roundId: "R2026-11-A",
    customerName: "คุณสมหญิง",
    phone: "089-876-5432",
    items: [
      { productId: "D03", productName: "ก้านยาว จันทบุรี", qty: 1, price: 490 },
    ],
    totalPrice: 490,
    shippingMethod: "Kerry Express",
    shippingCost: 70,
    paymentStatus: "pending",
    orderStatus: "received",
  },
  {
    id: "ORD-1003",
    createdAt: "2026-11-09T14:00:00",
    roundId: "R2026-11-A",
    customerName: "คุณวิชัย",
    phone: "062-111-2222",
    items: [
      { productId: "D01", productName: "หมอนทอง ระยอง เกรดพรีเมียม", qty: 3, price: 590 },
      { productId: "D06", productName: "ชะนี คัดพิเศษ", qty: 2, price: 390 },
    ],
    totalPrice: 2550,
    shippingMethod: "Flash Express (ส่งด่วน 1-2 วัน)",
    shippingCost: 80,
    paymentStatus: "confirmed",
    orderStatus: "preparing",
    trackingNo: "TH20261109A003",
  },
  {
    id: "ORD-1004",
    createdAt: "2026-11-08T09:30:00",
    roundId: "R2026-11-A",
    customerName: "คุณนภา",
    phone: "095-333-4444",
    items: [
      { productId: "D04", productName: "พวงมณี นนทบุรี", qty: 1, price: 890 },
    ],
    totalPrice: 890,
    shippingMethod: "ไปรษณีย์ไทย EMS",
    shippingCost: 60,
    paymentStatus: "confirmed",
    orderStatus: "shipped",
    trackingNo: "EMS1234567890TH",
  },
];

// ============== STATUS HELPERS ==============
const paymentStatusLabel: Record<string, { text: string; color: string }> = {
  pending: { text: "⏳ รอตรวจสลิป", color: "bg-yellow-100 text-yellow-800" },
  confirmed: { text: "✅ ชำระแล้ว", color: "bg-green-100 text-green-800" },
  refunded: { text: "↩️ คืนเงิน", color: "bg-red-100 text-red-800" },
};

const orderStatusLabel: Record<string, { text: string; color: string }> = {
  received: { text: "📥 รับออเดอร์", color: "bg-blue-100 text-blue-800" },
  preparing: { text: "📦 กำลังจัดของ", color: "bg-orange-100 text-orange-800" },
  packed: { text: "✅ แพ็กเสร็จ", color: "bg-teal-100 text-teal-800" },
  shipped: { text: "🚚 จัดส่งแล้ว", color: "bg-purple-100 text-purple-800" },
  delivered: { text: "🎉 สำเร็จ", color: "bg-green-100 text-green-800" },
  claimed: { text: "⚠️ เคลม", color: "bg-red-100 text-red-800" },
};

// ============== COMPONENTS ==============

function Sidebar({
  activeTab,
  onTabChange,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const tabs = [
    { id: "dashboard", icon: "📊", label: "ภาพรวม" },
    { id: "orders", icon: "📋", label: "คำสั่งซื้อ" },
    { id: "products", icon: "🍈", label: "สินค้า" },
    { id: "rounds", icon: "📅", label: "รอบจัดส่ง" },
    { id: "summary", icon: "💰", label: "สรุปยอด" },
  ];

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-[#1b4d1c] text-white min-h-screen fixed left-0 top-0">
        <div className="p-4 border-b border-green-700">
          <div className="flex items-center gap-3">
            <img src={shopInfo.logo} alt={shopInfo.name} className="w-10 h-10 rounded-full border border-yellow-400 bg-white object-cover" />
            <div>
              <h1 className="font-bold text-sm">{shopInfo.name}</h1>
              <p className="text-[10px] text-green-300 font-mono">{shopInfo.phone}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                activeTab === t.id
                  ? "bg-green-600 text-white shadow-md"
                  : "text-green-200 hover:bg-green-800/50"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-green-700">
          <a
            href="/"
            className="flex items-center gap-2 text-green-300 text-xs hover:text-white transition"
          >
            🌐 ดูหน้าเว็บร้าน →
          </a>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`flex-1 flex flex-col items-center py-2 text-[10px] font-medium transition ${
              activeTab === t.id ? "text-green-700" : "text-gray-400"
            }`}
          >
            <span className="text-lg mb-0.5">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-5 hover:shadow-lg transition">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center text-lg`}>
          {icon}
        </div>
        <span className="text-sm text-gray-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-extrabold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function DashboardTab() {
  const totalRevenue = mockOrders.reduce((s, o) => s + o.totalPrice + o.shippingCost, 0);
  const confirmedOrders = mockOrders.filter((o) => o.paymentStatus === "confirmed").length;
  const pendingOrders = mockOrders.filter((o) => o.paymentStatus === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-gray-800 mb-1">📊 ภาพรวมรอบปัจจุบัน</h2>
        <p className="text-sm text-gray-500">{currentRound.name}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="📦" label="ออเดอร์ทั้งหมด" value={`${mockOrders.length}`} sub="รอบนี้" color="bg-blue-100" />
        <StatCard icon="✅" label="ชำระแล้ว" value={`${confirmedOrders}`} sub={`รอตรวจ ${pendingOrders}`} color="bg-green-100" />
        <StatCard icon="💰" label="ยอดขายรวม" value={`฿${totalRevenue.toLocaleString()}`} sub="รวมค่าส่ง" color="bg-yellow-100" />
        <StatCard icon="🍈" label="สินค้าที่เปิดขาย" value={`${products.filter((p) => p.isAvailable).length}`} sub={`จาก ${products.length} รายการ`} color="bg-purple-100" />
      </div>

      {/* Pending orders alert */}
      {pendingOrders > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-xl">
          <p className="font-bold text-yellow-800 text-sm">
            ⚠️ มี {pendingOrders} ออเดอร์ รอตรวจสลิปโอนเงิน!
          </p>
          <p className="text-xs text-yellow-600 mt-1">
            กรุณาตรวจสอบที่แท็บ &quot;คำสั่งซื้อ&quot;
          </p>
        </div>
      )}

      {/* Quick summary of needed stock */}
      <div className="bg-white rounded-2xl shadow-md p-5">
        <h3 className="font-bold text-gray-800 mb-3">📝 สรุปยอดที่ต้องไปรับ (รอบนี้)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs">
                <th className="text-left px-3 py-2 rounded-l-lg">สินค้า</th>
                <th className="text-center px-3 py-2">จำนวนรวม</th>
                <th className="text-right px-3 py-2 rounded-r-lg">ยอดเงิน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(() => {
                const agg: Record<string, { name: string; qty: number; revenue: number }> = {};
                mockOrders.forEach((o) =>
                  o.items.forEach((it) => {
                    if (!agg[it.productId]) agg[it.productId] = { name: it.productName, qty: 0, revenue: 0 };
                    agg[it.productId].qty += it.qty;
                    agg[it.productId].revenue += it.price * it.qty;
                  })
                );
                return Object.entries(agg).map(([pid, d]) => (
                  <tr key={pid} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-700">{d.name}</td>
                    <td className="px-3 py-2 text-center font-bold">{d.qty}</td>
                    <td className="px-3 py-2 text-right text-green-700 font-semibold">฿{d.revenue.toLocaleString()}</td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OrdersTab() {
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered =
    statusFilter === "all"
      ? mockOrders
      : mockOrders.filter((o) => o.orderStatus === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-extrabold text-gray-800">📋 คำสั่งซื้อ</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["all", "received", "preparing", "shipped", "delivered", "claimed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                statusFilter === s
                  ? "bg-green-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {s === "all" ? "ทั้งหมด" : orderStatusLabel[s]?.text || s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((order) => (
          <div key={order.id} className="bg-white rounded-2xl shadow-md p-5 hover:shadow-lg transition">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-extrabold text-gray-800">{order.id}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${paymentStatusLabel[order.paymentStatus].color}`}>
                    {paymentStatusLabel[order.paymentStatus].text}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(order.createdAt).toLocaleString("th-TH")}
                </p>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full font-semibold ${orderStatusLabel[order.orderStatus].color}`}>
                {orderStatusLabel[order.orderStatus].text}
              </span>
            </div>

            {/* Customer */}
            <div className="flex items-center gap-3 mb-3 bg-gray-50 rounded-xl p-3">
              <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center text-sm">
                👤
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-gray-800">{order.customerName}</p>
                <p className="text-xs text-gray-400">{order.phone}</p>
              </div>
              <p className="text-lg font-extrabold text-green-700">
                ฿{(order.totalPrice + order.shippingCost).toLocaleString()}
              </p>
            </div>

            {/* Items */}
            <div className="space-y-1 mb-3">
              {order.items.map((it, i) => (
                <div key={i} className="flex justify-between text-xs text-gray-600">
                  <span>
                    🍈 {it.productName} x{it.qty}
                  </span>
                  <span>฿{(it.price * it.qty).toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-gray-100">
                <span>🚚 {order.shippingMethod}</span>
                <span>฿{order.shippingCost}</span>
              </div>
            </div>

            {/* Tracking */}
            {order.trackingNo && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-800">
                📦 Tracking: <span className="font-bold">{order.trackingNo}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              {order.paymentStatus === "pending" && (
                <button className="flex-1 bg-green-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-green-500 transition">
                  ✅ ยืนยันการชำระ
                </button>
              )}
              {order.orderStatus === "preparing" && (
                <button className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-blue-500 transition">
                  🚚 ใส่เลข Tracking
                </button>
              )}
              <button className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-medium hover:bg-gray-200 transition">
                💬 แจ้ง LINE
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductsTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-gray-800">🍈 จัดการสินค้า</h2>
        <button className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-500 transition">
          + เพิ่มสินค้า
        </button>
      </div>

      <div className="grid gap-3">
        {products.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl shadow-md p-4 flex items-center gap-4 hover:shadow-lg transition">
            <div className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center text-3xl shrink-0">
              {p.type === "flesh" ? "📦" : "🍈"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-bold text-sm text-gray-800 truncate">{p.name}</h3>
                <span className={`shrink-0 w-2 h-2 rounded-full ${p.isAvailable ? "bg-green-500" : "bg-red-400"}`} />
              </div>
              <p className="text-xs text-gray-400">
                {p.variety} • {p.ripeness} • {p.weight}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-extrabold text-green-700">฿{p.price.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400">/{p.unit}</p>
            </div>
            <button className="shrink-0 text-gray-400 hover:text-gray-600 text-lg">✏️</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoundsTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-gray-800">📅 รอบจัดส่ง</h2>
        <button className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-500 transition">
          + เปิดรอบใหม่
        </button>
      </div>

      {/* Current round */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-bold">กำลังเปิดรับ</span>
          <span className="text-xs text-green-200">{currentRound.id}</span>
        </div>
        <h3 className="text-xl font-extrabold mb-3">{currentRound.name}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-[10px] text-green-200 mb-0.5">ปิดรับออเดอร์</p>
            <p className="font-bold">
              {new Date(currentRound.closeDate).toLocaleDateString("th-TH", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-[10px] text-green-200 mb-0.5">วันจัดส่ง</p>
            <p className="font-bold">
              {new Date(currentRound.deliveryDate).toLocaleDateString("th-TH", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="bg-yellow-400 text-green-900 px-4 py-2 rounded-xl text-sm font-bold hover:bg-yellow-300 transition">
            📝 สรุปยอดรอบนี้
          </button>
          <button className="bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/30 transition">
            🔒 ปิดรอบ
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryTab() {
  const totalRevenue = mockOrders.reduce((s, o) => s + o.totalPrice, 0);
  const totalShipping = mockOrders.reduce((s, o) => s + o.shippingCost, 0);
  // Simulated costs
  const estimatedCost = Math.round(totalRevenue * 0.55);
  const packagingCost = mockOrders.length * 35;
  const grossProfit = totalRevenue - estimatedCost - packagingCost;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-extrabold text-gray-800">💰 สรุปยอด {currentRound.name}</h2>

      <div className="bg-white rounded-2xl shadow-md p-6 space-y-4">
        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <span className="text-sm text-gray-500">💵 ยอดขายสินค้า</span>
          <span className="font-bold text-gray-800">฿{totalRevenue.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <span className="text-sm text-gray-500">🚚 ค่าจัดส่ง (เก็บจากลูกค้า)</span>
          <span className="font-bold text-gray-800">฿{totalShipping.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <span className="text-sm text-red-500">🍈 ต้นทุนทุเรียน (ประมาณ)</span>
          <span className="font-bold text-red-600">-฿{estimatedCost.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <span className="text-sm text-red-500">📦 ค่ากล่อง/แพ็ก ({mockOrders.length} กล่อง)</span>
          <span className="font-bold text-red-600">-฿{packagingCost.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center py-3 bg-green-50 rounded-xl px-4">
          <span className="font-extrabold text-green-800">💰 กำไรสุทธิ (โดยประมาณ)</span>
          <span className="text-2xl font-extrabold text-green-700">฿{grossProfit.toLocaleString()}</span>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-xs text-yellow-800">
        <p className="font-bold mb-1">📌 หมายเหตุ</p>
        <p>
          ตัวเลขต้นทุนเป็นค่าประมาณ เมื่อเชื่อมต่อ Google Sheets แล้ว
          ระบบจะดึงข้อมูลจากแท็บ Lots_Cost มาคำนวณให้อัตโนมัติ
        </p>
      </div>
    </div>
  );
}

// ===================== MAIN ADMIN PAGE =====================
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const renderTab = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardTab />;
      case "orders":
        return <OrdersTab />;
      case "products":
        return <ProductsTab />;
      case "rounds":
        return <RoundsTab />;
      case "summary":
        return <SummaryTab />;
      default:
        return <DashboardTab />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main content */}
      <div className="md:ml-60 pb-24 md:pb-8">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-4 sticky top-0 z-40">
          <div className="flex items-center justify-between">
            <div className="md:hidden flex items-center gap-2">
              <img src={shopInfo.logo} alt={shopInfo.name} className="w-8 h-8 rounded-full border border-yellow-400 bg-white object-cover" />
              <span className="font-bold text-sm text-gray-800">{shopInfo.name}</span>
            </div>
            <div className="hidden md:block">
              <h1 className="font-bold text-gray-800">
                สวัสดีค่ะ, เจ้าของร้าน 👋
              </h1>
              <p className="text-xs text-gray-400">
                {new Date().toLocaleDateString("th-TH", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="relative bg-gray-100 p-2 rounded-full hover:bg-gray-200 transition">
                🔔
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center">
                  2
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-4 md:p-6">{renderTab()}</div>
      </div>
    </div>
  );
}
