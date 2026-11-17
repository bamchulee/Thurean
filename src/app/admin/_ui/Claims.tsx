"use client";

// ศูนย์เคลม: ตารางเคลม เปลี่ยนผลพิจารณาในแถว (บันทึกทีเดียว) กดแถวดูรายละเอียด/รูปหลักฐาน/บันทึกการแก้ไข
import { useCallback, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { Claim, ClaimStatus } from "../../../types/durian";
import { Badge, DataTable, Drawer, Field, inputCls, Toast, usePageActions, type Column } from "./kit";
import { shortDate } from "./shared";

const STATUS: { id: ClaimStatus; label: string; cls: string }[] = [
  { id: "pending", label: "รอตรวจสอบ", cls: "bg-amber-100 text-amber-900" },
  { id: "approved_replace", label: "ส่งลูกใหม่", cls: "bg-emerald-100 text-emerald-800" },
  { id: "approved_refund", label: "คืนเงิน", cls: "bg-sky-100 text-sky-800" },
  { id: "rejected", label: "ไม่อนุมัติ", cls: "bg-stone-200 text-stone-700" },
];

type Patch = { status?: ClaimStatus; resolutionNote?: string };

function photos(c: Claim): string[] {
  const raw = c.evidencePhotos as unknown;
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return raw.split(/[\s,]+/).filter(Boolean);
    }
  }
  return [];
}

