"use client";

import { shopInfo } from "../data/mock";
import type { Order } from "../types/durian";

export function ShippingLabelModal({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 print:bg-white print:p-0 print:static"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 print:shadow-none print:max-w-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b pb-3 print:hidden">
          <h3 className="font-black text-base text-gray-900">
            🖨️ ตัวอย่างใบปะหน้ากล่องพัสดุ ({order.id})
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {/* Printable Label Box */}
        <div className="border-2 border-black p-5 rounded-lg space-y-4 text-black bg-white">
          {/* Sender Row */}
          <div className="flex items-center justify-between border-b-2 border-black pb-3">
            <div className="flex items-center gap-3">
              <img
                src={shopInfo.logo}
                alt={shopInfo.name}
                className="w-12 h-12 rounded-full border border-black object-cover"
              />
              <div>
                <p className="font-black text-base">{shopInfo.name}</p>
                <p className="text-xs font-mono">โทร. {shopInfo.phone}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold block text-gray-500">
                ORDER ID
              </span>
              <span className="font-mono font-black text-lg">{order.id}</span>
            </div>
          </div>

          {/* Receiver Row */}
          <div className="border-b border-dashed border-gray-400 pb-3 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider bg-black text-white px-2 py-0.5 rounded">
              ผู้รับ (TO)
            </span>
            <p className="font-black text-lg pt-1">{order.customerName}</p>
            <p className="font-mono font-bold text-base">โทร. {order.phone}</p>
            <p className="text-sm leading-relaxed">
              {order.address || "ไม่ได้ระบุที่อยู่ (กรุณาตรวจสอบในแชท LINE)"}
            </p>
          </div>

          {/* Shipping & Contents */}
          <div className="text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="font-bold">ขนส่ง:</span>
              <span className="font-bold">{order.shippingMethod}</span>
            </div>
            {order.trackingNo && (
              <div className="flex justify-between">
                <span className="font-bold">Tracking:</span>
                <span className="font-mono font-black">{order.trackingNo}</span>
              </div>
            )}
            <div className="bg-gray-100 p-2 rounded border border-gray-300 mt-2">
              <p className="font-bold mb-1">รายการในกล่อง:</p>
              {order.items.map((it, idx) => (
                <p key={idx}>
                  • {it.productName} <strong>x{it.qty}</strong>
                </p>
              ))}
              {order.ripenessPref && (
                <p className="mt-1 font-bold">ความสุก: {order.ripenessPref}</p>
              )}
            </div>
          </div>

          {/* Warning Banner */}
          <div className="border-2 border-black p-2 text-center font-black text-xs tracking-wide uppercase">
            ⚠️ ระวังหนามทุเรียน • ผลไม้สด กรุณาส่งด่วน ห้ามโยน / ห้ามตากแดด ⚠️
          </div>
        </div>

        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 bg-green-800 hover:bg-green-700 text-yellow-300 font-black py-3 rounded-xl text-xs transition"
          >
            🖨️ สั่งพิมพ์ใบปะหน้ากล่อง
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
