"use client";

import { useState } from "react";
import { Check, CheckCircle2, Copy, CreditCard, Package } from "lucide-react";
import { shopInfo } from "../data/mock";
import type { Order } from "../types/durian";
import { PromptPayQR } from "./PromptPayQR";
import { LineIcon } from "./Icons";

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
    `สั่งซื้อ ${shopInfo.name} (${order.id})`,
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
      className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl p-6 text-center shadow-2xl border border-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#1B4D31] flex items-center justify-center mx-auto mb-2.5 border border-emerald-200">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h4 className="text-xl font-bold text-stone-900 mb-0.5">
          บันทึกคำสั่งจองสำเร็จ
        </h4>
        <p className="text-xs text-stone-500">
          รหัสคำสั่งซื้อ:{" "}
          <strong className="font-mono text-[#1B4D31] text-sm">{order.id}</strong>
        </p>

        {/* Real Scannable Thai PromptPay QR */}
        <PromptPayQR
          target={shopInfo.bankAccount.promptPay}
          amount={grandTotal}
          accountName={shopInfo.bankAccount.name}
        />

        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3.5 text-xs text-stone-700 text-left space-y-1.5 mb-4">
          <p className="font-bold text-stone-900 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-[#1B4D31]" />
            <span>หรือโอนเข้าบัญชีธนาคาร</span>
          </p>
          <p>
            ธนาคาร: <strong>{shopInfo.bankAccount.bank}</strong>
          </p>
          <p>
            เลขบัญชี:{" "}
            <strong className="font-mono text-stone-900 text-sm">
              {shopInfo.bankAccount.number}
            </strong>{" "}
            ({shopInfo.bankAccount.name})
          </p>
          <p className="text-[11px] text-stone-500 pt-1.5 border-t border-stone-200">
            สแกน QR ชำระยอดตรงอัตโนมัติ จากนั้นกดคัดลอกสรุปออเดอร์แล้วส่งสลิปทาง LINE{" "}
            <strong className="text-stone-800">{shopInfo.lineOA}</strong>
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition border border-amber-200 flex items-center justify-center gap-1.5"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-700" />
                <span>คัดลอกสรุปออเดอร์แล้ว นำไปวางใน LINE ได้เลย</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>คัดลอกสรุปออเดอร์ส่งให้แอดมิน</span>
              </>
            )}
          </button>

          <div className="flex gap-2">
            <a
              href={`https://line.me/R/ti/p/${shopInfo.lineOA}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-3 rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <LineIcon className="w-4 h-4" />
              <span>เปิด LINE ส่งสลิป</span>
            </a>
            <a
              href={`/tracking?id=${encodeURIComponent(order.id)}`}
              className="px-4 py-3 rounded-xl bg-[#1B4D31] hover:bg-[#143B25] text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <Package className="w-4 h-4" />
              <span>เช็กสถานะ</span>
            </a>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-stone-100 text-stone-600 text-xs font-semibold hover:bg-stone-200 transition"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