export function Claims({ claims, onUpdated }: { claims: Claim[]; onUpdated: (c: Claim) => void }) {
  const [edits, setEdits] = useState<Record<string, Patch>>({});
  const [open, setOpen] = useState<Claim | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const patch = async (id: string, p: Patch) => {
    const res = await fetch(`/api/claims/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error(j.error || "บันทึกไม่สำเร็จ");
    return (j.claim as Claim) || ({ ...claims.find((c) => c.claimId === id), ...p } as Claim);
  };

  const saveAll = useCallback(async () => {
    const failed: string[] = [];
    for (const [id, p] of Object.entries(edits)) {
      try {
        onUpdated(await patch(id, p));
      } catch {
        failed.push(id);
      }
    }
    setEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => failed.includes(id))));
    setToast(failed.length ? { msg: `บันทึกไม่สำเร็จ: ${failed.join(", ")}`, ok: false } : { msg: "บันทึกผลเคลมแล้ว", ok: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edits, onUpdated]);

  usePageActions({
    dirty: Object.keys(edits).length,
    onSave: saveAll,
    onClear: useCallback(() => setEdits({}), []),
    clearLabel: "ล้างค่าที่แก้",
    clearConfirm: "ทิ้งผลพิจารณา/บันทึกที่แก้แต่ยังไม่บันทึก?",
  });

  const setEdit = (id: string, p: Patch) => setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  const statusOf = (c: Claim) => edits[c.claimId]?.status ?? c.status;
  const noteOf = (c: Claim) => edits[c.claimId]?.resolutionNote ?? c.resolutionNote ?? "";

  const columns: Column<Claim>[] = [
    {
      key: "id",
      header: "เคลม",
      render: (c) => (
        <div>
          <div className="font-mono text-xs font-bold">{c.claimId}</div>
          <div className="text-[11px] text-stone-400">{shortDate(c.createdAt || c.createDate)}</div>
        </div>
      ),
    },
    {
      key: "who",
      header: "ลูกค้า / ออเดอร์",
      render: (c) => (
        <div className="min-w-0 max-w-[180px]">
          <div className="font-semibold truncate">{c.customerName || c.phone || "-"}</div>
          <a href={`/admin/orders/${encodeURIComponent(c.orderId)}`} onClick={(e) => e.stopPropagation()} className="text-[11px] font-mono text-[#1B4D31] underline">
            {c.orderId}
          </a>
        </div>
      ),
    },
    { key: "reason", header: "เหตุผล", hideOnMobile: true, render: (c) => <div className="max-w-[240px] truncate text-stone-700">{c.reason}</div> },
    { key: "photos", header: "รูป", hideOnMobile: true, className: "text-center", render: (c) => <span className="tabular-nums">{photos(c).length}</span> },
    {
      key: "status",
      header: "ผลพิจารณา",
      render: (c) => (
        <select
          value={statusOf(c)}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setEdit(c.claimId, { status: e.target.value as ClaimStatus })}
          className={`border border-stone-200 rounded-lg px-2 py-1 text-xs font-bold bg-white ${edits[c.claimId]?.status ? "ring-2 ring-amber-300" : ""}`}
        >
          {STATUS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      ),
    },
  ];

  return (
    <>
      <DataTable
        rows={[...claims].sort((a, b) => String(b.createdAt || b.createDate || "").localeCompare(String(a.createdAt || a.createDate || "")))}
        columns={columns}
        rowKey={(c) => c.claimId}
        onRowClick={setOpen}
        search={(c) => `${c.claimId} ${c.orderId} ${c.customerName || ""} ${c.phone} ${c.reason}`}
        searchPlaceholder="ค้นหาเคลม ออเดอร์ ชื่อ เบอร์"
        filters={STATUS.map((s) => ({ id: s.id, label: s.label, test: (c: Claim) => c.status === s.id }))}
        initialFilter="pending"
        empty="ยังไม่มีการแจ้งเคลม"
      />
      {open && (
        <Drawer title={`เคลม ${open.claimId}`} onClose={() => setOpen(null)}>
          <div className="flex flex-wrap gap-2">
            {STATUS.filter((s) => s.id === statusOf(open)).map((s) => (
              <Badge key={s.id} className={s.cls}>
                {s.label}
              </Badge>
            ))}
            {open.ripenessType && <Badge className="bg-stone-100 text-stone-600">{open.ripenessType === "ready_to_eat" ? "สุกพร้อมทาน" : "บ่มเอง"}</Badge>}
          </div>
          <dl className="text-sm grid grid-cols-3 gap-y-2">
            <dt className="text-stone-500">ลูกค้า</dt>
            <dd className="col-span-2 font-semibold">
              {open.customerName || "-"} {open.phone && <span className="text-stone-500 font-normal">· {open.phone}</span>}
            </dd>
            <dt className="text-stone-500">ออเดอร์</dt>
            <dd className="col-span-2">
              <a href={`/admin/orders/${encodeURIComponent(open.orderId)}`} className="font-mono text-[#1B4D31] underline">
                {open.orderId}
              </a>
            </dd>
            <dt className="text-stone-500">ส่งถึงเมื่อ</dt>
            <dd className="col-span-2">{shortDate(open.deliveredAt)}</dd>
            <dt className="text-stone-500">เหตุผล</dt>
            <dd className="col-span-2">{open.reason}</dd>
            <dt className="text-stone-500">รายละเอียด</dt>
            <dd className="col-span-2 whitespace-pre-wrap">{open.description || "-"}</dd>
          </dl>
          {photos(open).length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos(open).map((src) => (
                <a key={src} href={src} target="_blank" rel="noreferrer" className="relative block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="หลักฐาน" className="w-full aspect-square object-cover rounded-xl border border-stone-200" />
                  <ExternalLink className="w-3.5 h-3.5 absolute top-1.5 right-1.5 text-white drop-shadow" />
                </a>
              ))}
            </div>
          )}
          <Field label="ผลพิจารณา">
            <select className={inputCls} value={statusOf(open)} onChange={(e) => setEdit(open.claimId, { status: e.target.value as ClaimStatus })}>
              {STATUS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="บันทึกการแก้ไข" hint="กด บันทึก ที่แถบด้านบนเพื่อบันทึกจริง">
            <textarea className={`${inputCls} min-h-20`} value={noteOf(open)} onChange={(e) => setEdit(open.claimId, { resolutionNote: e.target.value })} />
          </Field>
        </Drawer>
      )}
      {toast && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}
    </>
  );
}
