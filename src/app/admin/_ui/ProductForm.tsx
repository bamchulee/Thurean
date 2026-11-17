"use client";

// ฟอร์มสินค้า: แบ่งเป็นหมวด ใช้ดรอปดาวน์ให้มากที่สุด (มีตัวเลือก "อื่นๆ" ให้พิมพ์เอง) ช่องที่ไม่ค่อยใช้ซ่อนไว้ใน "ตั้งค่าเพิ่มเติม"
import { useState, type ReactNode } from "react";
import type { Product } from "../../../types/durian";
import { Field, inputCls } from "./kit";

type Patch = Partial<Product>;

const VARIETY = ["หมอนทอง", "ก้านยาว", "ชะนี", "พวงมณี", "กระดุม", "นกหยิบ", "หลงลับแล", "มูซังคิง"];
const GRADE = ["เกรด A+ พรีเมียม", "เกรด A", "เกรด B", "จัมโบ้", "มินิ", "ตกไซส์"];
const MATURITY = ["แก่จัด 85%+", "ห่าม 80% (บ่มเองได้)", "สุกพอดีกิน", "สุกพร้อมทาน 100%"];
const TEXTURE = ["กรอบนอกนุ่มใน", "เนื้อไก่ฉีก", "นุ่มละมุน / ครีมมี่", "สุกนิ่มหวานฉ่ำ"];
const ORIGIN = ["ระยอง", "จันทบุรี", "ตราด", "ชุมพร", "นครศรีธรรมราช", "ยะลา", "นนทบุรี", "ศรีสะเกษ"];
const BADGE = ["ขายดี", "แนะนำ", "ใหม่", "จำนวนจำกัด", "ราคาพิเศษ"];
const SALE_TYPE = [
  { value: "รับคัดลูก", label: "คัดเป็นลูก — ลูกค้าเลือกจำนวนลูก ชั่งจริงทีหลัง" },
  { value: "รับมาเป็นโลแล้วขายเลย", label: "ขายเป็นกิโล — รับมาเป็นโลแล้วขายตามน้ำหนัก" },
];

/** ดรอปดาวน์ + "อื่นๆ (พิมพ์เอง)" — ค่าที่ไม่อยู่ในรายการจะสลับเป็นช่องพิมพ์ให้อัตโนมัติ */
function Choice({ label, value, options, onChange, hint, placeholder = "— ไม่ระบุ —" }: { label: string; value?: string; options: string[]; onChange: (v: string) => void; hint?: string; placeholder?: string }) {
  const current = value || "";
  const known = !current || options.includes(current);
  const [typing, setTyping] = useState(!known);
  return (
    <Field label={label} hint={hint}>
      {typing ? (
        <div className="flex gap-1.5">
          <input autoFocus className={inputCls} value={current} placeholder="พิมพ์เอง" onChange={(e) => onChange(e.target.value)} />
          <button
            type="button"
            onClick={() => {
              setTyping(false);
              if (!options.includes(current)) onChange("");
            }}
            className="px-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-600 shrink-0"
          >
            เลือก
          </button>
        </div>
      ) : (
        <select
          className={inputCls}
          value={current}
          onChange={(e) => {
            if (e.target.value === "__other") {
              setTyping(true);
              onChange("");
            } else onChange(e.target.value);
          }}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value="__other">อื่นๆ (พิมพ์เอง)…</option>
        </select>
      )}
    </Field>
  );
}

