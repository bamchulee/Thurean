"use client";

// ชิ้นส่วน UI ที่ใช้ร่วมกันทุกหน้าหลังบ้าน: แถบปุ่ม (บันทึก/ล้างค่า/ทดสอบ/กลับหน้าหลัก), ตาราง, ลิ้นชักแก้ไข, กล่องยืนยัน
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Home, Loader2, RotateCcw, Save, Search, Stethoscope, X, XCircle } from "lucide-react";

// ============== ปุ่มประจำหน้า (แต่ละหน้าบอก shell ว่าบันทึก/ล้างค่าทำอะไร) ==============
export interface PageActions {
  /** จำนวนรายการที่แก้แล้วยังไม่บันทึก (0 = ปุ่มบันทึกกดไม่ได้) */
  dirty?: number;
  onSave?: () => Promise<void> | void;
  /** ล้างค่า: ทุกครั้งต้องผ่านกล่องยืนยันก่อน */
  onClear?: () => void;
  clearLabel?: string;
  clearConfirm?: string;
}

const ActionsCtx = createContext<(a: PageActions) => void>(() => {});
export const ActionsProvider = ActionsCtx.Provider;

/** หน้าลงทะเบียนปุ่มของตัวเองกับแถบด้านบน */
export function usePageActions(actions: PageActions) {
  const set = useContext(ActionsCtx);
  const { dirty, onSave, onClear, clearLabel, clearConfirm } = actions;
  useEffect(() => {
    set({ dirty, onSave, onClear, clearLabel, clearConfirm });
  }, [set, dirty, onSave, onClear, clearLabel, clearConfirm]);
  useEffect(() => () => set({}), [set]);
}

