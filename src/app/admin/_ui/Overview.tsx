"use client";

// ภาพรวม: งานค้าง (กดแล้วไปหน้าออเดอร์ที่กรองไว้) + ยอดขาย/ต้นทุน/กำไร ตามช่วงเวลาหรือรอบ + สรุปรายรอบ
import { useCallback, useMemo, useState } from "react";
import { ArrowRight, ClipboardCheck, Package, Scale, ShieldAlert, Truck } from "lucide-react";
import { normalizePaymentStatus, orderStatusOf } from "../../../lib/order-status";
import type { Claim, LotCost, Order, Product, Round } from "../../../types/durian";
import { baht, Section, Stat, usePageActions } from "./kit";
import { isCancelled, itemsText, orderDate, orderKg, OrderStatusBadge, shortDate } from "./shared";

type Period = "today" | "7d" | "30d" | "all";

const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "วันนี้" },
  { id: "7d", label: "7 วัน" },
  { id: "30d", label: "30 วัน" },
  { id: "all", label: "ทั้งหมด" },
];

function inPeriod(d: Date | null, p: Period): boolean {
  if (p === "all") return true;
  if (!d) return false;
  const now = new Date();
  if (p === "today") return d.toDateString() === now.toDateString();
  const days = p === "7d" ? 7 : 30;
  return now.getTime() - d.getTime() <= days * 86400000;
}

