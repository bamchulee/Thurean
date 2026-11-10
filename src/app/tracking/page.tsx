"use client";

import { useState } from "react";
import { sampleOrders, shopInfo } from "../../data/mock";
import type { Order } from "../../data/mock";

const statusSteps = [
  { key: "received", label: "รับคำสั่งจอง", desc: "ระบบบันทึกรายการและยืนยันยอดเรียบร้อย" },
  { key: "preparing", label: "คัดสรรจากสวน", desc: "ทีมงานคัดเลือกผลผลิตแก่จัดตามสเปก" },
  { key: "packed", label: "บรรจุกล่องควบคุมความเย็น", desc: "แพ็กกล่องล็อกขั้วและควบคุมอุณหภูมิ 4°C" },
  { key: "shipped", label: "ส่งต่อผู้ให้บริการขนส่ง", desc: "พัสดุออกจากศูนย์กระจายสินค้าแล้ว" },
  { key: "delivered", label: "จัดส่งสำเร็จ", desc: "ลูกค้าได้รับผลผลิตเรียบร้อย" },
];

const mockOrdersExtended: (Order & { address?: string })[] = [
  {
    ...sampleOrders[0],
    address: "123/45 ซอยสุขุมวิท 55 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพมหานคร 10110",
  },
  {
    id: "ORD-9420",
    createdAt: "2026-11-09T10:15:00",
    roundId: "BATCH-2026-W46",
    customerName: "คุณวิภาวี ภัทรเดช",
    phone: "089-876-XXXX",
    items: [
      { productId: "DR-03", productName: "ก้านยาวจันทบุรี ต้นโบราณคัดพิเศษ", qty: 1, price: 1450 },
    ],
    totalPrice: 1450,
    shippingMethod: "SCG Express / Inter Express (รถห้องเย็นควบคุม 4°C)",
    shippingCost: 120,
    paymentStatus: "confirmed",
    orderStatus: "shipped",
    trackingNo: "SCGTH884291823",
    address: "99/9 หมู่ 5 ต.ช้างเผือก อ.เมือง จ.เชียงใหม่ 50300",
  },
];

function getStatusIndex(status: string) {
  return statusSteps.findIndex((s) => s.key === status);
}

