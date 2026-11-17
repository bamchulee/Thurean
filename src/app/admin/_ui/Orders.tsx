"use client";

// รายการสั่งซื้อ: ตารางแถวละออเดอร์ กรองตามงาน (รอชั่ง/สลิป/รอส่ง…) ค้นหา แบ่งหน้า — กดแถวเปิดหน้าออเดอร์เดี่ยว (ชั่ง/ตรวจสลิป/ส่งของ)
import { useCallback, useMemo, useState } from "react";
import { PlusCircle } from "lucide-react";
import { normalizePaymentStatus, orderStatusOf } from "../../../lib/order-status";
import type { Order, Product, Round, SafeUser } from "../../../types/durian";
import { baht, DataTable, usePageActions, type Column } from "./kit";
import { ManualOrderModal } from "./ManualOrderModal";
import { itemsText, orderDate, orderKg, orderQty, OrderStatusBadge, PaymentBadge, shortDate } from "./shared";

const FILTERS: { id: string; label: string; test: (o: Order) => boolean }[] = [
  { id: "weigh", label: "⚖️ รอชั่ง", test: (o) => orderStatusOf(o) === "สั่งจอง" },
  { id: "pay", label: "💳 รอโอน", test: (o) => orderStatusOf(o) === "รอชำระเงิน" && normalizePaymentStatus(o.paymentStatus) !== "slip_submitted" },
  { id: "slip", label: "🧾 สลิปรอตรวจ", test: (o) => normalizePaymentStatus(o.paymentStatus) === "slip_submitted" && orderStatusOf(o) !== "ยกเลิก" },
  { id: "ship", label: "📦 รอส่ง", test: (o) => orderStatusOf(o) === "ชำระเงินแล้ว/เตรียมจัดส่ง" },
  { id: "shipping", label: "🚚 กำลังส่ง", test: (o) => orderStatusOf(o) === "กำลังจัดส่ง" },
  { id: "done", label: "✅ ส่งแล้ว", test: (o) => orderStatusOf(o) === "จัดส่งสำเร็จ" },
  { id: "cancel", label: "❌ ยกเลิก", test: (o) => orderStatusOf(o) === "ยกเลิก" },
];

export function Orders({
  orders,
  products,
  rounds,
  users,
  initialFilter,
  onOrderCreated,
}: {
  orders: Order[];
  products: Product[];
  rounds: Round[];
  users: SafeUser[];
  initialFilter?: string;
  onOrderCreated: (o: Order) => void;
}) {
  const [roundId, setRoundId] = useState("");
  const [creating, setCreating] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const clear = useCallback(() => {
    setRoundId("");
    setResetKey((k) => k + 1);
  }, []);
  usePageActions({ onClear: clear, clearLabel: "ล้างตัวกรอง", clearConfirm: "ล้างคำค้นหาและตัวกรองทั้งหมด?" });

  const rows = useMemo(
    () =>
      orders
        .filter((o) => !roundId || o.roundId === roundId)
        .sort((a, b) => (orderDate(b)?.getTime() || 0) - (orderDate(a)?.getTime() || 0)),
    [orders, roundId]
  );

  const columns: Column<Order>[] = [
    {
      key: "id",
      header: "ออเดอร์",
      render: (o) => (
        <div>
          <div className="font-mono text-xs font-bold text-stone-800 whitespace-nowrap">{o.id}</div>
          <div className="text-[11px] text-stone-400 whitespace-nowrap">{shortDate(orderDate(o))}</div>
        </div>
      ),
    },
    {
      key: "customer",
      header: "ลูกค้า",
      render: (o) => (
        <div className="min-w-0 max-w-[180px]">
          <div className="font-semibold truncate">{o.customerName || "-"}</div>
          <div className="text-[11px] text-stone-400">{o.phone}</div>
        </div>
      ),
    },
    {
      key: "items",
      header: "รายการ",
      hideOnMobile: true,
      render: (o) => {
        const kg = orderKg(o);
        return (
          <div className="max-w-[220px]">
            <div className="truncate text-stone-700">{itemsText(o)}</div>
            <div className="text-[11px] text-stone-400">
              {orderQty(o)} ลูก{kg > 0 ? ` · ${kg.toFixed(1)} กก.` : " · ยังไม่ชั่ง"}
            </div>
          </div>
        );
      },
    },
    {
      key: "total",
      header: "ยอด",
      className: "text-right",
      render: (o) =>
        (o.totalPrice || 0) > 0 ? (
          <span className="font-bold tabular-nums">{baht((o.totalPrice || 0) + (o.shippingCost || 0))}</span>
        ) : (
          <span className="text-[11px] text-stone-400">รอชั่ง</span>
        ),
    },
    { key: "status", header: "สถานะ", render: (o) => <OrderStatusBadge order={o} /> },
    { key: "pay", header: "ชำระ", hideOnMobile: true, render: (o) => <PaymentBadge order={o} /> },
  ];

  return (
    <>
      <DataTable
        key={resetKey}
        rows={rows}
        columns={columns}
        rowKey={(o) => o.id}
        onRowClick={(o) => (window.location.href = `/admin/orders/${encodeURIComponent(o.id)}`)}
        search={(o) => `${o.id} ${o.customerName} ${o.phone} ${o.trackingNo || ""} ${itemsText(o)}`}
        searchPlaceholder="ค้นหา เลขออเดอร์ ชื่อ เบอร์ เลขพัสดุ"
        filters={FILTERS}
        initialFilter={initialFilter}
        pageSize={25}
        empty="ยังไม่มีออเดอร์"
        rowClassName={(o) => (orderStatusOf(o) === "ยกเลิก" ? "opacity-50" : "")}
        toolbar={
          <>
            <select value={roundId} onChange={(e) => setRoundId(e.target.value)} className="border border-stone-300 rounded-xl px-3 py-1.5 text-xs font-bold bg-white">
              <option value="">ทุกรอบ</option>
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name || r.id}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-500 text-stone-900 px-3 py-1.5 rounded-xl text-xs font-bold"
            >
              <PlusCircle className="w-3.5 h-3.5" /> สร้างออเดอร์
            </button>
          </>
        }
      />
      {creating && (
        <ManualOrderModal
          products={products}
          rounds={rounds}
          users={users}
          onClose={() => setCreating(false)}
          onOrderCreated={(o) => {
            onOrderCreated(o);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}