export function ActionBar({
  actions,
  onTest,
  onHome,
  homeLabel,
}: {
  actions: PageActions;
  onTest: () => void;
  onHome: () => void;
  homeLabel: string;
}) {
  const [saving, setSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const dirty = actions.dirty || 0;
  const canSave = Boolean(actions.onSave) && dirty > 0 && !saving;

  const save = async () => {
    if (!actions.onSave) return;
    setSaving(true);
    try {
      await actions.onSave();
    } finally {
      setSaving(false);
    }
  };

  const btn = "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed";
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} disabled={!canSave} className={`${btn} bg-[#1B4D31] hover:bg-[#143B25] text-white`}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          บันทึก{dirty > 0 ? ` (${dirty})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setConfirmClear(true)}
          disabled={!actions.onClear}
          className={`${btn} bg-white border border-stone-300 text-stone-700 hover:bg-stone-50`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {actions.clearLabel || "ล้างค่า"}
        </button>
        <button type="button" onClick={onTest} className={`${btn} bg-white border border-stone-300 text-stone-700 hover:bg-stone-50`}>
          <Stethoscope className="w-3.5 h-3.5" />
          ทดสอบระบบ
        </button>
        <button type="button" onClick={onHome} className={`${btn} bg-white border border-stone-300 text-stone-700 hover:bg-stone-50`}>
          <Home className="w-3.5 h-3.5" />
          {homeLabel}
        </button>
      </div>
      {confirmClear && (
        <ConfirmDialog
          title={actions.clearLabel || "ล้างค่า"}
          message={actions.clearConfirm || "ล้างค่าที่แก้ไว้ในหน้านี้ทั้งหมด (ยังไม่บันทึก) — แน่ใจไหม?"}
          confirmLabel="ยืนยันล้างค่า"
          danger
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            setConfirmClear(false);
            actions.onClear?.();
          }}
        />
      )}
    </>
  );
}

// ============== กล่องยืนยัน ==============
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "ยืนยัน",
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <AlertTriangle className={`w-5 h-5 shrink-0 ${danger ? "text-rose-600" : "text-amber-600"}`} />
          <div>
            <h3 className="font-extrabold text-stone-900">{title}</h3>
            <div className="text-sm text-stone-600 mt-1">{message}</div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-bold bg-stone-100 hover:bg-stone-200 text-stone-700">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-sm font-bold text-white ${danger ? "bg-rose-600 hover:bg-rose-700" : "bg-[#1B4D31] hover:bg-[#143B25]"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============== ลิ้นชักแก้ไข (เปิดจากขวา บนมือถือเต็มจอ) ==============
export function Drawer({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/30 flex justify-end" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg h-full flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <h3 className="font-extrabold text-stone-900">{title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100" aria-label="ปิด">
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>
        {footer && <div className="border-t border-stone-200 p-4 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-stone-700 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-stone-400 mt-1">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full border border-stone-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4D31]/30 focus:border-[#1B4D31]";

// ============== ตาราง: ค้นหา + ตัวกรอง + แบ่งหน้า ==============
export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  /** ซ่อนบนจอแคบ */
  hideOnMobile?: boolean;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  search,
  searchPlaceholder = "ค้นหา",
  filters,
  pageSize = 20,
  empty = "ยังไม่มีข้อมูล",
  toolbar,
  rowClassName,
  initialFilter,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** คืนข้อความที่ใช้ค้นหาของแถว */
  search?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: { id: string; label: string; test: (row: T) => boolean }[];
  pageSize?: number;
  empty?: string;
  toolbar?: ReactNode;
  rowClassName?: (row: T) => string;
  initialFilter?: string;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(initialFilter || "all");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const f = filters?.find((x) => x.id === filter);
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => (!f || f.test(r)) && (!needle || !search || search(r).toLowerCase().includes(needle)));
  }, [rows, filters, filter, q, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * pageSize, current * pageSize + pageSize);

  return (
    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
      <div className="p-3 border-b border-stone-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {search ? (
          <div className="relative sm:w-72">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder={searchPlaceholder}
              className={`${inputCls} pl-9 py-1.5`}
            />
          </div>
        ) : (
          <span />
        )}
        {toolbar && <div className="flex flex-wrap gap-2">{toolbar}</div>}
      </div>
      {filters && filters.length > 0 && (
        <div className="px-3 py-2 border-b border-stone-100 flex gap-1.5 overflow-x-auto">
          {[{ id: "all", label: "ทั้งหมด", test: () => true }, ...filters].map((f) => {
            const count = f.id === "all" ? rows.length : rows.filter(f.test).length;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFilter(f.id);
                  setPage(0);
                }}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold border transition ${
                  filter === f.id ? "bg-[#1B4D31] text-white border-[#1B4D31]" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
                }`}
              >
                {f.label} <span className="opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-[11px] uppercase tracking-wide text-stone-500">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`text-left font-bold px-3 py-2 whitespace-nowrap ${c.hideOnMobile ? "hidden md:table-cell" : ""} ${c.className || ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {visible.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={`${onRowClick ? "cursor-pointer hover:bg-amber-50/50" : ""} ${rowClassName ? rowClassName(r) : ""}`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2 align-middle ${c.hideOnMobile ? "hidden md:table-cell" : ""} ${c.className || ""}`}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-stone-400 text-sm">
                  {rows.length === 0 ? empty : "ไม่พบรายการที่ตรงกับการค้นหา"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {filtered.length > pageSize && (
        <div className="px-3 py-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
          <span>
            {current * pageSize + 1}–{Math.min(filtered.length, (current + 1) * pageSize)} จาก {filtered.length}
          </span>
          <div className="flex gap-1">
            <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="p-1.5 rounded-lg border border-stone-200 disabled:opacity-40" aria-label="ก่อนหน้า">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="p-1.5 rounded-lg border border-stone-200 disabled:opacity-40" aria-label="ถัดไป">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== ชิ้นเล็ก ==============
export function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${className}`}>{children}</span>;
}

export function Stat({ label, value, sub, tone = "stone" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "stone" | "green" | "amber" | "rose" | "sky" }) {
  const tones = {
    stone: "text-stone-900",
    green: "text-emerald-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
    sky: "text-sky-700",
  };
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4">
      <div className="text-[11px] font-bold text-stone-500">{label}</div>
      <div className={`text-2xl font-extrabold mt-1 tabular-nums ${tones[tone]}`}>{value}</div>
      {sub && <div className="text-[11px] text-stone-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export function Section({ title, desc, right, children }: { title: string; desc?: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-white border border-stone-200 rounded-2xl">
      <div className="px-4 py-3 border-b border-stone-100 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-stone-900 text-sm">{title}</h3>
          {desc && <p className="text-[11px] text-stone-500 mt-0.5">{desc}</p>}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export const baht = (n: number) => `฿${Math.round(n || 0).toLocaleString("th-TH")}`;

export function Toast({ msg, ok, onDone }: { msg: string; ok: boolean; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className={`fixed bottom-20 md:bottom-6 right-4 z-[90] px-4 py-3 rounded-xl shadow-lg text-sm font-bold flex items-center gap-2 ${ok ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
      {ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
      {msg}
    </div>
  );
}
