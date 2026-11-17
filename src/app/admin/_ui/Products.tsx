"use client";

// จัดการสินค้า: ตารางแก้ราคา/สต็อก/เปิดปิดขายได้ในแถว (กด "บันทึก" ด้านบนทีเดียว) + ลิ้นชักแก้รายละเอียดเต็ม
import { useCallback, useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { Product } from "../../../types/durian";
import { Badge, DataTable, Drawer, Field, inputCls, Toast, usePageActions, type Column } from "./kit";

type Patch = Partial<Product>;

const EMPTY: Patch = { name: "", productType: "รับคัดลูก", unit: "ลูก", isAvailable: true, type: "whole" };

export function Products({
  products,
  onUpdated,
  onCreated,
}: {
  products: Product[];
  onUpdated: (p: Product) => void;
  onCreated: (p: Product) => void;
}) {
  const [edits, setEdits] = useState<Record<string, Patch>>({});
  const [editing, setEditing] = useState<{ id?: string; form: Patch } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const customCols = useMemo(() => Array.from(new Set(products.flatMap((p) => Object.keys(p.custom || {})))), [products]);

  const setEdit = (id: string, patch: Patch) =>
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const val = <K extends keyof Product>(p: Product, k: K): Product[K] =>
    (edits[p.id] && k in edits[p.id] ? (edits[p.id][k] as Product[K]) : p[k]);

  const patchProduct = async (id: string, patch: Patch): Promise<Product> => {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error(j.error || "บันทึกไม่สำเร็จ");
    return j.product as Product;
  };

  const saveAll = useCallback(async () => {
    const ids = Object.keys(edits);
    let ok = 0;
    const failed: string[] = [];
    for (const id of ids) {
      try {
        onUpdated(await patchProduct(id, edits[id]));
        ok++;
      } catch {
        failed.push(id);
      }
    }
    setEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => failed.includes(id))));
    setToast(failed.length ? { msg: `บันทึก ${ok} รายการ ไม่สำเร็จ ${failed.join(", ")}`, ok: false } : { msg: `บันทึกสินค้า ${ok} รายการแล้ว`, ok: true });
  }, [edits, onUpdated]);

  const clear = useCallback(() => setEdits({}), []);
  usePageActions({
    dirty: Object.keys(edits).length,
    onSave: saveAll,
    onClear: clear,
    clearLabel: "ล้างค่าที่แก้",
    clearConfirm: "ทิ้งราคา/สต็อกที่แก้ในตารางแต่ยังไม่บันทึกทั้งหมด?",
  });

  const submitDrawer = async () => {
    if (!editing) return;
    const f = editing.form;
    if (!f.name?.trim() || !(Number(f.pricePerKg) > 0)) {
      setToast({ msg: "ใส่ชื่อสินค้าและราคาต่อกิโลก่อน", ok: false });
      return;
    }
    setBusy(true);
    try {
      if (editing.id) {
        onUpdated(await patchProduct(editing.id, f));
      } else {
        const res = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
        const j = await res.json();
        if (!res.ok || !j.ok) throw new Error(j.error || "เพิ่มสินค้าไม่สำเร็จ");
        onCreated(j.product);
      }
      setEditing(null);
      setToast({ msg: "บันทึกสินค้าแล้ว", ok: true });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : String(e), ok: false });
    } finally {
      setBusy(false);
    }
  };

  const num = (v: string) => (v === "" ? undefined : Number(v));
  const dirtyCls = (p: Product, k: keyof Product) => (edits[p.id] && k in edits[p.id] ? "ring-2 ring-amber-300" : "");

  const columns: Column<Product>[] = [
    {
      key: "name",
      header: "สินค้า",
      render: (p) => (
        <div className="flex items-center gap-2.5 min-w-[180px]">
          {p.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover border border-stone-200 shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-stone-100 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-semibold truncate">{p.name}</div>
            <div className="text-[11px] text-stone-400 truncate">
              {p.id} · {[p.variety, p.grade].filter(Boolean).join(" · ") || "-"}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "price",
      header: "฿/กก.",
      render: (p) => (
        <input
          type="number"
          inputMode="numeric"
          value={val(p, "pricePerKg") ?? ""}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setEdit(p.id, { pricePerKg: num(e.target.value) })}
          className={`w-20 border border-stone-200 rounded-lg px-2 py-1 text-sm tabular-nums ${dirtyCls(p, "pricePerKg")}`}
        />
      ),
    },
    {
      key: "stock",
      header: "สต็อก (ลูก)",
      render: (p) => (
        <input
          type="number"
          inputMode="numeric"
          placeholder="ไม่นับ"
          value={val(p, "stockQty") ?? ""}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setEdit(p.id, { stockQty: num(e.target.value) })}
          className={`w-20 border border-stone-200 rounded-lg px-2 py-1 text-sm tabular-nums ${dirtyCls(p, "stockQty")}`}
        />
      ),
    },
    {
      key: "available",
      header: "ขาย",
      render: (p) => {
        const on = val(p, "isAvailable") !== false;
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEdit(p.id, { isAvailable: !on });
            }}
            className={`relative w-10 h-6 rounded-full transition ${on ? "bg-emerald-500" : "bg-stone-300"} ${dirtyCls(p, "isAvailable")}`}
            aria-label={on ? "ปิดการขาย" : "เปิดการขาย"}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition ${on ? "left-[18px]" : "left-0.5"}`} />
          </button>
        );
      },
    },
    {
      key: "type",
      header: "ประเภท",
      hideOnMobile: true,
      render: (p) => <Badge className="bg-stone-100 text-stone-600">{p.productType || "-"}</Badge>,
    },
    {
      key: "edit",
      header: "",
      className: "text-right",
      render: (p) => (
        <button type="button" className="p-1.5 rounded-lg hover:bg-stone-100" aria-label="แก้ไขรายละเอียด">
          <Pencil className="w-4 h-4 text-stone-500" />
        </button>
      ),
    },
  ];

  const f = editing?.form || {};
  const setF = (patch: Patch) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));
  const text = (k: keyof Product, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <input className={inputCls} value={(f[k] as string) ?? ""} onChange={(e) => setF({ [k]: e.target.value } as Patch)} />
    </Field>
  );
  const number = (k: keyof Product, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <input type="number" inputMode="decimal" className={inputCls} value={(f[k] as number) ?? ""} onChange={(e) => setF({ [k]: num(e.target.value) } as Patch)} />
    </Field>
  );

  return (
    <>
      <DataTable
        rows={products}
        columns={columns}
        rowKey={(p) => p.id}
        onRowClick={(p) => setEditing({ id: p.id, form: { ...p } })}
        search={(p) => `${p.id} ${p.name} ${p.variety || ""} ${p.grade || ""}`}
        searchPlaceholder="ค้นหาสินค้า"
        filters={[
          { id: "on", label: "เปิดขาย", test: (p) => p.isAvailable !== false },
          { id: "off", label: "ปิดขาย", test: (p) => p.isAvailable === false },
          { id: "low", label: "ใกล้หมด", test: (p) => typeof p.stockQty === "number" && p.stockQty <= 2 },
        ]}
        empty="ยังไม่มีสินค้า — กด เพิ่มสินค้า"
        toolbar={
          <button
            type="button"
            onClick={() => setEditing({ form: { ...EMPTY } })}
            className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-500 text-stone-900 px-3 py-1.5 rounded-xl text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" /> เพิ่มสินค้า
          </button>
        }
      />

      {editing && (
        <Drawer
          title={editing.id ? `แก้ไข ${editing.id}` : "เพิ่มสินค้า"}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl text-sm font-bold bg-stone-100 text-stone-700">
                ยกเลิก
              </button>
              <button type="button" disabled={busy} onClick={submitDrawer} className="px-4 py-2 rounded-xl text-sm font-bold bg-[#1B4D31] text-white disabled:opacity-50">
                {busy ? "กำลังบันทึก..." : "บันทึกสินค้า"}
              </button>
            </>
          }
        >
          {text("name", "ชื่อสินค้า *")}
          <div className="grid grid-cols-2 gap-3">
            {number("pricePerKg", "ราคาต่อกิโล (บาท) *")}
            {number("marketPrice", "ราคาตลาด/กก.", "โชว์ขีดฆ่า ว่างได้")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ประเภทการขาย">
              <select className={inputCls} value={f.productType || ""} onChange={(e) => setF({ productType: e.target.value })}>
                <option value="รับคัดลูก">รับคัดลูก</option>
                <option value="รับมาเป็นโลแล้วขายเลย">รับมาเป็นโลแล้วขายเลย</option>
              </select>
            </Field>
            <Field label="ลักษณะ">
              <select className={inputCls} value={f.type || "whole"} onChange={(e) => setF({ type: e.target.value === "flesh" ? "flesh" : "whole" })}>
                <option value="whole">ทั้งลูก</option>
                <option value="flesh">แกะเนื้อ</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {text("variety", "สายพันธุ์")}
            {text("grade", "เกรด/ไซส์")}
            {text("maturity", "ความสุก")}
            {text("texture", "เนื้อสัมผัส")}
            {text("weight", "น้ำหนักต่อลูก", "เช่น 3-4 กก.")}
            {number("avgWeightKg", "น้ำหนักเฉลี่ย (กก.)")}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {number("stockQty", "สต็อก (ลูก)", "ว่าง = ไม่นับ")}
            {number("stockKg", "สต็อก (กก.)")}
            {text("unit", "หน่วย")}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {text("badge", "ป้าย")}
            {text("origin", "แหล่งปลูก")}
            {text("brix", "ความหวาน")}
          </div>
          {text("image", "ลิงก์รูปสินค้า")}
          <Field label="รายละเอียด">
            <textarea className={`${inputCls} min-h-20`} value={f.description || ""} onChange={(e) => setF({ description: e.target.value })} />
          </Field>
          {customCols.length > 0 && (
            <div className="border-t border-stone-100 pt-3 space-y-3">
              <p className="text-xs font-bold text-stone-500">คอลัมน์ที่เพิ่มเอง</p>
              {customCols.map((c) => (
                <Field key={c} label={c}>
                  <input className={inputCls} value={f.custom?.[c] ?? ""} onChange={(e) => setF({ custom: { ...(f.custom || {}), [c]: e.target.value } })} />
                </Field>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={f.isAvailable !== false} onChange={(e) => setF({ isAvailable: e.target.checked })} />
            เปิดขาย
          </label>
        </Drawer>
      )}
      {toast && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}
    </>
  );
}
