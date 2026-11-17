"use client";

// หน้าออเดอร์เดี่ยวของแอดมิน — ปุ่ม "เปิดออเดอร์" ในการ์ดกลุ่ม LINE พามาที่นี่
// เห็นเฉพาะออเดอร์นี้กับลูกค้าคนนี้ ทำทุกขั้นได้ในหน้าเดียว: ชั่ง → ยืนยันสลิป → จัดส่ง → ถึงแล้ว / ยกเลิก
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  MapPin,
  MessageCircle,
  Minus,
  Phone,
  Plus,
  Receipt,
  Scale,
  ShieldCheck,
  Truck,
  XCircle,
} from "lucide-react";
import { LineIcon } from "../../../../components/Icons";
import { COURIER_OPTIONS } from "../../../../lib/courier";
import { slipAccountText, slipAmountText, slipCheckText } from "../../../../lib/slip-check";

/** สีกรอบผลตรวจสลิป: แดงถ้ามีข้อใดไม่ผ่าน, เขียวถ้าผ่านครบ */
function slipTone(o: { slipCheck?: string; slipAmountCheck?: string; slipAccountCheck?: string }): "ok" | "warn" | "bad" {
  const qr = slipCheckText(o.slipCheck).tone;
  if (qr === "bad" || o.slipAmountCheck === "mismatch" || o.slipAccountCheck === "mismatch") return "bad";
  if (qr === "ok" && o.slipAmountCheck === "match" && o.slipAccountCheck === "match") return "ok";
  return "warn";
}
import {
  ORDER_STATUS_META,
  PAYMENT_STATUS_LABEL,
  canWeigh,
  normalizePaymentStatus,
  orderStatusOf,
} from "../../../../lib/order-status";
import type { Order } from "../../../../types/durian";

interface OrderResponse {
  ok: boolean;
  error?: string;
  order?: Order;
  isAdmin?: boolean;
  products?: { id: string; name: string; pricePerKg: number }[];
  chatUrl?: string;
}

interface WeighRow {
  pricePerKg: string;
  fruitKgs: string[];
}

const kgSum = (rows: string[]) => rows.reduce((s, v) => s + (parseFloat(v) || 0), 0);

