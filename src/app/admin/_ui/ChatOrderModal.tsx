"use client";

// สร้างออเดอร์ให้ลูกค้า (คุยสั่งในแชท / โทรสั่ง / หน้าร้าน)
// แต่ละรายการเลือกวิธีคิดเงิน: รอชั่ง · ชั่งแล้ว (กก. × ราคา/กก.) · ราคาเหมา (เช่น ยกลัง 100 ลูก)
// ทุกรายการมีราคาแล้ว → ระบบคิดยอด ขึ้น "รอชำระเงิน" และส่งสรุปยอดพร้อม QR ให้ลูกค้าทาง LINE ทันที
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { shopInfo } from "../../../data/shop";
import { formatProductStock, pricePerKgOf } from "../../../lib/stock";
import type { Order, Product, SafeUser } from "../../../types/durian";
import { baht, Drawer, Field, inputCls } from "./kit";

type Mode = "weigh" | "kg" | "lump";
type Line = { productId: string; qty: string; ripeness: string; mode: Mode; totalKg: string; pricePerKg: string; amount: string };

const MODES: { id: Mode; label: string }[] = [
  { id: "weigh", label: "รอชั่ง" },
  { id: "kg", label: "ชั่งแล้ว (กก.)" },
  { id: "lump", label: "ราคาเหมา" },
];
const RIPENESS = ["กรอบนอกนุ่มใน", "สุกพอดีกิน", "ห่าม-กรอบมัน", "สุกงอม"];

