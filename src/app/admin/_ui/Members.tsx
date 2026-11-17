"use client";

// สมาชิก: ตารางคนเดียวต่อแถว เห็นช่องทางที่ผูก (LINE/Google) สิทธิ์ ยอดซื้อ — เปลี่ยนสิทธิ์/ปิดบัญชีในแถว แล้วกดบันทึก
import { useCallback, useState } from "react";
import type { SafeUser } from "../../../types/durian";
import { baht, Badge, DataTable, Drawer, Field, inputCls, Toast, usePageActions, type Column } from "./kit";
import { shortDate } from "./shared";

type Role = "user" | "staff" | "admin";
type Patch = { role?: Role; isActive?: number; notes?: string };

const ROLE: Record<Role, { label: string; cls: string }> = {
  admin: { label: "เจ้าของร้าน", cls: "bg-amber-100 text-amber-900" },
  staff: { label: "พนักงาน", cls: "bg-sky-100 text-sky-800" },
  user: { label: "ลูกค้า", cls: "bg-stone-100 text-stone-600" },
};

const active = (u: SafeUser) => !(u.isActive === 0 || u.isActive === false || (u.isActive as unknown) === "0");

export function Members({ users, onSaved }: { users: SafeUser[]; onSaved: () => void }) {
  const [edits, setEdits] = useState<Record<string, Patch>>({});
  const [open, setOpen] = useState<SafeUser | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const saveAll = useCallback(async () => {
    const failed: string[] = [];
    for (const [userId, p] of Object.entries(edits)) {
      const res = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, ...p }) }).catch(() => null);
      const j = res ? await res.json().catch(() => ({})) : {};
      if (!res || !res.ok || !j.ok) failed.push(userId);
    }
    setEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => failed.includes(id))));
    setToast(failed.length ? { msg: `บันทึกไม่สำเร็จ: ${failed.join(", ")}`, ok: false } : { msg: "บันทึกสมาชิกแล้ว", ok: true });
    onSaved();
  }, [edits, onSaved]);

  usePageActions({
    dirty: Object.keys(edits).length,
    onSave: saveAll,
    onClear: useCallback(() => setEdits({}), []),
    clearLabel: "ล้างค่าที่แก้",
    clearConfirm: "ทิ้งสิทธิ์/สถานะที่แก้แต่ยังไม่บันทึก?",
  });

  const setEdit = (id: string, p: Patch) => setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  const roleOf = (u: SafeUser): Role => (edits[u.id]?.role ?? (u.role as Role)) || "user";
  const activeOf = (u: SafeUser) => (edits[u.id]?.isActive !== undefined ? edits[u.id].isActive === 1 : active(u));
  const name = (u: SafeUser) => [u.firstName, u.lastName].filter(Boolean).join(" ") || u.displayName || u.id;

  const columns: Column<SafeUser>[] = [
    {
      key: "who",
      header: "สมาชิก",
      render: (u) => (
        <div className="flex items-center gap-2.5 min-w-[170px]">
          {u.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={u.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover border border-stone-200 shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-stone-100 shrink-0 flex items-center justify-center text-xs font-bold text-stone-500">{name(u).slice(0, 1)}</div>
          )}
          <div className="min-w-0">
            <div className="font-semibold truncate">{name(u)}</div>
            <div className="text-[11px] text-stone-400 truncate">{u.phone || u.email || u.id}</div>
          </div>
        </div>
      ),
    },
    {
      key: "login",
      header: "เข้าระบบด้วย",
      hideOnMobile: true,
      render: (u) => (
        <div className="flex gap-1">
          {u.lineUserId && <Badge className="bg-[#06C755]/15 text-[#047a34]">LINE</Badge>}
          {u.googleId && <Badge className="bg-blue-50 text-blue-700">Google</Badge>}
          {!u.lineUserId && <Badge className="bg-rose-50 text-rose-700">ยังไม่ผูก LINE</Badge>}
        </div>
      ),
    },
    {
      key: "role",
      header: "สิทธิ์",
      render: (u) => (
        <select
          value={roleOf(u)}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setEdit(u.id, { role: e.target.value as Role })}
          className={`border border-stone-200 rounded-lg px-2 py-1 text-xs font-bold bg-white ${edits[u.id]?.role ? "ring-2 ring-amber-300" : ""}`}
        >
          {(Object.keys(ROLE) as Role[]).map((r) => (
            <option key={r} value={r}>
              {ROLE[r].label}
            </option>
          ))}
        </select>
      ),
    },
    { key: "orders", header: "ออเดอร์", className: "text-right", hideOnMobile: true, render: (u) => <span className="tabular-nums">{u.orderCount || 0}</span> },
    { key: "spent", header: "ยอดซื้อ", className: "text-right", hideOnMobile: true, render: (u) => <span className="tabular-nums">{baht(u.totalSpent || 0)}</span> },
    { key: "last", header: "เข้าล่าสุด", hideOnMobile: true, render: (u) => <span className="text-xs text-stone-500">{shortDate(u.lastLoginAt)}</span> },
  ];

  return (
    <>
      <DataTable
        rows={users}
        columns={columns}
        rowKey={(u) => u.id}
        onRowClick={setOpen}
        search={(u) => `${u.id} ${name(u)} ${u.displayName || ""} ${u.phone} ${u.email || ""}`}
        searchPlaceholder="ค้นหาชื่อ เบอร์ อีเมล"
        filters={[
          { id: "admin", label: "เจ้าของร้าน", test: (u) => u.role === "admin" },
          { id: "staff", label: "พนักงาน", test: (u) => u.role === "staff" },
          { id: "user", label: "ลูกค้า", test: (u) => u.role === "user" },
          { id: "noline", label: "ยังไม่ผูก LINE", test: (u) => !u.lineUserId },
          { id: "off", label: "ปิดบัญชี", test: (u) => !active(u) },
        ]}
        rowClassName={(u) => (activeOf(u) ? "" : "opacity-50")}
        empty="ยังไม่มีสมาชิก"
      />
      {open && (
        <Drawer title={name(open)} onClose={() => setOpen(null)}>
          <div className="flex flex-wrap gap-1.5">
            <Badge className={ROLE[roleOf(open)].cls}>{ROLE[roleOf(open)].label}</Badge>
            {open.lineUserId && <Badge className="bg-[#06C755]/15 text-[#047a34]">LINE</Badge>}
            {open.googleId && <Badge className="bg-blue-50 text-blue-700">Google</Badge>}
          </div>
          <dl className="text-sm grid grid-cols-3 gap-y-2">
            <dt className="text-stone-500">รหัส</dt>
            <dd className="col-span-2 font-mono text-xs">{open.id}</dd>
            <dt className="text-stone-500">ชื่อที่แสดง</dt>
            <dd className="col-span-2">{open.displayName || "-"}</dd>
            <dt className="text-stone-500">เบอร์</dt>
            <dd className="col-span-2">{open.phone || "-"}</dd>
            <dt className="text-stone-500">อีเมล</dt>
            <dd className="col-span-2">{open.email || "-"}</dd>
            <dt className="text-stone-500">ที่อยู่</dt>
            <dd className="col-span-2 whitespace-pre-wrap">{[open.address, open.postalCode].filter(Boolean).join(" ") || "-"}</dd>
            <dt className="text-stone-500">ซื้อแล้ว</dt>
            <dd className="col-span-2">
              {open.orderCount || 0} ออเดอร์ · {baht(open.totalSpent || 0)}
            </dd>
            <dt className="text-stone-500">สมัครเมื่อ</dt>
            <dd className="col-span-2">{shortDate(open.createdAt)}</dd>
          </dl>
          <Field label="สิทธิ์">
            <select className={inputCls} value={roleOf(open)} onChange={(e) => setEdit(open.id, { role: e.target.value as Role })}>
              {(Object.keys(ROLE) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE[r].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="หมายเหตุ">
            <textarea className={`${inputCls} min-h-16`} value={edits[open.id]?.notes ?? open.notes ?? ""} onChange={(e) => setEdit(open.id, { notes: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={activeOf(open)} onChange={(e) => setEdit(open.id, { isActive: e.target.checked ? 1 : 0 })} />
            บัญชีใช้งานได้ (เอาติ๊กออก = ปิดบัญชี เข้าระบบไม่ได้)
          </label>
          <p className="text-[11px] text-stone-400">แก้แล้วกด บันทึก ที่แถบด้านบน</p>
        </Drawer>
      )}
      {toast && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}
    </>
  );
}