export default function AdminOrderPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = decodeURIComponent(id || "");

  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [order, setOrder] = useState<Order | null>(null);
  const [chatUrl, setChatUrl] = useState<string | undefined>();
  const [weighRows, setWeighRows] = useState<WeighRow[]>([]);
  const [trackingNo, setTrackingNo] = useState("");
  const [courier, setCourier] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const applyOrder = useCallback((o: Order, products?: OrderResponse["products"]) => {
    setOrder(o);
    setTrackingNo(o.trackingNo || "");
    setCourier(o.courier || "");
    setWeighRows(
      o.items.map((it, i) => ({
        pricePerKg: String(it.pricePerKg || products?.[i]?.pricePerKg || it.price || ""),
        fruitKgs: it.fruitKgs?.length
          ? it.fruitKgs.map(String)
          : Array.from({ length: Math.max(1, it.qty) }, () => ""),
      }))
    );
  }, []);

  const fetchOrder = useCallback(async (fresh = false): Promise<OrderResponse> => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}${fresh ? "?fresh=1" : ""}`, { cache: "no-store" });
      return (await res.json()) as OrderResponse;
    } catch {
      return { ok: false, error: "โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง" };
    }
  }, [orderId]);

  const showResponse = useCallback(
    (json: OrderResponse) => {
      setError("");
      if ((json as { code?: string }).code === "LOGIN_REQUIRED") {
        setNeedLogin(true);
      } else if (!json.ok || !json.order) {
        setError(json.error || "ไม่พบออเดอร์นี้");
      } else if (!json.isAdmin) {
        setNeedLogin(true);
      } else {
        setNeedLogin(false);
        setChatUrl(json.chatUrl);
        applyOrder(json.order, json.products);
      }
      setLoading(false);
    },
    [applyOrder]
  );

  const load = useCallback(async () => showResponse(await fetchOrder(true)), [fetchOrder, showResponse]);

  // เปิดทันทีจากแคช แล้วอ่านสดจากชีตเบื้องหลัง — เปลี่ยนเฉพาะถ้าข้อมูลในชีตใหม่กว่า (เช่น สลิปเพิ่งเข้า)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const quick = await fetchOrder();
      if (cancelled) return;
      showResponse(quick);
      if (!quick.ok || !quick.isAdmin) return;
      setSyncing(true);
      const latest = await fetchOrder(true);
      if (cancelled) return;
      setSyncing(false);
      if (latest.ok && latest.order && JSON.stringify(latest.order) !== JSON.stringify(quick.order)) showResponse(latest);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchOrder, showResponse]);

  const patch = async (payload: Record<string, unknown>, okText: string) => {
    if (!order) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as OrderResponse;
      if (!res.ok || !json.ok || !json.order) {
        setError(json.error || "บันทึกไม่สำเร็จ");
        return;
      }
      applyOrder(json.order);
      setNotice(okText);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <Shell><p className="text-center text-sm text-stone-500 py-16">กำลังโหลดออเดอร์ {orderId}...</p></Shell>;
  }

  if (needLogin) {
    const returnUrl = encodeURIComponent(`/admin/orders/${orderId}`);
    return (
      <Shell>
        <div className="bg-white rounded-3xl border border-stone-200 p-8 space-y-5 max-w-sm mx-auto mt-10 text-center shadow-lg">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-[#06C755]/10 border border-[#06C755]/30 flex items-center justify-center">
            <LineIcon className="w-9 h-9 text-[#06C755]" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-stone-900">
              เข้าถึงเฉพาะแอดมิน
            </h3>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              กรุณาเข้าสู่ระบบด้วยบัญชี LINE ผู้ดูแลระบบ เพื่อเปิดและจัดการออเดอร์ #{orderId}
            </p>
          </div>
          {error && <p className="text-xs text-rose-600 bg-rose-50 py-2 px-3 rounded-xl">{error}</p>}
          <a
            href={`/api/auth/line/login?redirect=${returnUrl}`}
            className="w-full bg-[#06C755] hover:bg-[#05b34c] text-white font-black py-3.5 px-4 rounded-2xl text-sm transition flex items-center justify-center gap-2 shadow-md active:scale-[0.99]"
          >
            <LineIcon className="w-5 h-5 text-white" />
            <span>เข้าสู่ระบบด้วย LINE</span>
          </a>
          <a
            href="/"
            className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 pt-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>กลับไปหน้าร้านค้า</span>
          </a>
        </div>
      </Shell>
    );
  }

  if (!order) {
    return <Shell><p className="text-center text-sm text-rose-600 py-16">{error || "ไม่พบออเดอร์นี้"}</p></Shell>;
  }

  const status = orderStatusOf(order);
  const payment = normalizePaymentStatus(order.paymentStatus);
  const meta = ORDER_STATUS_META[status];
  const weighable = canWeigh(order);
  const weighTotal = weighRows.reduce(
    (s, row) => s + Math.round(kgSum(row.fruitKgs) * (parseFloat(row.pricePerKg) || 0)),
    0
  );
  const weighReady = weighRows.every(
    (row) => row.fruitKgs.length > 0 && row.fruitKgs.every((v) => parseFloat(v) > 0) && parseFloat(row.pricePerKg) > 0
  );
  const grandTotal = order.totalPrice + (order.shippingCost || 0);

  const setRow = (i: number, next: WeighRow) => setWeighRows((rows) => rows.map((r, j) => (j === i ? next : r)));

  return (
    <Shell>
      {/* หัว: เลขออเดอร์ + สถานะ */}
      <div className="flex items-center justify-between gap-2">
        <a href="/admin" className="text-xs text-stone-500 inline-flex items-center gap-1 hover:text-stone-800">
          <ArrowLeft className="w-3.5 h-3.5" /> หลังบ้านทั้งหมด
        </a>
        <span className="text-[11px] text-stone-400 font-mono">
          {new Date(order.createDate || order.createdAt).toLocaleString("th-TH")}
        </span>
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-black font-mono text-stone-900">#{order.id}</h1>
          <span className="text-xs font-bold px-3 py-1 rounded-full text-white" style={{ background: meta.color }}>
            {meta.emoji} {status}
          </span>
        </div>
        <p className="text-xs text-stone-500 mt-1">
          การชำระเงิน: <strong className="text-stone-800">{PAYMENT_STATUS_LABEL[payment]}</strong>
          {status !== "สั่งจอง" && status !== "ยกเลิก" && (
            <>
              {" "}• ยอด <strong className="text-[#1B4D31]">฿{grandTotal.toLocaleString()}</strong>
            </>
          )}
        </p>
      </div>

      {syncing && <p className="text-[11px] text-stone-400 text-right -mb-2">⟳ กำลังเช็กข้อมูลล่าสุดจากชีต…</p>}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm font-bold rounded-2xl p-3">✅ {notice}</div>
      )}
      {error && <div className="bg-rose-50 border border-rose-300 text-rose-800 text-sm rounded-2xl p-3">❌ {error}</div>}

      {/* ลูกค้า (เฉพาะคนที่สั่งออเดอร์นี้) */}
      <Section title="ลูกค้า">
        <p className="font-bold text-stone-900">{order.customerName}</p>
        <p className="text-sm text-stone-700 font-mono">{order.phone}</p>
        {order.address && <p className="text-sm text-stone-600 mt-1 whitespace-pre-line">{order.address}</p>}
        <div className="flex flex-wrap gap-2 mt-3">
          {order.lineUserId && chatUrl && (
            <a href={chatUrl} target="_blank" rel="noreferrer" className={btn("bg-[#06C755] text-white")}>
              <MessageCircle className="w-4 h-4" /> แชท LINE
            </a>
          )}
          <a href={`tel:${order.phone}`} className={btn("bg-stone-100 text-stone-800")}>
            <Phone className="w-4 h-4" /> โทร
          </a>
          <a
            href={order.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address || "")}`}
            target="_blank"
            rel="noreferrer"
            className={btn("bg-stone-100 text-stone-800")}
          >
            <MapPin className="w-4 h-4" /> แผนที่
          </a>
        </div>
      </Section>

      {/* รายการ + ฟอร์มชั่ง */}
      <Section title={weighable ? "⚖️ ชั่งน้ำหนัก" : "รายการสินค้า"}>
        {order.ripenessPref && <p className="text-xs text-amber-800 font-semibold mb-3">ความสุก: {order.ripenessPref}</p>}
        <div className="space-y-4">
          {order.items.map((it, i) => {
            const row = weighRows[i];
            if (!weighable || !row) {
              return (
                <div key={i} className="text-sm border-b border-stone-100 pb-3">
                  <p className="font-bold text-stone-900">{it.productName}</p>
                  {it.actualWeightKg ? (
                    <p className="text-stone-600 text-xs mt-0.5">
                      {it.qty} ลูก{it.fruitKgs?.length ? ` (${it.fruitKgs.join(" + ")} กก.)` : ""} = {it.actualWeightKg} กก. × ฿
                      {(it.pricePerKg || it.price).toLocaleString()} ={" "}
                      <strong>฿{Math.round(it.actualWeightKg * (it.pricePerKg || it.price)).toLocaleString()}</strong>
                    </p>
                  ) : (
                    <p className="text-stone-600 text-xs mt-0.5">
                      {it.qty} ลูก • ฿{(it.pricePerKg || it.price).toLocaleString()}/กก.
                    </p>
                  )}
                </div>
              );
            }
            const kg = kgSum(row.fruitKgs);
            const perKg = parseFloat(row.pricePerKg) || 0;
            return (
              <div key={i} className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div>
                    <p className="font-bold text-stone-900 text-sm">{it.productName}</p>
                    <p className="text-[11px] text-stone-500">ลูกค้าจอง {it.qty} ลูก</p>
                  </div>
                  <label className="text-[11px] text-stone-600 text-right">
                    ราคา/กก.
                    <input
                      type="number"
                      inputMode="decimal"
                      min={1}
                      value={row.pricePerKg}
                      onChange={(e) => setRow(i, { ...row, pricePerKg: e.target.value })}
                      className="block w-24 border border-stone-300 rounded-lg px-2 py-1 text-sm font-bold font-mono text-right bg-white"
                    />
                  </label>
                </div>
                <div className="space-y-2">
                  {row.fruitKgs.map((v, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <span className="text-xs text-stone-600 w-14 shrink-0">ลูกที่ {j + 1}</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min={0.1}
                        max={30}
                        value={v}
                        placeholder="กก."
                        onChange={(e) =>
                          setRow(i, { ...row, fruitKgs: row.fruitKgs.map((x, k) => (k === j ? e.target.value : x)) })
                        }
                        className="flex-1 border-2 border-emerald-500 rounded-xl px-3 py-2 text-base font-black font-mono text-emerald-900 text-center bg-white"
                      />
                      <span className="text-xs text-stone-500 w-6">กก.</span>
                      {row.fruitKgs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setRow(i, { ...row, fruitKgs: row.fruitKgs.filter((_, k) => k !== j) })}
                          className="p-2 rounded-lg bg-white border border-stone-200 text-stone-500"
                          aria-label={`ลบลูกที่ ${j + 1}`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <button
                    type="button"
                    onClick={() => setRow(i, { ...row, fruitKgs: [...row.fruitKgs, ""] })}
                    className="text-xs font-bold text-emerald-800 inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มลูก
                  </button>
                  <p className="text-xs text-stone-700 font-mono">
                    {row.fruitKgs.length} ลูก • {kg.toFixed(2)} กก. × ฿{perKg.toLocaleString()} ={" "}
                    <strong>฿{Math.round(kg * perKg).toLocaleString()}</strong>
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between text-sm text-stone-600 mt-4 pt-3 border-t border-stone-100">
          <span className="inline-flex items-center gap-1">
            <Truck className="w-4 h-4" /> {order.shippingMethod}
          </span>
          <span className="font-mono">฿{order.shippingCost.toLocaleString()}</span>
        </div>

        {weighable && (
          <>
            <div className="bg-[#1B4D31] text-white rounded-2xl p-4 flex items-center justify-between mt-3">
              <span className="text-xs text-emerald-100">ยอดที่ลูกค้าต้องโอน</span>
              <span className="text-2xl font-black font-mono text-amber-300">
                ฿{(weighTotal + (order.shippingCost || 0)).toLocaleString()}
              </span>
            </div>
            <button
              type="button"
              disabled={busy || !weighReady}
              onClick={() =>
                patch(
                  {
                    weigh: {
                      items: weighRows.map((row) => ({
                        pricePerKg: parseFloat(row.pricePerKg) || undefined,
                        fruitKgs: row.fruitKgs.map((v) => parseFloat(v)),
                      })),
                    },
                  },
                  order.lineUserId ? "บันทึกน้ำหนักแล้ว — ส่งยอด + QR ให้ลูกค้าทาง LINE แล้ว" : "บันทึกน้ำหนักแล้ว — ลูกค้าไม่ได้สั่งผ่าน LINE แจ้งยอดเองนะครับ"
                )
              }
              className="w-full mt-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 rounded-xl disabled:opacity-40 inline-flex items-center justify-center gap-2"
            >
              <Scale className="w-4 h-4" />
              {status === "สั่งจอง" ? "บันทึกน้ำหนัก & ส่งยอดให้ลูกค้า" : "แก้น้ำหนัก & ส่งยอดใหม่"}
            </button>
            {!weighReady && <p className="text-[11px] text-stone-500 text-center mt-1">กรอกน้ำหนักให้ครบทุกลูกก่อน</p>}
          </>
        )}
      </Section>

      {/* การชำระเงิน */}
      {status === "รอชำระเงิน" && (
        <Section title="💳 การชำระเงิน">
          {order.slipUrl ? (
            <a href={order.slipUrl} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={order.slipUrl} alt="สลิปโอนเงิน" className="w-full max-h-[480px] object-contain rounded-xl border border-stone-200 bg-stone-50" />
            </a>
          ) : (
            <p className="text-sm text-stone-500">ลูกค้ายังไม่ได้ส่งสลิป</p>
          )}
          {order.slipUrl && (
            <div
              className={`mt-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                slipTone(order) === "ok"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : slipTone(order) === "bad"
                  ? "bg-rose-50 border-rose-200 text-rose-800"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
            >
              <p>{slipCheckText(order.slipCheck).label}</p>
              {slipAmountText(order) && <p className="mt-0.5">{slipAmountText(order)}</p>}
              {slipAccountText(order.slipAccountCheck) && <p className="mt-0.5">{slipAccountText(order.slipAccountCheck)}</p>}
              {order.slipBank && (
                <p className="font-normal mt-0.5">
                  โอนจาก {order.slipBank}
                  {order.slipRef ? <> · เลขรายการ <span className="font-mono">{order.slipRef}</span></> : null}
                </p>
              )}
              {order.slipFileUrl && (
                <a href={order.slipFileUrl} target="_blank" rel="noreferrer" className="inline-block mt-1 underline font-normal">
                  เปิดสลิปที่เก็บใน Google Drive
                </a>
              )}
              <p className="font-normal text-stone-500 mt-0.5">ผลนี้อ่านจากรูป — สลิปปลอมที่ทำมาเนียนยังหลุดได้ เช็กเงินเข้าในแอปธนาคารก่อนกดยืนยัน</p>
            </div>
          )}
          <p className="text-sm mt-3">
            ยอดที่ต้องได้รับ: <strong className="text-[#1B4D31] text-lg font-mono">฿{grandTotal.toLocaleString()}</strong>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (payment === "slip_submitted" || confirm("ยังไม่มีสลิป — ยืนยันว่าได้รับเงินแล้ว?")) {
                  patch({ orderStatus: "ชำระเงินแล้ว/เตรียมจัดส่ง" }, "ยืนยันรับเงินแล้ว — แจ้งลูกค้าแล้ว");
                }
              }}
              className={btn("bg-[#1B4D31] text-white justify-center py-3")}
            >
              <CheckCircle2 className="w-4 h-4" /> ยอดถูกต้อง ยืนยันรับเงิน
            </button>
            {payment === "slip_submitted" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => patch({ rejectSlip: true }, "ตีกลับสลิปแล้ว — ส่ง QR ให้ลูกค้าโอนใหม่")}
                className={btn("bg-amber-100 text-amber-900 justify-center py-3")}
              >
                <Receipt className="w-4 h-4" /> ยอดไม่ตรง ให้โอนใหม่
              </button>
            )}
          </div>
        </Section>
      )}

      {/* จัดส่ง */}
      {(status === "ชำระเงินแล้ว/เตรียมจัดส่ง" || status === "กำลังจัดส่ง") && (
        <Section title="🚚 จัดส่ง">
          {status === "ชำระเงินแล้ว/เตรียมจัดส่ง" ? (
            <>
              <select
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2.5 text-sm bg-white mb-2"
              >
                <option value="">ขนส่ง (จับจากเลขพัสดุอัตโนมัติ)</option>
                {COURIER_OPTIONS.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                value={trackingNo}
                onChange={(e) => setTrackingNo(e.target.value)}
                placeholder="เลขพัสดุ (ไม่มีก็เว้นว่างได้)"
                className="w-full border border-stone-300 rounded-xl px-3 py-2.5 text-sm font-mono mb-3"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  patch(
                    { orderStatus: "กำลังจัดส่ง", trackingNo, courier: courier || undefined },
                    "บันทึกจัดส่งแล้ว — แจ้งลูกค้าแล้ว"
                  )
                }
                className={btn("bg-indigo-600 text-white w-full justify-center py-3")}
              >
                <Truck className="w-4 h-4" /> ส่งของแล้ว
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-stone-700 mb-3">
                {order.courier} {order.trackingNo && <span className="font-mono">• {order.trackingNo}</span>}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => patch({ orderStatus: "จัดส่งสำเร็จ" }, "ปิดออเดอร์แล้ว — เริ่มนับประกันเคลม 24 ชม.")}
                className={btn("bg-emerald-700 text-white w-full justify-center py-3")}
              >
                <CheckCircle2 className="w-4 h-4" /> ลูกค้าได้รับของแล้ว
              </button>
            </>
          )}
        </Section>
      )}

      {/* ยกเลิก */}
      {["สั่งจอง", "รอชำระเงิน", "ชำระเงินแล้ว/เตรียมจัดส่ง"].includes(status) && (
        <Section title="ยกเลิกออเดอร์">
          <input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="เหตุผล (แจ้งลูกค้า) เช่น ของหมด"
            className="w-full border border-rose-200 rounded-xl px-3 py-2.5 text-sm mb-2"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (confirm(`ยกเลิกออเดอร์ #${order.id}? ระบบจะคืนสต็อกและแจ้งลูกค้า`)) {
                patch({ orderStatus: "ยกเลิก", cancelReason: cancelReason || undefined }, "ยกเลิกแล้ว — คืนสต็อกและแจ้งลูกค้าแล้ว");
              }
            }}
            className={btn("bg-rose-50 text-rose-700 border border-rose-200 w-full justify-center py-3")}
          >
            <XCircle className="w-4 h-4" /> ยกเลิกออเดอร์
          </button>
          {payment === "confirmed" && <p className="text-[11px] text-rose-600 mt-1">ลูกค้าจ่ายแล้ว — ต้องโอนเงินคืนเอง</p>}
        </Section>
      )}

      {status === "ยกเลิก" && (
        <Section title="❌ ยกเลิกแล้ว">
          <p className="text-sm text-stone-600">{order.cancelReason || "-"}</p>
        </Section>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-100">
      <div className="max-w-xl mx-auto px-4 py-5 space-y-3">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-stone-200 p-5">
      <h2 className="text-sm font-extrabold text-stone-900 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function btn(extra: string) {
  return `inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold transition disabled:opacity-50 ${extra}`;
}