const num = (s: string) => {
  const n = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function newLine(p?: Product): Line {
  return { productId: p?.id || "", qty: "1", ripeness: RIPENESS[0], mode: "weigh", totalKg: "", pricePerKg: p ? String(pricePerKgOf(p)) : "", amount: "" };
}

function lineTotal(l: Line): number | null {
  if (l.mode === "kg") return num(l.totalKg) > 0 && num(l.pricePerKg) > 0 ? Math.round(num(l.totalKg) * num(l.pricePerKg)) : null;
  if (l.mode === "lump") return num(l.amount) > 0 ? Math.round(num(l.amount)) : null;
  return null;
}

const userName = (u: SafeUser) => `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.displayName || u.username || u.id;

export function ChatOrderModal({
  products,
  users,
  initialLineUserId,
  onClose,
  onOrderCreated,
}: {
  products: Product[];
  users: SafeUser[];
  initialLineUserId?: string;
  onClose: () => void;
  onOrderCreated: (o: Order) => void;
}) {
  const sellable = useMemo(() => products.filter((p) => p.isActive !== 0 && p.isActive !== false), [products]);
  const [search, setSearch] = useState("");
  const [lineUserId, setLineUserId] = useState(initialLineUserId || "");
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine(sellable[0])]);
  const [shipIdx, setShipIdx] = useState(0);
  const [shippingCost, setShippingCost] = useState(String(shopInfo.shippingMethods[0].price));
  const [notes, setNotes] = useState("");
  const [send, setSend] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ order: Order; sent: boolean; priced: boolean } | null>(null);

  const pickUser = (u: SafeUser) => {
    setUserId(u.id);
    setLineUserId(u.lineUserId || "");
    setName(userName(u));
    setPhone(u.phone || "");
    setAddress(`${u.address || ""} ${u.postalCode || ""}`.trim());
    setSearch("");
  };

  // เปิดจากปุ่มในกลุ่ม LINE: เติมข้อมูลลูกค้าคนนั้นให้
  useEffect(() => {
    if (!initialLineUserId) return;
    let cancelled = false;
    fetch(`/api/admin/chat-order?lineUserId=${encodeURIComponent(initialLineUserId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j.ok || !j.customer) return;
        setUserId(j.customer.userId || "");
        setName((v) => v || j.customer.name || "");
        setPhone((v) => v || j.customer.phone || "");
        setAddress((v) => v || j.customer.address || "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialLineUserId]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return users
      .filter((u) => [userName(u), u.phone, u.displayName, u.id].some((v) => v && String(v).toLowerCase().includes(q)))
      .slice(0, 6);
  }, [search, users]);

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const totals = lines.map(lineTotal);
  const allPriced = lines.every((l) => l.mode !== "weigh") && totals.every((t) => t !== null);
  const itemsTotal = totals.reduce<number>((s, t) => s + (t || 0), 0);
  const grand = itemsTotal + num(shippingCost);

  const submit = async () => {
    setError("");
    if (!name.trim() || !phone.trim() || !address.trim()) return setError("กรอกชื่อ เบอร์โทร และที่อยู่ให้ครบ");
    if (lines.some((l) => !l.productId || num(l.qty) < 1)) return setError("ทุกรายการต้องเลือกสินค้าและจำนวน");
    if (lines.some((l) => l.mode !== "weigh" && lineTotal(l) === null)) return setError("รายการที่เลือกชั่งแล้ว/ราคาเหมา ต้องกรอกตัวเลขให้ครบ");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/chat-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: lineUserId || undefined,
          userId: userId || undefined,
          customerName: name,
          phone,
          address,
          shippingMethod: shopInfo.shippingMethods[shipIdx]?.name,
          shippingCost: num(shippingCost),
          notes,
          send,
          lines: lines.map((l) => ({
            productId: l.productId,
            qty: num(l.qty),
            ripeness: l.ripeness,
            mode: l.mode,
            totalKg: num(l.totalKg),
            pricePerKg: num(l.pricePerKg),
            amount: num(l.amount),
          })),
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) return setError(j.error || "สร้างออเดอร์ไม่สำเร็จ");
      setDone({ order: j.order, sent: j.sent, priced: j.priced });
      onOrderCreated(j.order);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Drawer title="สร้างออเดอร์แล้ว" onClose={onClose} footer={<button onClick={onClose} className="px-4 py-2 rounded-xl bg-[#1B4D31] text-white text-sm font-bold">เสร็จ</button>}>
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-1 text-sm">
          <p className="font-extrabold text-emerald-900">✅ ออเดอร์ #{done.order.id}</p>
          <p>{done.order.customerName} · {done.order.phone}</p>
          <p className="font-bold">{done.priced ? `ยอดที่ต้องชำระ ${baht((done.order.totalPrice || 0) + (done.order.shippingCost || 0))}` : "รอชั่งน้ำหนัก (ยังไม่มียอด)"}</p>
          <p className={done.sent ? "text-emerald-700" : "text-amber-700"}>
            {done.sent ? (done.priced ? "📨 ส่งสรุปยอดพร้อม QR ให้ลูกค้าทาง LINE แล้ว" : "📨 ส่งใบรับจองให้ลูกค้าทาง LINE แล้ว") : "⚠️ ไม่ได้ส่ง LINE (ลูกค้าไม่มี LINE หรือปิดการส่ง)"}
          </p>
        </div>
        <a href={`/admin/orders/${encodeURIComponent(done.order.id)}`} className="block text-center text-sm font-bold text-[#1B4D31] underline">
          เปิดหน้าออเดอร์
        </a>
      </Drawer>
    );
  }

  return (
    <Drawer
      title="สร้างออเดอร์ให้ลูกค้า"
      onClose={onClose}
      footer={
        <div className="w-full space-y-2">
          {error && <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              {allPriced ? (
                <span className="font-extrabold text-stone-900">ยอดรวม {baht(grand)}</span>
              ) : (
                <span className="text-amber-700 font-semibold">มีรายการรอชั่ง — ส่งยอดทีหลัง</span>
              )}
            </div>
            <button type="button" disabled={busy} onClick={submit} className="px-4 py-2.5 rounded-xl bg-[#1B4D31] hover:bg-[#143B25] disabled:opacity-50 text-white text-sm font-bold">
              {busy ? "กำลังบันทึก…" : allPriced && send && lineUserId ? "สร้าง + ส่งยอดให้ลูกค้า" : "สร้างออเดอร์"}
            </button>
          </div>
        </div>
      }
    >
      {/* ลูกค้า */}
      <section className="space-y-2">
        <p className="text-xs font-extrabold text-stone-500">ลูกค้า</p>
        {users.length > 0 && (
          <div className="relative">
            <input className={inputCls} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาสมาชิก: ชื่อ เบอร์" />
            {matches.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden">
                {matches.map((u) => (
                  <button key={u.id} type="button" onClick={() => pickUser(u)} className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 flex justify-between gap-2">
                    <span className="truncate">{userName(u)}</span>
                    <span className="text-xs text-stone-400 shrink-0">{u.phone || ""}{u.lineUserId ? " · LINE" : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {lineUserId && <p className="text-[11px] font-semibold text-[#06C755]">● ลูกค้า LINE — ส่งยอดเข้าแชทได้</p>}
        <div className="grid grid-cols-2 gap-2">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อผู้รับ" />
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="เบอร์โทร" inputMode="tel" />
        </div>
        <textarea className={`${inputCls} resize-none`} rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ที่อยู่จัดส่ง" />
      </section>

      {/* รายการ */}
      <section className="space-y-2">
        <p className="text-xs font-extrabold text-stone-500">รายการสินค้า</p>
        {lines.map((l, i) => {
          const p = sellable.find((x) => x.id === l.productId);
          const t = totals[i];
          return (
            <div key={i} className="rounded-xl border border-stone-200 p-3 space-y-2 bg-stone-50/60">
              <div className="flex gap-2">
                <select
                  className={inputCls}
                  value={l.productId}
                  onChange={(e) => {
                    const np = sellable.find((x) => x.id === e.target.value);
                    setLine(i, { productId: e.target.value, pricePerKg: np ? String(pricePerKgOf(np)) : l.pricePerKg });
                  }}
                >
                  {sellable.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} — {formatProductStock(x).summary}
                    </option>
                  ))}
                </select>
                {lines.length > 1 && (
                  <button type="button" aria-label="ลบรายการ" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="p-2 text-stone-400 hover:text-rose-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label={`จำนวน (${p?.unit || "ลูก"})`}>
                  <input className={inputCls} inputMode="numeric" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value.replace(/\D/g, "") })} />
                </Field>
                <Field label="ความสุก">
                  <select className={inputCls} value={l.ripeness} onChange={(e) => setLine(i, { ripeness: e.target.value })}>
                    {RIPENESS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="flex gap-1">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setLine(i, { mode: m.id })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${l.mode === m.id ? "bg-[#1B4D31] text-white border-[#1B4D31]" : "bg-white text-stone-600 border-stone-300"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {l.mode === "kg" && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="น้ำหนักรวม (กก.)">
                    <input className={inputCls} inputMode="decimal" value={l.totalKg} onChange={(e) => setLine(i, { totalKg: e.target.value })} placeholder="เช่น 312.5" />
                  </Field>
                  <Field label="ราคา/กก.">
                    <input className={inputCls} inputMode="decimal" value={l.pricePerKg} onChange={(e) => setLine(i, { pricePerKg: e.target.value })} />
                  </Field>
                </div>
              )}
              {l.mode === "lump" && (
                <Field label="ยอดเหมารายการนี้ (บาท)" hint="เช่น ยกลัง 100 ลูก ตกลงราคากันในแชท">
                  <input className={inputCls} inputMode="decimal" value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} placeholder="เช่น 18000" />
                </Field>
              )}
              <p className="text-right text-xs">
                {l.mode === "weigh" ? (
                  <span className="text-amber-700">รอชั่ง · {baht(num(l.pricePerKg))}/กก.</span>
                ) : t !== null ? (
                  <span className="font-extrabold text-stone-900">= {baht(t)}</span>
                ) : (
                  <span className="text-stone-400">กรอกตัวเลขเพื่อคิดยอด</span>
                )}
              </p>
            </div>
          );
        })}
        <button type="button" onClick={() => setLines((ls) => [...ls, newLine(sellable[0])])} className="w-full py-2 rounded-xl border border-dashed border-stone-300 text-xs font-bold text-stone-600 inline-flex items-center justify-center gap-1">
          <Plus className="w-3.5 h-3.5" /> เพิ่มรายการ
        </button>
      </section>

      {/* ส่ง + สรุป */}
      <section className="space-y-2">
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <Field label="วิธีจัดส่ง">
            <select
              className={inputCls}
              value={shipIdx}
              onChange={(e) => {
                const i = Number(e.target.value);
                setShipIdx(i);
                setShippingCost(String(shopInfo.shippingMethods[i]?.price ?? 0));
              }}
            >
              {shopInfo.shippingMethods.map((s, i) => (
                <option key={s.name} value={i}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ค่าส่ง">
            <input className={inputCls} inputMode="numeric" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} />
          </Field>
        </div>
        <textarea className={`${inputCls} resize-none`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="หมายเหตุ (เช่น ตกลงในแชทว่า…)" />
        {allPriced && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm space-y-0.5">
            <div className="flex justify-between"><span>ค่าสินค้า</span><span>{baht(itemsTotal)}</span></div>
            <div className="flex justify-between"><span>ค่าส่ง</span><span>{baht(num(shippingCost))}</span></div>
            <div className="flex justify-between font-extrabold text-base"><span>ยอดชำระ</span><span>{baht(grand)}</span></div>
          </div>
        )}
        <label className="flex items-center gap-2 text-xs text-stone-700">
          <input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} disabled={!lineUserId} />
          {lineUserId ? (allPriced ? "ส่งสรุปยอด + QR ให้ลูกค้าทาง LINE" : "ส่งใบรับจองให้ลูกค้าทาง LINE") : "ลูกค้าไม่มี LINE — ไม่ส่งข้อความ"}
        </label>
      </section>
    </Drawer>
  );
}