function Group({ title, children, desc }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h4 className="text-xs font-extrabold text-[#1B4D31] uppercase tracking-wide">{title}</h4>
        {desc && <p className="text-[11px] text-stone-400">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

/** "3.0 - 3.5 กก." → [3, 3.5] */
function parseRange(w?: string): [string, string] {
  const nums = String(w || "").match(/\d+(?:\.\d+)?/g) || [];
  return [nums[0] || "", nums[1] || nums[0] || ""];
}

export function ProductForm({ form: f, setF, customCols, products }: { form: Patch; setF: (p: Patch) => void; customCols: string[]; products: Product[] }) {
  const withExisting = (base: string[], key: keyof Product) =>
    Array.from(new Set([...base, ...products.map((p) => String(p[key] || "")).filter(Boolean)]));
  const num = (v: string) => (v === "" ? undefined : Number(v));
  const [wMin, wMax] = parseRange(f.weight);
  const setWeight = (min: string, max: string) => {
    const a = Number(min);
    const b = Number(max || min);
    const weight = min ? (max && max !== min ? `${min} - ${max} กก.` : `${min} กก.`) : "";
    setF({ weight, avgWeightKg: a > 0 ? Number(((a + (b || a)) / 2).toFixed(2)) : undefined });
  };
  const [advanced, setAdvanced] = useState(Boolean(f.stockKg || f.marketPrice || f.brix || f.type === "flesh" || customCols.some((c) => f.custom?.[c])));

  return (
    <div className="space-y-6">
      <Group title="ข้อมูลหลัก">
        <Field label="ชื่อสินค้า *" hint="ชื่อที่ลูกค้าเห็นใน LINE และหน้าเว็บ">
          <input className={inputCls} value={f.name || ""} placeholder="เช่น หมอนทองระยอง คัดพิเศษ" onChange={(e) => setF({ name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ราคาต่อกิโล (บาท) *" hint="ยอดจริง = น้ำหนักที่ชั่ง × ราคานี้">
            <input type="number" inputMode="decimal" className={inputCls} value={f.pricePerKg ?? ""} onChange={(e) => setF({ pricePerKg: num(e.target.value) })} />
          </Field>
          <Field label="สต็อกคงเหลือ (ลูก)" hint="เว้นว่าง = ไม่จำกัดจำนวน">
            <input type="number" inputMode="numeric" className={inputCls} value={f.stockQty ?? ""} onChange={(e) => setF({ stockQty: num(e.target.value) })} />
          </Field>
        </div>
        <Field label="วิธีขาย">
          <select className={inputCls} value={f.productType || "รับคัดลูก"} onChange={(e) => setF({ productType: e.target.value })}>
            {SALE_TYPE.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      </Group>

      <Group title="ลักษณะทุเรียน" desc="เลือกจากรายการ หรือเลือก อื่นๆ เพื่อพิมพ์เอง">
        <div className="grid grid-cols-2 gap-3">
          <Choice label="สายพันธุ์" value={f.variety} options={withExisting(VARIETY, "variety")} onChange={(v) => setF({ variety: v })} />
          <Choice label="เกรด / ไซส์" value={f.grade} options={withExisting(GRADE, "grade")} onChange={(v) => setF({ grade: v })} />
          <Choice label="ความสุก" value={f.maturity} options={withExisting(MATURITY, "maturity")} onChange={(v) => setF({ maturity: v })} />
          <Choice label="เนื้อสัมผัส" value={f.texture} options={withExisting(TEXTURE, "texture")} onChange={(v) => setF({ texture: v })} />
        </div>
        <Field label="น้ำหนักต่อลูก (กก.)" hint={f.avgWeightKg ? `เฉลี่ย ${f.avgWeightKg} กก./ลูก — ใช้ประมาณราคาให้ลูกค้าดู` : "ใส่ช่วงน้ำหนัก ระบบคิดค่าเฉลี่ยให้"}>
          <div className="flex items-center gap-2">
            <input type="number" inputMode="decimal" step="0.1" className={inputCls} placeholder="ตั้งแต่" value={wMin} onChange={(e) => setWeight(e.target.value, wMax)} />
            <span className="text-stone-400">–</span>
            <input type="number" inputMode="decimal" step="0.1" className={inputCls} placeholder="ถึง" value={wMax} onChange={(e) => setWeight(wMin, e.target.value)} />
          </div>
        </Field>
        <Choice label="แหล่งปลูก" value={f.origin} options={withExisting(ORIGIN, "origin")} onChange={(v) => setF({ origin: v })} />
      </Group>

      <Group title="การแสดงผล">
        <Field label="รูปสินค้า (ลิงก์รูป)">
          <div className="flex gap-2 items-start">
            <input className={inputCls} value={f.image || ""} placeholder="https://..." onChange={(e) => setF({ image: e.target.value })} />
            {f.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.image} alt="" className="w-11 h-11 rounded-lg object-cover border border-stone-200 shrink-0" />
            )}
          </div>
        </Field>
        <Choice label="ป้ายบนการ์ด" value={f.badge} options={withExisting(BADGE, "badge")} onChange={(v) => setF({ badge: v })} placeholder="— ไม่มีป้าย —" />
        <Field label="รายละเอียด" hint="สั้นๆ 1–2 บรรทัด">
          <textarea className={`${inputCls} min-h-16`} value={f.description || ""} onChange={(e) => setF({ description: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={f.isAvailable !== false} onChange={(e) => setF({ isAvailable: e.target.checked })} />
          เปิดขาย (เอาติ๊กออก = ซ่อนจากลูกค้า)
        </label>
      </Group>

      <div className="border-t border-stone-100 pt-3">
        <button type="button" onClick={() => setAdvanced(!advanced)} className="text-xs font-bold text-stone-500">
          {advanced ? "▾" : "▸"} ตั้งค่าเพิ่มเติม (ไม่บังคับ)
        </button>
        {advanced && (
          <div className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="ราคาตลาด/กก." hint="โชว์เป็นราคาขีดฆ่า">
                <input type="number" inputMode="decimal" className={inputCls} value={f.marketPrice ?? ""} onChange={(e) => setF({ marketPrice: num(e.target.value) })} />
              </Field>
              <Field label="ความหวาน" hint="เช่น 33° Brix">
                <input className={inputCls} value={f.brix || ""} onChange={(e) => setF({ brix: e.target.value })} />
              </Field>
              <Field label="รูปแบบสินค้า">
                <select className={inputCls} value={f.type || "whole"} onChange={(e) => setF({ type: e.target.value === "flesh" ? "flesh" : "whole", unit: e.target.value === "flesh" ? "กล่อง" : "ลูก" })}>
                  <option value="whole">ทั้งลูก</option>
                  <option value="flesh">แกะเนื้อ (ขายเป็นกล่อง)</option>
                </select>
              </Field>
              <Field label="สต็อกเป็นกิโล" hint="ใช้แทนสต็อกเป็นลูก ถ้านับเป็นน้ำหนัก">
                <input type="number" inputMode="decimal" className={inputCls} value={f.stockKg ?? ""} onChange={(e) => setF({ stockKg: num(e.target.value) })} />
              </Field>
            </div>
            {customCols.map((c) => (
              <Field key={c} label={c} hint="คอลัมน์ที่เพิ่มเองในหน้าการเชื่อมต่อ">
                <input className={inputCls} value={f.custom?.[c] ?? ""} onChange={(e) => setF({ custom: { ...(f.custom || {}), [c]: e.target.value } })} />
              </Field>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
