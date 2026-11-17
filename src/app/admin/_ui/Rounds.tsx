"use client";

// รอบรถ + ต้นทุนล็อต: ตารางรอบ (เปลี่ยนสถานะ/โควต้าในแถว แล้วกดบันทึกทีเดียว) และตารางต้นทุนรับของแต่ละรอบ
import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { LotCost, Order, Round } from "../../../types/durian";
import { baht, Badge, DataTable, Drawer, Field, inputCls, Toast, usePageActions, type Column } from "./kit";
import { isCancelled } from "./shared";

const ROUND_STATUS: { id: Round["status"]; label: string; cls: string }[] = [
  { id: "open", label: "เปิดรับจอง", cls: "bg-emerald-100 text-emerald-800" },
  { id: "closed", label: "ปิดรับจอง", cls: "bg-stone-200 text-stone-700" },
  { id: "shipping", label: "กำลังส่ง", cls: "bg-indigo-100 text-indigo-800" },
  { id: "done", label: "จบรอบ", cls: "bg-sky-100 text-sky-800" },
];

type RoundForm = Partial<Round>;
type LotForm = Partial<LotCost>;

export function Rounds({
  rounds,
  lots,
  orders,
  onRoundCreated,
  onRoundUpdated,
  onLotCreated,
}: {
  rounds: Round[];
  lots: LotCost[];
  orders: Order[];
  onRoundCreated: (r: Round) => void;
  onRoundUpdated: (r: Round) => void;
  onLotCreated: (l: LotCost) => void;
}) {
  const [view, setView] = useState<"rounds" | "lots">("rounds");
  const [edits, setEdits] = useState<Record<string, RoundForm>>({});
  const [roundDrawer, setRoundDrawer] = useState<{ id?: string; form: RoundForm } | null>(null);
  const [lotDrawer, setLotDrawer] = useState<LotForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const ordersByRound = useMemo(() => {
    const m: Record<string, number> = {};
    orders.filter((o) => !isCancelled(o)).forEach((o) => (m[o.roundId] = (m[o.roundId] || 0) + 1));
    return m;
  }, [orders]);
  const costByRound = useMemo(() => {
    const m: Record<string, number> = {};
    lots.forEach((l) => (m[l.roundId] = (m[l.roundId] || 0) + (l.totalFruitCost || 0) + (l.packagingCost || 0) + (l.truckFuelCost || 0)));
    return m;
  }, [lots]);

  const patchRound = async (id: string, patch: RoundForm) => {
    const res = await fetch(`/api/rounds/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error(j.error || "บันทึกรอบไม่สำเร็จ");
    return j.round as Round;
  };

  const saveAll = useCallback(async () => {
    const failed: string[] = [];
    for (const [id, patch] of Object.entries(edits)) {
      try {
        onRoundUpdated(await patchRound(id, patch));
      } catch {
        failed.push(id);
      }
    }
    setEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => failed.includes(id))));
    setToast(failed.length ? { msg: `บันทึกไม่สำเร็จ: ${failed.join(", ")}`, ok: false } : { msg: "บันทึกรอบแล้ว", ok: true });
  }, [edits, onRoundUpdated]);

  usePageActions({
    dirty: Object.keys(edits).length,
    onSave: saveAll,
    onClear: useCallback(() => setEdits({}), []),
    clearLabel: "ล้างค่าที่แก้",
    clearConfirm: "ทิ้งสถานะ/โควต้าที่แก้ในตารางแต่ยังไม่บันทึก?",
  });

  const val = <K extends keyof Round>(r: Round, k: K): Round[K] => (edits[r.id] && k in edits[r.id] ? (edits[r.id][k] as Round[K]) : r[k]);
  const setEdit = (id: string, patch: RoundForm) => setEdits((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
  const ring = (r: Round, k: keyof Round) => (edits[r.id] && k in edits[r.id] ? "ring-2 ring-amber-300" : "");

  const roundCols: Column<Round>[] = [
    {
      key: "name",
      header: "รอบ",
      render: (r) => (
        <div className="min-w-[160px]">
          <div className="font-semibold">{r.name}</div>
          <div className="text-[11px] text-stone-400">
            {r.id}
            {r.deliveryDate ? ` · ส่ง ${r.deliveryDate}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "สถานะ",
      render: (r) => (
        <select
          value={val(r, "status")}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setEdit(r.id, { status: e.target.value as Round["status"] })}
          className={`border border-stone-200 rounded-lg px-2 py-1 text-xs font-bold bg-white ${ring(r, "status")}`}
        >
          {ROUND_STATUS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "quota",
      header: "โควต้าเหลือ / ทั้งหมด",
      render: (r) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <input
            type="number"
            value={val(r, "quotaRemaining") ?? 0}
            onChange={(e) => setEdit(r.id, { quotaRemaining: Number(e.target.value) || 0 })}
            className={`w-16 border border-stone-200 rounded-lg px-2 py-1 text-sm tabular-nums ${ring(r, "quotaRemaining")}`}
          />
          <span className="text-stone-400">/</span>
          <input
            type="number"
            value={val(r, "totalQuota") ?? 0}
            onChange={(e) => setEdit(r.id, { totalQuota: Number(e.target.value) || 0 })}
            className={`w-16 border border-stone-200 rounded-lg px-2 py-1 text-sm tabular-nums ${ring(r, "totalQuota")}`}
          />
        </div>
      ),
    },
    { key: "orders", header: "ออเดอร์", className: "text-right", render: (r) => <span className="tabular-nums">{ordersByRound[r.id] || 0}</span> },
    { key: "cost", header: "ต้นทุน", className: "text-right", hideOnMobile: true, render: (r) => <span className="tabular-nums">{baht(costByRound[r.id] || 0)}</span> },
  ];

  const lotCols: Column<LotCost>[] = [
    {
      key: "lot",
      header: "ล็อต",
      render: (l) => (
        <div>
          <div className="font-mono text-xs font-bold">{l.lotId}</div>
          <div className="text-[11px] text-stone-400">{l.date}</div>
        </div>
      ),
    },
    { key: "supplier", header: "สวน/ผู้ขาย", render: (l) => <span className="font-semibold">{l.supplierName}</span> },
    { key: "round", header: "รอบ", hideOnMobile: true, render: (l) => <Badge className="bg-stone-100 text-stone-600">{rounds.find((r) => r.id === l.roundId)?.name || l.roundId || "-"}</Badge> },
    { key: "kg", header: "กก.", className: "text-right", render: (l) => <span className="tabular-nums">{l.weightKg}</span> },
    { key: "perkg", header: "฿/กก.", className: "text-right", hideOnMobile: true, render: (l) => <span className="tabular-nums">{l.costPerKg}</span> },
    {
      key: "total",
      header: "ต้นทุนรวม",
      className: "text-right",
      render: (l) => <span className="font-bold tabular-nums">{baht((l.totalFruitCost || 0) + (l.packagingCost || 0) + (l.truckFuelCost || 0))}</span>,
    },
  ];

  const submitRound = async () => {
    if (!roundDrawer) return;
    const f = roundDrawer.form;
    if (!f.name?.trim()) return setToast({ msg: "ใส่ชื่อรอบก่อน", ok: false });
    setBusy(true);
    try {
      if (roundDrawer.id) onRoundUpdated(await patchRound(roundDrawer.id, f));
      else {
        const res = await fetch("/api/rounds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
        const j = await res.json();
        if (!res.ok || !j.ok) throw new Error(j.error || "สร้างรอบไม่สำเร็จ");
        onRoundCreated(j.round);
      }
      setRoundDrawer(null);
      setToast({ msg: "บันทึกรอบแล้ว", ok: true });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : String(e), ok: false });
    } finally {
      setBusy(false);
    }
  };

  const submitLot = async () => {
    if (!lotDrawer) return;
    if (!lotDrawer.supplierName?.trim() || !lotDrawer.weightKg || !lotDrawer.costPerKg) return setToast({ msg: "ใส่ชื่อสวน น้ำหนัก และต้นทุน/กก.", ok: false });
    setBusy(true);
    try {
      const res = await fetch("/api/lots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lotDrawer) });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "บันทึกต้นทุนไม่สำเร็จ");
      onLotCreated(j.lot);
      setLotDrawer(null);
      setToast({ msg: "บันทึกต้นทุนแล้ว", ok: true });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : String(e), ok: false });
    } finally {
      setBusy(false);
    }
  };

  const rf = roundDrawer?.form || {};
  const setRf = (p: RoundForm) => setRoundDrawer((d) => (d ? { ...d, form: { ...d.form, ...p } } : d));
  const lf = lotDrawer || {};
  const setLf = (p: LotForm) => setLotDrawer((d) => ({ ...(d || {}), ...p }));
  const lotFruit = (Number(lf.weightKg) || 0) * (Number(lf.costPerKg) || 0);

  const footer = (onSave: () => void, onCancel: () => void, label: string) => (
    <>
      <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-bold bg-stone-100 text-stone-700">
        ยกเลิก
      </button>
      <button type="button" disabled={busy} onClick={onSave} className="px-4 py-2 rounded-xl text-sm font-bold bg-[#1B4D31] text-white disabled:opacity-50">
        {busy ? "กำลังบันทึก..." : label}
      </button>
    </>
  );

  return (
    <div className="space-y-3">
      <div className="inline-flex bg-white border border-stone-200 rounded-xl p-1">
        {[
          { id: "rounds" as const, label: `รอบรถ (${rounds.length})` },
          { id: "lots" as const, label: `ต้นทุนล็อต (${lots.length})` },
        ].map((t) => (
          <button key={t.id} type="button" onClick={() => setView(t.id)} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${view === t.id ? "bg-[#1B4D31] text-white" : "text-stone-600"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {view === "rounds" ? (
        <DataTable
          rows={rounds}
          columns={roundCols}
          rowKey={(r) => r.id}
          onRowClick={(r) => setRoundDrawer({ id: r.id, form: { ...r } })}
          search={(r) => `${r.id} ${r.name} ${r.truckRoute}`}
          searchPlaceholder="ค้นหารอบ"
          filters={ROUND_STATUS.map((s) => ({ id: s.id, label: s.label, test: (r: Round) => r.status === s.id }))}
          empty="ยังไม่มีรอบ — กด สร้างรอบ"
          toolbar={
            <button type="button" onClick={() => setRoundDrawer({ form: { status: "open" } })} className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-500 text-stone-900 px-3 py-1.5 rounded-xl text-xs font-bold">
              <Plus className="w-3.5 h-3.5" /> สร้างรอบ
            </button>
          }
        />
      ) : (
        <DataTable
          rows={lots}
          columns={lotCols}
          rowKey={(l) => l.lotId}
          search={(l) => `${l.lotId} ${l.supplierName} ${l.variety} ${l.roundId}`}
          searchPlaceholder="ค้นหาล็อต สวน"
          filters={rounds.map((r) => ({ id: r.id, label: r.name || r.id, test: (l: LotCost) => l.roundId === r.id }))}
          empty="ยังไม่มีต้นทุน — กด บันทึกต้นทุน"
          toolbar={
            <button type="button" onClick={() => setLotDrawer({ date: new Date().toISOString().slice(0, 10), roundId: rounds[0]?.id || "" })} className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-500 text-stone-900 px-3 py-1.5 rounded-xl text-xs font-bold">
              <Plus className="w-3.5 h-3.5" /> บันทึกต้นทุน
            </button>
          }
        />
      )}

      {roundDrawer && (
        <Drawer title={roundDrawer.id ? `แก้ไขรอบ ${roundDrawer.id}` : "สร้างรอบ"} onClose={() => setRoundDrawer(null)} footer={footer(submitRound, () => setRoundDrawer(null), "บันทึกรอบ")}>
          <Field label="ชื่อรอบ *">
            <input className={inputCls} value={rf.name || ""} onChange={(e) => setRf({ name: e.target.value })} placeholder="เช่น รอบ 22 พ.ย." />
          </Field>
          <Field label="เส้นทางรถ">
            <input className={inputCls} value={rf.truckRoute || ""} onChange={(e) => setRf({ truckRoute: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="วันตัด">
              <input className={inputCls} value={rf.harvestDate || ""} onChange={(e) => setRf({ harvestDate: e.target.value })} />
            </Field>
            <Field label="ปิดรับจอง">
              <input className={inputCls} value={rf.closeDate || ""} onChange={(e) => setRf({ closeDate: e.target.value })} />
            </Field>
            <Field label="วันส่ง">
              <input className={inputCls} value={rf.deliveryDate || ""} onChange={(e) => setRf({ deliveryDate: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="โควต้า (ลูก)">
              <input type="number" className={inputCls} value={rf.totalQuota ?? ""} onChange={(e) => setRf({ totalQuota: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="คงเหลือ">
              <input type="number" className={inputCls} value={rf.quotaRemaining ?? ""} onChange={(e) => setRf({ quotaRemaining: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="สถานะ">
              <select className={inputCls} value={rf.status || "open"} onChange={(e) => setRf({ status: e.target.value as Round["status"] })}>
                {ROUND_STATUS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Drawer>
      )}

      {lotDrawer && (
        <Drawer title="บันทึกต้นทุนล็อต" onClose={() => setLotDrawer(null)} footer={footer(submitLot, () => setLotDrawer(null), "บันทึกต้นทุน")}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="รอบ">
              <select className={inputCls} value={lf.roundId || ""} onChange={(e) => setLf({ roundId: e.target.value })}>
                <option value="">— ไม่ระบุ —</option>
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name || r.id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="วันที่รับของ">
              <input type="date" className={inputCls} value={lf.date || ""} onChange={(e) => setLf({ date: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="สวน/ผู้ขาย *">
              <input className={inputCls} value={lf.supplierName || ""} onChange={(e) => setLf({ supplierName: e.target.value })} />
            </Field>
            <Field label="เบอร์ผู้ขาย">
              <input className={inputCls} inputMode="tel" value={lf.supplierPhone || ""} onChange={(e) => setLf({ supplierPhone: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="สายพันธุ์">
              <input className={inputCls} value={lf.variety || ""} onChange={(e) => setLf({ variety: e.target.value })} />
            </Field>
            <Field label="น้ำหนัก (กก.) *">
              <input type="number" inputMode="decimal" className={inputCls} value={lf.weightKg ?? ""} onChange={(e) => setLf({ weightKg: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="ต้นทุน/กก. *">
              <input type="number" inputMode="decimal" className={inputCls} value={lf.costPerKg ?? ""} onChange={(e) => setLf({ costPerKg: Number(e.target.value) || 0 })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ค่ากล่อง/แพ็ก">
              <input type="number" inputMode="decimal" className={inputCls} value={lf.packagingCost ?? ""} onChange={(e) => setLf({ packagingCost: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="ค่ารถ/น้ำมัน">
              <input type="number" inputMode="decimal" className={inputCls} value={lf.truckFuelCost ?? ""} onChange={(e) => setLf({ truckFuelCost: Number(e.target.value) || 0 })} />
            </Field>
          </div>
          <Field label="หมายเหตุ">
            <input className={inputCls} value={lf.notes || ""} onChange={(e) => setLf({ notes: e.target.value })} />
          </Field>
          <div className="bg-stone-50 rounded-xl p-3 text-sm flex justify-between">
            <span>รวมต้นทุนล็อตนี้</span>
            <span className="font-extrabold tabular-nums">{baht(lotFruit + (Number(lf.packagingCost) || 0) + (Number(lf.truckFuelCost) || 0))}</span>
          </div>
        </Drawer>
      )}
      {toast && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}
    </div>
  );
}
