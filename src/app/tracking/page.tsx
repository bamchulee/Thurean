"use client";

import { useEffect, useState } from "react";
import { shopInfo } from "../../data/mock";
import type { Order } from "../../types/durian";

const statusSteps = [
  { key: "received", icon: "📥", label: "รับออเดอร์แล้ว", desc: "ระบบบันทึกรายการและรอตรวจสอบสลิป" },
  { key: "preparing", icon: "🛻", label: "กำลังคัดทุเรียนจากสวน", desc: "ทีมงานวิ่งรถกระบะคัดผลผลิตแก่จัดตามความสุกที่สั่ง" },
  { key: "packed", icon: "📦", label: "แพ็กกล่องเรียบร้อย", desc: "บรรจุกล่องล็อกขั้วเจาะระบายอากาศ / คุมความเย็น 4°C" },
  { key: "shipped", icon: "🚚", label: "จัดส่งแล้ว", desc: "พัสดุออกจากร้านและอยู่ระหว่างเดินทางไปหาคุณ" },
  { key: "delivered", icon: "🎉", label: "ได้รับทุเรียนแล้ว", desc: "จัดส่งสำเร็จ ขอบคุณที่อุดหนุนทุเรียนวินคินครับ" },
];

function getStatusIndex(status: string) {
  if (status === "claimed") return 4;
  return statusSteps.findIndex((s) => s.key === status);
}

