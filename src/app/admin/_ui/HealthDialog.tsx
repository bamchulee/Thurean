"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Stethoscope, X, XCircle } from "lucide-react";

type Check = { id: string; label: string; ok: boolean; detail: string; ms?: number };

// ผลปุ่ม "ทดสอบระบบ" — เช็ก Google Sheets, LINE token/secret, กลุ่มแอดมิน, การล็อกอิน
export function HealthDialog({ onClose }: { onClose: () => void }) {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { checks?: Check[]; error?: string }) => {
        if (cancelled) return;
        if (j.checks) setChecks(j.checks);
        else setError(j.error || "ทดสอบไม่สำเร็จ");
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  const passed = checks?.filter((c) => c.ok).length ?? 0;
  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <h3 className="font-extrabold text-stone-900 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-[#1B4D31]" />
            ทดสอบระบบ
            {checks && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${passed === checks.length ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                ผ่าน {passed}/{checks.length}
              </span>
            )}
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100" aria-label="ปิด">
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {!checks && !error && (
            <div className="flex items-center gap-2 text-sm text-stone-500 py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> กำลังทดสอบการเชื่อมต่อ...
            </div>
          )}
          {error && <p className="text-sm text-rose-700">{error}</p>}
          {checks && (
            <ul className="divide-y divide-stone-100">
              {checks.map((c) => (
                <li key={c.id} className="py-2.5 flex items-start gap-3">
                  {c.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <XCircle className="w-5 h-5 text-rose-600 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-stone-800">
                      {c.label}
                      {c.ms !== undefined && <span className="text-[11px] font-normal text-stone-400 ml-1.5">{c.ms} ms</span>}
                    </p>
                    <p className={`text-xs break-words ${c.ok ? "text-stone-500" : "text-rose-700"}`}>{c.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
