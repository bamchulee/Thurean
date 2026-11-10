"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { shopInfo } from "../../data/mock";
import type { Order } from "../../types/durian";
import { LineIcon } from "../../components/Icons";

const statusSteps = [
  {
    key: "received",
    icon: Clock,
    label: "รับออเดอร์แล้ว",
    desc: "ระบบบันทึกรายการและรอตรวจสอบสลิป",
  },
  {
    key: "preparing",
    icon: Truck,
    label: "กำลังคัดทุเรียนจากสวน",
    desc: "ทีมงานวิ่งรถกระบะคัดผลผลิตแก่จัดตามความสุกที่สั่ง",
  },
  {
    key: "packed",
    icon: Package,
    label: "แพ็กกล่องเรียบร้อย",
    desc: "บรรจุกล่องล็อกขั้วเจาะระบายอากาศ / คุมความเย็น 4°C",
  },
  {
    key: "shipped",
    icon: MapPin,
    label: "จัดส่งแล้ว",
    desc: "พัสดุออกจากร้านและอยู่ระหว่างเดินทางไปหาคุณ",
  },
  {
    key: "delivered",
    icon: CheckCircle2,
    label: "ได้รับทุเรียนแล้ว",
    desc: "จัดส่งสำเร็จ ขอบคุณที่อุดหนุนทุเรียนวินคินครับ",
  },
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
  const [copiedTrack, setCopiedTrack] = useState(false);

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
    <div className="min-h-screen bg-[#FBF6E3]">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <img
              src={shopInfo.logo}
              alt={shopInfo.name}
              className="w-11 h-11 rounded-full border border-stone-200 bg-white object-cover"
            />
            <div>
              <h1 className="font-extrabold text-base text-[#1B4D31]">
                {shopInfo.name}
              </h1>
              <p className="text-[11px] text-stone-500 font-mono">
                ติดตามพัสดุ • โทร. {shopInfo.phone}
              </p>
            </div>
          </a>
          <a
            href="/"
            className="text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 px-4 py-2 rounded-xl transition inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>กลับหน้าร้าน</span>
          </a>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Search Box */}
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-[#1B4D31] border border-emerald-200 text-xs font-bold px-3 py-1 rounded-full mb-2.5">
            <Package className="w-3.5 h-3.5" />
            <span>TRACKING SYSTEM</span>
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 mb-2">
            ตรวจสอบสถานะคำสั่งซื้อ &amp; เลขพัสดุ
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 mb-6">
            กรอกรหัสออเดอร์ (เช่น WK-9521) หรือ เลขพัสดุที่ได้รับจากร้าน
          </p>

          <form onSubmit={handleSearch} className="flex gap-2 max-w-md mx-auto">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setNotFound(false);
                }}
                placeholder="เช่น WK-9521 หรือ SCGTH884291823"
                className="w-full border border-stone-300 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-[#1B4D31] focus:outline-none bg-white shadow-xs"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#1B4D31] hover:bg-[#143B25] text-white px-6 py-3 rounded-xl text-sm font-bold transition shadow-sm disabled:opacity-60"
            >
              {loading ? "กำลังค้น..." : "ค้นหา"}
            </button>
          </form>

          <p className="text-xs text-stone-500 mt-3">
            ลองทดสอบค้นหา:{" "}
            <button
              type="button"
              onClick={() => {
                setSearchInput("WK-9521");
                performLookup("WK-9521");
              }}
              className="underline font-bold text-[#1B4D31] hover:text-emerald-700"
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
              className="underline font-bold text-[#1B4D31] hover:text-emerald-700"
            >
              WK-9520
            </button>
          </p>
        </div>

        {notFound && (
          <div className="bg-white border border-rose-200 rounded-2xl p-6 text-center shadow-xs">
            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-2.5">
              <Search className="w-5 h-5" />
            </div>
            <p className="font-bold text-rose-700 text-base mb-1">
              ไม่พบข้อมูลคำสั่งซื้อนี้ในระบบ
            </p>
            <p className="text-xs text-stone-500">
              กรุณาตรวจสอบรหัสออเดอร์อีกครั้ง หรือโทรสอบถามแอดมินที่{" "}
              <strong className="font-mono text-[#1B4D31]">{shopInfo.phone}</strong>
            </p>
          </div>
        )}

        {foundOrder && (
          <div className="space-y-5">
            {/* Summary Header */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
              <div className="flex justify-between items-start border-b border-stone-100 pb-4 mb-4">
                <div>
                  <span className="text-[10px] text-stone-400 font-bold uppercase block">
                    รหัสคำสั่งซื้อ
                  </span>
                  <p className="text-2xl font-extrabold text-[#1B4D31] font-mono">
                    {foundOrder.id}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
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
                  className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                    foundOrder.paymentStatus === "confirmed"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-amber-50 text-amber-800 border border-amber-200"
                  }`}
                >
                  {foundOrder.paymentStatus === "confirmed" ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>ชำระเงินเรียบร้อย</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5" />
                      <span>รอตรวจสอบสลิป</span>
                    </>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
                  <span className="text-stone-400 block text-[10px] uppercase font-bold">
                    ผู้รับ
                  </span>
                  <p className="font-bold text-stone-900 mt-0.5">
                    {foundOrder.customerName} ({foundOrder.phone})
                  </p>
                </div>
                <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
                  <span className="text-stone-400 block text-[10px] uppercase font-bold">
                    บริการจัดส่ง
                  </span>
                  <p className="font-bold text-stone-900 mt-0.5">
                    {foundOrder.shippingMethod}
                  </p>
                </div>
              </div>
              {foundOrder.ripenessPref && (
                <div className="mt-3 text-xs bg-emerald-50/70 text-[#1B4D31] px-3 py-2 rounded-xl font-semibold border border-emerald-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>ระดับความสุกที่สั่ง: {foundOrder.ripenessPref}</span>
                </div>
              )}
            </div>

            {/* Stepper */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
              <h3 className="text-sm font-bold text-stone-900 mb-5 flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#1B4D31]" />
                <span>ขั้นตอนการจัดส่ง</span>
              </h3>

              {foundOrder.orderStatus === "claimed" && (
                <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs font-bold text-rose-700 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>ออเดอร์นี้อยู่ระหว่างดำเนินการแจ้งเคลมประกันคุณภาพ</span>
                </div>
              )}

              <div className="space-y-6 relative pl-7 border-l-2 border-stone-200 ml-3">
                {statusSteps.map((step, idx) => {
                  const isDone = idx <= currentStep;
                  const isCurrent = idx === currentStep;
                  const Icon = step.icon;

                  return (
                    <div key={step.key} className="relative">
                      <div
                        className={`absolute -left-[39px] -top-0.5 w-7 h-7 rounded-full flex items-center justify-center border-2 ${
                          isCurrent
                            ? "bg-amber-500 border-[#1B4D31] text-stone-950 scale-105 shadow-sm"
                            : isDone
                            ? "bg-[#1B4D31] border-[#1B4D31] text-white"
                            : "bg-white border-stone-300 text-stone-400"
                        }`}
                      >
                        {isCurrent ? (
                          <Icon className="w-3.5 h-3.5" />
                        ) : isDone ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Icon className="w-3 h-3" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm font-bold ${
                              isCurrent
                                ? "text-[#1B4D31]"
                                : isDone
                                ? "text-stone-800"
                                : "text-stone-400"
                            }`}
                          >
                            {step.label}
                          </p>
                          {isCurrent && (
                            <span className="bg-emerald-50 text-[#1B4D31] border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              สถานะปัจจุบัน
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tracking Number */}
            {foundOrder.trackingNo && (
              <div className="bg-[#1B4D31] text-white rounded-2xl p-5 border border-emerald-900 flex items-center justify-between shadow-md">
                <div>
                  <span className="text-[10px] text-amber-300 font-bold uppercase block tracking-wider">
                    หมายเลขพัสดุ (Tracking No.)
                  </span>
                  <p className="font-mono text-xl font-black text-white tracking-wider">
                    {foundOrder.trackingNo}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(foundOrder.trackingNo || "");
                    setCopiedTrack(true);
                    setTimeout(() => setCopiedTrack(false), 2000);
                  }}
                  className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-4 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
                >
                  {copiedTrack ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>คัดลอกแล้ว</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>คัดลอก</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Items */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
              <h3 className="text-sm font-bold text-stone-900 mb-3">
                รายการทุเรียนในคำสั่งซื้อ
              </h3>
              <div className="divide-y divide-stone-100">
                {foundOrder.items.map((it, i) => (
                  <div
                    key={i}
                    className="py-2.5 flex justify-between items-center text-xs"
                  >
                    <span className="text-stone-800 font-semibold">
                      {it.productName}{" "}
                      <span className="text-stone-400">x{it.qty}</span>
                    </span>
                    <span className="font-mono font-bold text-stone-900">
                      ฿{(it.price * it.qty).toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="py-2.5 flex justify-between items-center text-xs text-stone-500">
                  <span>ค่าจัดส่ง</span>
                  <span className="font-mono">
                    {foundOrder.shippingCost === 0
                      ? "ฟรี"
                      : `฿${foundOrder.shippingCost}`}
                  </span>
                </div>
              </div>
              <div className="pt-3 border-t border-stone-200 flex justify-between items-baseline mt-1">
                <span className="text-sm font-bold text-stone-700">
                  ยอดรวมทั้งหมด
                </span>
                <span className="text-2xl font-extrabold text-[#1B4D31]">
                  ฿{(foundOrder.totalPrice + foundOrder.shippingCost).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={`/claim?orderId=${encodeURIComponent(foundOrder.id)}`}
                className="flex-1 py-3.5 rounded-xl bg-white border border-stone-300 text-stone-700 text-xs font-bold text-center hover:bg-stone-50 transition inline-flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>แจ้งปัญหา / เคลมทุเรียน</span>
              </a>
              <a
                href={`https://line.me/R/ti/p/${shopInfo.lineOA}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3.5 rounded-xl bg-[#06C755] text-white text-xs font-bold text-center hover:bg-[#05b34c] transition shadow-sm inline-flex items-center justify-center gap-1.5"
              >
                <LineIcon className="w-4 h-4" />
                <span>ทักแชทแอดมินทาง LINE</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