export default function TrackingPage() {
  const [searchInput, setSearchInput] = useState("");
  const [foundOrder, setFoundOrder] = useState<(Order & { address?: string }) | null>(null);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim().toUpperCase();
    const order = mockOrdersExtended.find(
      (o) => o.id.toUpperCase() === q || o.trackingNo?.toUpperCase() === q
    );
    if (order) {
      setFoundOrder(order);
      setNotFound(false);
    } else {
      setFoundOrder(null);
      setNotFound(true);
    }
  };

  const currentStep = foundOrder ? getStatusIndex(foundOrder.orderStatus) : -1;

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      {/* Header */}
      <header className="bg-[#081c10] text-white border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <img src={shopInfo.logo} alt={shopInfo.name} className="w-10 h-10 rounded-full border border-[#c5a059] bg-white object-cover" />
            <div>
              <h1 className="font-serif font-bold text-sm tracking-wider uppercase text-white">{shopInfo.name}</h1>
              <p className="text-[10px] text-[#c5a059] font-mono">โทร. {shopInfo.phone}</p>
            </div>
          </a>
          <a href="/" className="text-xs text-white/70 hover:text-white transition">
            ← กลับหน้าร้าน
          </a>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Search Box */}
        <div className="text-center mb-10">
          <p className="text-[11px] font-bold text-[#997a35] uppercase tracking-widest mb-1">
            REAL-TIME LOGISTICS
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl text-stone-900 font-normal mb-2">
            ตรวจสอบสถานะคำสั่งซื้อ & พัสดุ
          </h2>
          <p className="text-xs text-stone-500 font-light max-w-md mx-auto mb-6">
            ระบุหมายเลขคำสั่งซื้อ (เช่น ORD-9421) หรือหมายเลขติดตามพัสดุ (Tracking Number)
          </p>

          <form onSubmit={handleSearch} className="flex gap-2 max-w-md mx-auto">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setNotFound(false);
              }}
              placeholder="เช่น ORD-9421 หรือ SCGTH884291823"
              className="flex-1 border border-stone-300 rounded px-4 py-2.5 text-xs focus:border-[#081c10] focus:outline-none bg-white"
            />
            <button
              type="submit"
              className="bg-[#081c10] text-[#e6c875] px-6 py-2.5 rounded text-xs font-semibold uppercase tracking-wider hover:bg-[#0f291a] transition"
            >
              ค้นหา
            </button>
          </form>

          <p className="text-[11px] text-stone-400 mt-3">
            ตัวอย่างสำหรับทดสอบ:{" "}
            <button
              type="button"
              onClick={() => setSearchInput("ORD-9421")}
              className="underline text-stone-600 hover:text-stone-900"
            >
              ORD-9421
            </button>{" "}
            หรือ{" "}
            <button
              type="button"
              onClick={() => setSearchInput("ORD-9420")}
              className="underline text-stone-600 hover:text-stone-900"
            >
              ORD-9420
            </button>
          </p>
        </div>

        {notFound && (
          <div className="bg-white border border-stone-200 rounded p-6 text-center shadow-sm">
            <p className="font-serif font-bold text-stone-900 text-sm mb-1">ไม่พบข้อมูลคำสั่งซื้อในระบบ</p>
            <p className="text-xs text-stone-500 font-light">
              กรุณาตรวจสอบหมายเลขอักขระอีกครั้ง หรือสอบถามเจ้าหน้าที่ผ่าน LINE OA: {shopInfo.lineOA}
            </p>
          </div>
        )}

        {foundOrder && (
          <div className="space-y-6">
            {/* Summary Header */}
            <div className="bg-white border border-stone-200 rounded p-6 shadow-sm">
              <div className="flex justify-between items-start border-b border-stone-100 pb-4 mb-4">
                <div>
                  <span className="text-[10px] text-stone-400 uppercase tracking-widest block">ORDER ID</span>
                  <p className="font-serif text-xl font-bold text-stone-900">{foundOrder.id}</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    สั่งซื้อเมื่อ: {new Date(foundOrder.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <span className="px-3 py-1 rounded text-xs font-semibold uppercase tracking-wider bg-stone-100 text-stone-800 border border-stone-200">
                  {foundOrder.paymentStatus === "confirmed" ? "ชำระเงินเรียบร้อย" : "รอการชำระ"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase">ผู้รับ</span>
                  <p className="font-semibold text-stone-800">{foundOrder.customerName}</p>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase">บริการจัดส่ง</span>
                  <p className="font-semibold text-stone-800">{foundOrder.shippingMethod}</p>
                </div>
              </div>
            </div>

            {/* Stepper */}
            <div className="bg-white border border-stone-200 rounded p-6 shadow-sm">
              <h3 className="font-serif text-sm font-bold text-stone-900 mb-6 uppercase tracking-wider">
                สถานะการดำเนินงาน
              </h3>

              <div className="space-y-6 relative pl-6 border-l border-stone-200 ml-2">
                {statusSteps.map((step, idx) => {
                  const isDone = idx <= currentStep;
                  const isCurrent = idx === currentStep;

                  return (
                    <div key={step.key} className="relative">
                      {/* Bullet */}
                      <div
                        className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 ${
                          isCurrent
                            ? "bg-[#081c10] border-[#c5a059]"
                            : isDone
                            ? "bg-[#081c10] border-[#081c10]"
                            : "bg-white border-stone-300"
                        }`}
                      />

                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-bold ${isCurrent ? "text-[#081c10]" : isDone ? "text-stone-800" : "text-stone-400"}`}>
                            {step.label}
                          </p>
                          {isCurrent && (
                            <span className="bg-[#081c10] text-[#e6c875] text-[9px] font-mono uppercase px-1.5 py-0.5 rounded tracking-wider">
                              Current Status
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500 font-light mt-0.5">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tracking Number Callout */}
            {foundOrder.trackingNo && (
              <div className="bg-[#0b1f13] text-white rounded p-4 border border-[#c5a059]/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#c5a059] uppercase tracking-widest block">
                    WAYBILL / TRACKING NUMBER
                  </span>
                  <p className="font-mono text-base font-bold text-white tracking-wider">
                    {foundOrder.trackingNo}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(foundOrder.trackingNo || "")}
                  className="px-3 py-1.5 rounded border border-[#c5a059]/50 text-[#e6c875] text-xs hover:bg-white/5 transition"
                >
                  คัดลอก
                </button>
              </div>
            )}

            {/* Items */}
            <div className="bg-white border border-stone-200 rounded p-6 shadow-sm">
              <h3 className="font-serif text-sm font-bold text-stone-900 mb-3 uppercase tracking-wider">
                รายการสินค้าในคำสั่งซื้อ
              </h3>
              <div className="divide-y divide-stone-100">
                {foundOrder.items.map((it, i) => (
                  <div key={i} className="py-2.5 flex justify-between items-center text-xs">
                    <span className="text-stone-800 font-medium">
                      {it.productName} <span className="text-stone-400">x{it.qty}</span>
                    </span>
                    <span className="font-mono font-semibold text-stone-900">
                      ฿{(it.price * it.qty).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-stone-200 flex justify-between items-baseline mt-2">
                <span className="text-xs font-bold text-stone-700">ยอดรวมทั้งสิ้น</span>
                <span className="font-serif text-lg font-bold text-stone-900">
                  ฿{(foundOrder.totalPrice + foundOrder.shippingCost).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Help Links */}
            <div className="flex gap-3">
              <a
                href="/claim"
                className="flex-1 py-3 rounded border border-stone-300 text-stone-700 text-xs font-semibold text-center hover:bg-stone-100 transition"
              >
                แจ้งปัญหา / เคลมผลผลิต
              </a>
              <a
                href="#"
                className="flex-1 py-3 rounded bg-[#081c10] text-[#e6c875] text-xs font-semibold text-center hover:bg-[#0f291a] transition"
              >
                ติดต่อเจ้าหน้าที่ผ่าน LINE
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
