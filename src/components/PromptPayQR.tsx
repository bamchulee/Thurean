"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { generatePromptPayPayload } from "../lib/promptpay";

export function PromptPayQR({
  target,
  amount,
  accountName,
}: {
  target: string;
  amount: number;
  accountName: string;
}) {
  const [qrUrl, setQrUrl] = useState<string>("");

  useEffect(() => {
    const payload = generatePromptPayPayload(target, amount);
    QRCode.toDataURL(payload, {
      width: 240,
      margin: 2,
      color: {
        dark: "#11381f",
        light: "#ffffff",
      },
    })
      .then(setQrUrl)
      .catch(() => setQrUrl(""));
  }, [target, amount]);

  if (!qrUrl) return null;

  return (
    <div className="bg-white border-2 border-[#0e3f6e] rounded-2xl overflow-hidden shadow-sm max-w-[240px] mx-auto my-3">
      <div className="bg-[#0e3f6e] text-white py-2 px-3 text-center">
        <p className="text-[11px] font-black tracking-wider uppercase">
          THAI QR PAYMENT • พร้อมเพย์
        </p>
      </div>
      <div className="p-3 flex flex-col items-center">
        <img
          src={qrUrl}
          alt="PromptPay QR Code"
          className="w-44 h-44 object-contain"
        />
        <p className="text-xs font-black text-green-900 mt-1">
          ยอดโอน ฿{amount.toLocaleString()}
        </p>
        <p className="text-[10px] text-gray-500 font-mono">
          {target} • {accountName}
        </p>
      </div>
    </div>
  );
}