export function Overview({
  orders,
  products,
  lots,
  rounds,
  claims,
  onOpenOrders,
  onGoTab,
}: {
  orders: Order[];
  products: Product[];
  lots: LotCost[];
  rounds: Round[];
  claims: Claim[];
  onOpenOrders: (filter: string) => void;
  onGoTab: (tab: "products" | "claims" | "rounds") => void;
}) {
  const [period, setPeriod] = useState<Period>("30d");
  const [roundId, setRoundId] = useState("");

  const clear = useCallback(() => {
    setPeriod("30d");
    setRoundId("");
  }, []);
  usePageActions({ onClear: clear, clearLabel: "ล้างตัวกรอง", clearConfirm: "กลับไปดูช่วง 30 วัน ทุกรอบ?" });

  // ---- งานค้าง (ไม่ขึ้นกับช่วงเวลา) ----
  const queue = useMemo(() => {
    const live = orders.filter((o) => !isCancelled(o));
    return {
      weigh: live.filter((o) => orderStatusOf(o) === "สั่งจอง").length,
      slip: live.filter((o) => normalizePaymentStatus(o.paymentStatus) === "slip_submitted").length,
      ship: live.filter((o) => orderStatusOf(o) === "ชำระเงินแล้ว/เตรียมจัดส่ง").length,
      claims: claims.filter((c) => c.status === "pending").length,
      lowStock: products.filter((p) => p.isAvailable !== false && typeof p.stockQty === "number" && p.stockQty <= 2).length,
    };
  }, [orders, claims, products]);

  // ---- ตัวเลขตามช่วง/รอบ ----
  const scoped = useMemo(
    () => orders.filter((o) => !isCancelled(o) && (roundId ? o.roundId === roundId : inPeriod(orderDate(o), period))),
    [orders, period, roundId]
  );
  const scopedLots = useMemo(
    () => lots.filter((l) => (roundId ? l.roundId === roundId : inPeriod(l.date ? new Date(l.date) : null, period))),
    [lots, period, roundId]
  );

  const m = useMemo(() => {
    const weighed = scoped.filter((o) => (o.totalPrice || 0) > 0);
    const paid = scoped.filter((o) => normalizePaymentStatus(o.paymentStatus) === "confirmed");
    const sales = paid.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const shipping = paid.reduce((s, o) => s + (o.shippingCost || 0), 0);
    const unpaid = weighed.filter((o) => normalizePaymentStatus(o.paymentStatus) !== "confirmed").reduce((s, o) => s + (o.totalPrice || 0) + (o.shippingCost || 0), 0);
    const kg = scoped.reduce((s, o) => s + orderKg(o), 0);
    const fruit = scopedLots.reduce((s, l) => s + (l.totalFruitCost || 0), 0);
    const pack = scopedLots.reduce((s, l) => s + (l.packagingCost || 0), 0);
    const fuel = scopedLots.reduce((s, l) => s + (l.truckFuelCost || 0), 0);
    const cost = fruit + pack + fuel;
    const profit = sales - cost;
    return { orders: scoped.length, paidCount: paid.length, sales, shipping, unpaid, kg, fruit, pack, fuel, cost, profit, margin: sales > 0 ? Math.round((profit / sales) * 100) : 0 };
  }, [scoped, scopedLots]);

  const byRound = useMemo(() => {
    return rounds
      .map((r) => {
        const os = orders.filter((o) => o.roundId === r.id && !isCancelled(o));
        const paid = os.filter((o) => normalizePaymentStatus(o.paymentStatus) === "confirmed");
        const sales = paid.reduce((s, o) => s + (o.totalPrice || 0), 0);
        const cost = lots.filter((l) => l.roundId === r.id).reduce((s, l) => s + (l.totalFruitCost || 0) + (l.packagingCost || 0) + (l.truckFuelCost || 0), 0);
        return { r, count: os.length, kg: os.reduce((s, o) => s + orderKg(o), 0), sales, cost, profit: sales - cost };
      })
      .filter((x) => x.count > 0 || x.cost > 0);
  }, [rounds, orders, lots]);

  const recent = useMemo(
    () => [...orders].sort((a, b) => (orderDate(b)?.getTime() || 0) - (orderDate(a)?.getTime() || 0)).slice(0, 8),
    [orders]
  );

  const work = [
    { id: "weigh", label: "รอชั่งน้ำหนัก", n: queue.weigh, icon: Scale, tone: "bg-amber-50 border-amber-200 text-amber-900", go: () => onOpenOrders("weigh") },
    { id: "slip", label: "สลิปรอตรวจ", n: queue.slip, icon: ClipboardCheck, tone: "bg-orange-50 border-orange-200 text-orange-900", go: () => onOpenOrders("slip") },
    { id: "ship", label: "รอจัดส่ง", n: queue.ship, icon: Truck, tone: "bg-sky-50 border-sky-200 text-sky-900", go: () => onOpenOrders("ship") },
    { id: "claims", label: "เคลมรอตรวจ", n: queue.claims, icon: ShieldAlert, tone: "bg-rose-50 border-rose-200 text-rose-900", go: () => onGoTab("claims") },
    { id: "stock", label: "สต็อกใกล้หมด", n: queue.lowStock, icon: Package, tone: "bg-stone-50 border-stone-200 text-stone-800", go: () => onGoTab("products") },
  ];

  return (
    <div className="space-y-5">
      {/* งานที่ต้องทำ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {work.map((w) => (
          <button key={w.id} type="button" onClick={w.go} className={`text-left border rounded-2xl p-3.5 transition hover:shadow-sm ${w.tone} ${w.n === 0 ? "opacity-60" : ""}`}>
            <div className="flex items-center justify-between">
              <w.icon className="w-4 h-4" />
              <ArrowRight className="w-3.5 h-3.5 opacity-50" />
            </div>
            <div className="text-2xl font-extrabold mt-2 tabular-nums">{w.n}</div>
            <div className="text-xs font-bold">{w.label}</div>
          </button>
        ))}
      </div>

      {/* ตัวกรองช่วง */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setPeriod(p.id);
              setRoundId("");
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${!roundId && period === p.id ? "bg-[#1B4D31] text-white border-[#1B4D31]" : "bg-white border-stone-200 text-stone-600"}`}
          >
            {p.label}
          </button>
        ))}
        <select value={roundId} onChange={(e) => setRoundId(e.target.value)} className="border border-stone-200 rounded-full px-3 py-1.5 text-xs font-bold bg-white">
          <option value="">— เลือกรอบ —</option>
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name || r.id}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="ยอดขาย (ชำระแล้ว)" value={baht(m.sales)} sub={`${m.paidCount} ออเดอร์ · ค่าส่ง ${baht(m.shipping)}`} tone="green" />
        <Stat label="กำไร" value={baht(m.profit)} sub={`อัตรากำไร ${m.margin}%`} tone={m.profit >= 0 ? "green" : "rose"} />
        <Stat label="รอเก็บเงิน" value={baht(m.unpaid)} sub="ชั่งแล้ว ยังไม่ยืนยันยอด" tone="amber" />
        <Stat label="น้ำหนักที่ขาย" value={`${m.kg.toLocaleString("th-TH", { maximumFractionDigits: 1 })} กก.`} sub={`${m.orders} ออเดอร์ในช่วงนี้`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Section title="กำไรขาดทุน" desc={roundId ? "เฉพาะรอบที่เลือก" : "ตามช่วงเวลาที่เลือก (ต้นทุนนับตามวันที่ของล็อต)"}>
          <dl className="text-sm divide-y divide-stone-100">
            {[
              ["ยอดขายทุเรียน (ชำระแล้ว)", m.sales, ""],
              ["ต้นทุนทุเรียนจากสวน", -m.fruit, "text-rose-700"],
              ["ค่ากล่อง / แพ็ก", -m.pack, "text-rose-700"],
              ["ค่ารถ / น้ำมัน", -m.fuel, "text-rose-700"],
            ].map(([label, v, cls]) => (
              <div key={label as string} className="flex justify-between py-2">
                <dt className="text-stone-600">{label}</dt>
                <dd className={`font-bold tabular-nums ${cls}`}>{(v as number) < 0 ? `-${baht(-(v as number))}` : baht(v as number)}</dd>
              </div>
            ))}
            <div className="flex justify-between py-3">
              <dt className="font-extrabold text-stone-900">กำไรสุทธิ</dt>
              <dd className={`text-lg font-extrabold tabular-nums ${m.profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{baht(m.profit)}</dd>
            </div>
          </dl>
        </Section>

        <Section title="สรุปรายรอบ" desc="ยอดชำระแล้ว หักต้นทุนล็อตของรอบนั้น" right={<button type="button" onClick={() => onGoTab("rounds")} className="text-xs font-bold text-[#1B4D31]">จัดการรอบ →</button>}>
          {byRound.length === 0 ? (
            <p className="text-sm text-stone-400 py-4 text-center">ยังไม่มีรอบที่มีออเดอร์</p>
          ) : (
            <div className="overflow-x-auto -mx-4">
              <table className="w-full text-sm">
                <thead className="text-[11px] text-stone-500 whitespace-nowrap">
                  <tr>
                    <th className="text-left px-4 py-1.5">รอบ</th>
                    <th className="text-right px-2">ออเดอร์</th>
                    <th className="text-right px-2">กก.</th>
                    <th className="text-right px-2">ยอดขาย</th>
                    <th className="text-right px-4">กำไร</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {byRound.map((x) => (
                    <tr key={x.r.id} className="hover:bg-stone-50 cursor-pointer" onClick={() => setRoundId(x.r.id)}>
                      <td className="px-4 py-2 font-semibold">{x.r.name || x.r.id}</td>
                      <td className="text-right px-2 tabular-nums">{x.count}</td>
                      <td className="text-right px-2 tabular-nums">{x.kg.toFixed(1)}</td>
                      <td className="text-right px-2 tabular-nums">{baht(x.sales)}</td>
                      <td className={`text-right px-4 font-bold tabular-nums ${x.profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{baht(x.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      <Section title="ออเดอร์ล่าสุด" right={<button type="button" onClick={() => onOpenOrders("all")} className="text-xs font-bold text-[#1B4D31]">ดูทั้งหมด →</button>}>
        {recent.length === 0 ? (
          <p className="text-sm text-stone-400 py-4 text-center">ยังไม่มีออเดอร์</p>
        ) : (
          <ul className="divide-y divide-stone-100 -my-2">
            {recent.map((o) => (
              <li key={o.id}>
                <a href={`/admin/orders/${encodeURIComponent(o.id)}`} className="flex items-center gap-3 py-2 hover:bg-stone-50 -mx-2 px-2 rounded-lg">
                  <span className="font-mono text-xs font-bold text-stone-500 w-20 shrink-0">{o.id}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate">{o.customerName}</span>
                    <span className="block text-[11px] text-stone-400 truncate">{itemsText(o)}</span>
                  </span>
                  <span className="hidden sm:block text-[11px] text-stone-400 w-24 text-right">{shortDate(orderDate(o))}</span>
                  <OrderStatusBadge order={o} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