export default function TrackingPage() {
  const [searchInput, setSearchInput] = useState("");
  const [foundOrder, setFoundOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const performLookup = async (query: string) => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(q)}`);
      const json = (await res.json()) as { ok: boolean; order?: Order };
      if (res.ok && json.ok && json.order) {
        setFoundOrder(json.order);
        setNotFound(false);
      } else {
        setFoundOrder(null);
        setNotFound(true);
      }
    } catch {
      setFoundOrder(null);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    if (idParam) {
      setSearchInput(idParam);
      performLookup(idParam);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performLookup(searchInput);
  };

  const currentStep = foundOrder ? getStatusIndex(foundOrder.orderStatus) : -1;

  return (
    <div className="min-h-screen bg-[#faf6eb]">
      {/* Header */}
      <header className="bg-white border-b-2 border-yellow-400 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <img
              src={shopInfo.logo}
              alt={shopInfo.name}
              className="w-11 h-11 rounded-full border-2 border-yellow-400 bg-white object-cover"
            />
            <div>
              <h1 className="font-black text-base text-green-800">{shopInfo.name}</h1>
              <p className="text-[11px] text-amber-700 font-mono font-bold">
                เช็กสถานะพัสดุ • โทร. {shopInfo.phone}
              </p>
            </div>
          </a>
          <a
            href="/"
            className="text-xs font-bold bg-green-800 text-yellow-300 px-4 py-2 rounded-full hover:bg-green-700 transition"
          >
            ← กลับหน้าร้าน
          </a>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Search Box */}
        <div className="text-center mb-8">
          <span className="inline-block bg-yellow-400 text-green-950 text-xs font-black px-3 py-1 rounded-full mb-2">
            📦 TRACKING SYSTEM
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">
            ตรวจสอบสถานะคำสั่งซื้อ & เลขพัสดุ
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mb-6">
            กรอกรหัสออเดอร์ (เช่น WK-9521) หรือ เลขพัสดุที่ได้รับจากร้าน
          </p>

          <form onSubmit={handleSearch} className="flex gap-2 max-w-md mx-auto">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setNotFound(false);
              }}
              placeholder="เช่น WK-9521 หรือ SCGTH884291823"
              className="flex-1 border-2 border-yellow-300 rounded-full px-5 py-3 text-sm focus:border-green-700 focus:outline-none bg-white shadow-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-green-800 hover:bg-green-700 text-yellow-300 px-6 py-3 rounded-full text-sm font-black transition shadow-md disabled:opacity-60"
            >
              {loading ? "กำลังค้น..." : "ค้นหา"}
            </button>
          </form>

          <p className="text-xs text-gray-500 mt-3">
            ลองทดสอบค้นหา:{" "}
            <button
              type="button"
              onClick={() => {
                setSearchInput("WK-9521");
                performLookup("WK-9521");
              }}
              className="underline font-bold text-green-800 hover:text-green-600"
            >
              WK-9521
            </button>{" "}
            หรือ{" "}
            <button
              type="button"
              onClick={() => {
                setSearchInput("WK-9520");
                performLookup("WK-9520");
              }}
              className="underline font-bold text-green-800 hover:text-green-600"
            >
              WK-9520
            </button>
          </p>
        </div>

        {notFound && (
          <div className="bg-white border-2 border-red-200 rounded-2xl p-6 text-center shadow-sm">
            <div className="text-3xl mb-2">🔍</div>
            <p className="font-black text-red-700 text-base mb-1">
              ไม่พบข้อมูลคำสั่งซื้อนี้ในระบบ
            </p>
            <p className="text-xs text-gray-500">
              กรุณาตรวจสอบรหัสออเดอร์อีกครั้ง หรือโทรสอบถามแอดมินที่{" "}
              <strong className="font-mono text-green-800">{shopInfo.phone}</strong>
            </p>
          </div>
        )}

        {foundOrder && (
          <div className="space-y-5">
            {/* Summary Header */}
            <div className="bg-white border-2 border-yellow-300 rounded-2xl p-6 shadow-md">
              <div className="flex justify-between items-start border-b border-gray-100 pb-4 mb-4">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">
                    รหัสคำสั่งซื้อ
                  </span>
                  <p className="text-2xl font-black text-green-900 font-mono">
                    {foundOrder.id}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    สั่งซื้อเมื่อ:{" "}
                    {new Date(foundOrder.createdAt).toLocaleString("th-TH", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span
                  className={`px-3 py-1.5 rounded-full text-xs font-black ${
                    foundOrder.paymentStatus === "confirmed"
                      ? "bg-green-100 text-green-800 border border-green-300"
                      : "bg-yellow-100 text-amber-800 border border-yellow-300"
                  }`}
                >
                  {foundOrder.paymentStatus === "confirmed"
                    ? "✅ ชำระเงินเรียบร้อย"
                    : "⏳ รอตรวจสอบสลิป"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-amber-50/70 rounded-xl p-3">
                  <span className="text-gray-500 block text-[10px]">ผู้รับ</span>
                  <p className="font-bold text-gray-900">
                    {foundOrder.customerName} ({foundOrder.phone})
                  </p>
                </div>
                <div className="bg-amber-50/70 rounded-xl p-3">
                  <span className="text-gray-500 block text-[10px]">บริการจัดส่ง</span>
                  <p className="font-bold text-gray-900">{foundOrder.shippingMethod}</p>
                </div>
              </div>
              {foundOrder.ripenessPref && (
                <div className="mt-3 text-xs bg-green-50 text-green-900 px-3 py-2 rounded-xl font-bold border border-green-200">
                  🥑 ระดับความสุกที่สั่ง: {foundOrder.ripenessPref}
                </div>
              )}
            </div>

            {/* Stepper */}
            <div className="bg-white border-2 border-yellow-300 rounded-2xl p-6 shadow-md">
              <h3 className="text-sm font-black text-gray-900 mb-5">
                📍 ขั้นตอนการจัดส่ง
              </h3>

              {foundOrder.orderStatus === "claimed" && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-xs font-bold text-red-700">
                  🛡️ ออเดอร์นี้อยู่ระหว่างดำเนินการแจ้งเคลมประกันคุณภาพ
                </div>
              )}

              <div className="space-y-6 relative pl-7 border-l-2 border-green-200 ml-3">
                {statusSteps.map((step, idx) => {
                  const isDone = idx <= currentStep;
                  const isCurrent = idx === currentStep;

                  return (
                    <div key={step.key} className="relative">
                      <div
                        className={`absolute -left-[37px] -top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                          isCurrent
                            ? "bg-yellow-400 border-green-800 text-green-950 scale-110 shadow"
                            : isDone
                            ? "bg-green-700 border-green-700 text-white"
                            : "bg-white border-gray-300 text-gray-400"
                        }`}
                      >
                        {isCurrent ? step.icon : isDone ? "✓" : ""}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm font-black ${
                              isCurrent
                                ? "text-green-800"
                                : isDone
                                ? "text-gray-800"
                                : "text-gray-400"
                            }`}
                          >
                            {step.label}
                          </p>
                          {isCurrent && (
                            <span className="bg-green-700 text-yellow-300 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                              สถานะปัจจุบัน
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tracking Number */}
            {foundOrder.trackingNo && (
              <div className="bg-green-900 text-white rounded-2xl p-5 border-2 border-yellow-400 flex items-center justify-between shadow-lg">
                <div>
                  <span className="text-[10px] text-yellow-300 font-bold uppercase block">
                    🚚 หมายเลขพัสดุ (Tracking No.)
                  </span>
                  <p className="font-mono text-xl font-black text-white tracking-wider">
                    {foundOrder.trackingNo}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(foundOrder.trackingNo || "")}
                  className="bg-yellow-400 hover:bg-yellow-300 text-green-950 px-4 py-2 rounded-full text-xs font-black transition"
                >
                  📋 คัดลอก
                </button>
              </div>
            )}

            {/* Items */}
            <div className="bg-white border-2 border-yellow-300 rounded-2xl p-6 shadow-md">
              <h3 className="text-sm font-black text-gray-900 mb-3">
                🍈 รายการทุเรียนในคำสั่งซื้อ
              </h3>
              <div className="divide-y divide-gray-100">
                {foundOrder.items.map((it, i) => (
                  <div key={i} className="py-2.5 flex justify-between items-center text-xs">
                    <span className="text-gray-800 font-bold">
                      {it.productName} <span className="text-gray-400">x{it.qty}</span>
                    </span>
                    <span className="font-mono font-bold text-gray-900">
                      ฿{(it.price * it.qty).toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="py-2.5 flex justify-between items-center text-xs text-gray-500">
                  <span>ค่าจัดส่ง</span>
                  <span className="font-mono">
                    {foundOrder.shippingCost === 0 ? "ฟรี" : `฿${foundOrder.shippingCost}`}
                  </span>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-200 flex justify-between items-baseline mt-1">
                <span className="text-sm font-black text-gray-700">ยอดรวมทั้งหมด</span>
                <span className="text-2xl font-black text-green-800">
                  ฿{(foundOrder.totalPrice + foundOrder.shippingCost).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={`/claim?orderId=${encodeURIComponent(foundOrder.id)}`}
                className="flex-1 py-3.5 rounded-full bg-red-50 border-2 border-red-200 text-red-700 text-xs font-black text-center hover:bg-red-100 transition"
              >
                🛡️ แจ้งปัญหา / เคลมทุเรียน
              </a>
              <a
                href={`https://line.me/R/ti/p/${shopInfo.lineOA}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3.5 rounded-full bg-[#06C755] text-white text-xs font-black text-center hover:bg-[#05b34c] transition shadow"
              >
                💬 ทักแชทแอดมินทาง LINE
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
