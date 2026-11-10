"use client";

import { useState } from "react";
import { shopInfo } from "../data/mock";
import type { Order } from "../types/durian";
import { PromptPayQR } from "./PromptPayQR";

export function OrderSuccessModal({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const grandTotal = order.totalPrice + order.shippingCost;

  const summaryText = [
    `🍈 สั่งซื้อ ${shopInfo.name} (${order.id})`,
    `ผู้รับ: ${order.customerName} (${order.phone})`,
    `รายการ: ${order.items.map((it) => `${it.productName} x${it.qty}`).join(", ")}`,
    `ความสุก: ${order.ripenessPref || "ตามมาตรฐานร้าน"}`,
    `ยอดโอนสุทธิ: ฿${grandTotal.toLocaleString()}`,
    `จัดส่ง: ${order.shippingMethod}`,
    `ที่อยู่: ${order.address || "-"}`,
  ].join("\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl p-6 text-center shadow-2xl border-4 border-yellow-400"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={shopInfo.logo}
          alt={shopInfo.name}
          className="w-16 h-16 rounded-full border-2 border-yellow-400 mx-auto mb-2 object-cover shadow-md"
        />
        <h4 className="text-xl font-black text-green-800 mb-0.5">
          สั่งจองสำเร็จแล้วครับ! 🎉
        </h4>
        <p className="text-xs text-gray-500">
          รหัสออเดอร์:{" "}
          <strong className="font-mono text-green-900 text-sm">{order.id}</strong>
        </p>

        {/* Real Scannable Thai PromptPay QR */}
        <PromptPayQR
          target={shopInfo.bankAccount.promptPay}
          amount={grandTotal}
          accountName={shopInfo.bankAccount.name}
        />

        <div className="bg-amber-50 border-2 border-yellow-300 rounded-2xl p-3.5 text-xs text-gray-800 text-left space-y-1 mb-4">
          <p className="font-black text-amber-900">📌 หรือโอนเข้าบัญชีธนาคาร:</p>
          <p>
            ธนาคาร: <strong>{shopInfo.bankAccount.bank}</strong>
          </p>
          <p>
            เลขบัญชี:{" "}
            <strong className="font-mono text-gray-900 text-sm">
              {shopInfo.bankAccount.number}
            </strong>{" "}
            ({shopInfo.bankAccount.name})
          </p>
          <p className="text-[11px] text-gray-500 pt-1 border-t border-amber-200">
            *สแกน QR จ่ายแล้วยอดเข้าตรงเป๊ะ! จากนั้นกดคัดลอกสรุปยอดแล้วส่งสลิปทาง LINE{" "}
            <strong>{shopInfo.lineOA}</strong> ได้เลยครับ
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full py-2.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-black transition border border-amber-300"
          >
            {copied ? "✅ คัดลอกสรุปออเดอร์แล้ว! นำไปวางใน LINE ได้เลย" : "📋 คัดลอกสรุปออเดอร์ส่งให้แอดมิน"}
          </button>

          <div className="flex gap-2">
            <a
              href={`https://line.me/R/ti/p/${shopInfo.lineOA}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-3 rounded-full bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-black transition flex items-center justify-center gap-1.5 shadow"
            >
              <span>💬</span>
              <span>เปิด LINE ส่งสลิป</span>
            </a>
            <a
              href={`/tracking?id=${encodeURIComponent(order.id)}`}
              className="px-4 py-3 rounded-full bg-yellow-400 hover:bg-yellow-300 text-green-950 text-xs font-black transition flex items-center justify-center"
            >
              📦 เช็กสถานะ
            </a>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 rounded-full bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
