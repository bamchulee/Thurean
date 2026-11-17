"use client";

// หลังบ้านร้าน: แถบเมนูซ้าย (มือถือ: แถบเลื่อนด้านบน) + แถบปุ่มประจำทุกหน้า (บันทึก / ล้างค่า / ทดสอบระบบ / กลับหน้าหลัก)
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, LayoutDashboard, LogOut, Package, Plug, RefreshCw, ShieldCheck, Truck, Users } from "lucide-react";
import { shopInfo } from "../../data/shop";
import { LineIcon } from "../../components/Icons";
import type { Claim, LotCost, Order, Product, Round, SafeUser } from "../../types/durian";
import { ActionBar, ActionsProvider, type PageActions } from "./_ui/kit";
import { HealthDialog } from "./_ui/HealthDialog";
import { Overview } from "./_ui/Overview";
import { Orders } from "./_ui/Orders";
import { Products } from "./_ui/Products";
import { Rounds } from "./_ui/Rounds";
import { Claims } from "./_ui/Claims";
import { Members } from "./_ui/Members";
import { Settings } from "./_ui/Settings";
import type { TabId } from "./_ui/shared";

const NAV: { id: TabId; label: string; icon: typeof LayoutDashboard; staff?: boolean }[] = [
  { id: "dashboard", label: "ภาพรวม", icon: LayoutDashboard },
  { id: "orders", label: "รายการสั่งซื้อ", icon: ClipboardList, staff: true },
  { id: "products", label: "สินค้า", icon: Package },
  { id: "rounds", label: "รอบรถ & ต้นทุน", icon: Truck },
  { id: "claims", label: "ศูนย์เคลม", icon: ShieldCheck, staff: true },
  { id: "users", label: "สมาชิก", icon: Users },
  { id: "settings", label: "การเชื่อมต่อ", icon: Plug },
];

function LoginScreen() {
  return (
    <div className="min-h-screen bg-[#11301F] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center space-y-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shopInfo.logo} alt={shopInfo.name} className="w-20 h-20 rounded-full border border-stone-200 mx-auto object-cover" />
        <div>
          <h1 className="text-xl font-extrabold text-[#1B4D31]">{shopInfo.name}</h1>
          <p className="text-xs text-stone-500 mt-1">หลังบ้าน — เฉพาะเจ้าของร้านและพนักงาน</p>
        </div>
        <a href="/api/auth/line/login?redirect=/admin" className="w-full bg-[#06C755] hover:bg-[#05b34c] text-white py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2">
          <LineIcon className="w-5 h-5 text-white" /> เข้าสู่ระบบด้วย LINE
        </a>
        <p className="text-[11px] text-stone-400">เข้าแล้วยังไม่เห็นหน้านี้ ให้เจ้าของร้านตั้งสิทธิ์ในเมนู สมาชิก</p>
        <Link href="/" className="block text-xs text-stone-400 hover:text-stone-600">
          ← กลับหน้าร้าน
        </Link>
      </div>
    </div>
  );
}

function tabFromUrl(): { tab?: TabId; filter?: string } {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  const tab = p.get("tab") as TabId | null;
  return { tab: tab && NAV.some((n) => n.id === tab) ? tab : undefined, filter: p.get("filter") || undefined };
}

export default function AdminPage() {
  const [auth, setAuth] = useState<{ checked: boolean; role: "admin" | "staff" | null; name?: string }>({ checked: false, role: null });
  const [tab, setTab] = useState<TabId>("dashboard");
  const [orderFilter, setOrderFilter] = useState<string | undefined>();
  const [actions, setActions] = useState<PageActions>({});
  const [health, setHealth] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [lots, setLots] = useState<LotCost[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState("");

  const loadAll = useCallback(async (role: "admin" | "staff") => {
    setLoading(true);
    try {
      const get = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ ok: false }));
      const [shop, ord, rnd, clm] = await Promise.all([get("/api/shop"), get("/api/orders"), get("/api/rounds"), get("/api/claims")]);
      if (shop.ok) {
        setProducts(shop.products || []);
        setWarning(shop.warning || "");
      }
      if (ord.ok) setOrders(ord.orders || []);
      if (rnd.ok) setRounds(rnd.rounds || []);
      if (clm.ok) setClaims(clm.claims || []);
      if (role === "admin") {
        const [lot, usr] = await Promise.all([get("/api/lots"), get("/api/admin/users")]);
        if (lot.ok) setLots(lot.lots || []);
        if (usr.ok) setUsers(usr.users || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin/auth", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { authenticated?: boolean; role?: string; user?: { displayName?: string; firstName?: string } }) => {
        const role = j.authenticated && (j.role === "admin" || j.role === "staff") ? j.role : null;
        setAuth({ checked: true, role, name: j.user?.displayName || j.user?.firstName });
        if (!role) return;
        const fromUrl = tabFromUrl();
        const allowed = (t?: TabId) => t && (role === "admin" || NAV.find((n) => n.id === t)?.staff);
        setTab(allowed(fromUrl.tab) ? (fromUrl.tab as TabId) : role === "staff" ? "orders" : "dashboard");
        setOrderFilter(fromUrl.filter);
        loadAll(role);
      })
      .catch(() => setAuth({ checked: true, role: null }));
  }, [loadAll]);

  const go = useCallback((t: TabId, filter?: string) => {
    setTab(t);
    setOrderFilter(filter);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    if (filter) url.searchParams.set("filter", filter);
    else url.searchParams.delete("filter");
    window.history.replaceState({}, "", url.toString());
  }, []);

  const logout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    window.location.href = "/";
  };

  if (!auth.checked) return <div className="min-h-screen bg-[#F8F7F3] flex items-center justify-center text-sm font-bold text-stone-500">กำลังตรวจสอบสิทธิ์...</div>;
  if (!auth.role) return <LoginScreen />;

  const role = auth.role;
  const nav = NAV.filter((n) => role === "admin" || n.staff);
  const current = NAV.find((n) => n.id === tab) || NAV[0];
  const badge: Partial<Record<TabId, number>> = {
    orders: orders.filter((o) => o.paymentStatus === "slip_submitted").length,
    claims: claims.filter((c) => c.status === "pending").length,
  };
  const home = tab === "dashboard" || role === "staff" ? { label: "หน้าร้าน", run: () => (window.location.href = "/") } : { label: "กลับหน้าหลัก", run: () => go("dashboard") };

  return (
    <ActionsProvider value={setActions}>
      <div className="min-h-screen bg-[#F8F7F3]">
        {/* เมนูซ้าย (จอใหญ่) */}
        <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 bg-[#11301F] text-white flex-col">
          <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shopInfo.logo} alt="" className="w-10 h-10 rounded-full bg-white object-cover" />
            <div className="min-w-0">
              <div className="font-extrabold text-sm truncate">{shopInfo.name}</div>
              <div className="text-[11px] text-emerald-200/70">{role === "admin" ? "เจ้าของร้าน" : "พนักงาน"}</div>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {nav.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => go(n.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${tab === n.id ? "bg-white text-[#11301F]" : "text-emerald-50/80 hover:bg-white/10"}`}
              >
                <n.icon className="w-4 h-4" />
                <span className="flex-1 text-left">{n.label}</span>
                {!!badge[n.id] && <span className="bg-amber-400 text-stone-900 text-[10px] font-black rounded-full px-1.5">{badge[n.id]}</span>}
              </button>
            ))}
          </nav>
          <button type="button" onClick={logout} className="m-3 flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-emerald-50/70 hover:bg-white/10">
            <LogOut className="w-4 h-4" /> ออกจากระบบ
          </button>
        </aside>

        <div className="md:ml-60">
          <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
            <div className="px-4 md:px-6 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <h1 className="font-extrabold text-stone-900 text-base">{current.label}</h1>
                <button type="button" onClick={() => loadAll(role)} disabled={loading} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" title="โหลดข้อมูลใหม่">
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
                <button type="button" onClick={logout} className="md:hidden ml-auto p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" title="ออกจากระบบ">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
              <ActionBar actions={actions} onTest={() => setHealth(true)} onHome={home.run} homeLabel={home.label} />
            </div>
            {/* เมนูมือถือ */}
            <nav className="md:hidden flex gap-1.5 overflow-x-auto px-4 pb-3">
              {nav.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => go(n.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${tab === n.id ? "bg-[#1B4D31] text-white border-[#1B4D31]" : "bg-white text-stone-600 border-stone-200"}`}
                >
                  <n.icon className="w-3.5 h-3.5" />
                  {n.label}
                  {!!badge[n.id] && <span className="bg-amber-400 text-stone-900 text-[10px] font-black rounded-full px-1.5">{badge[n.id]}</span>}
                </button>
              ))}
            </nav>
          </header>

          {warning && <div className="mx-4 md:mx-6 mt-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold p-3 rounded-xl">{warning}</div>}

          <main className="p-4 md:p-6 pb-16">
            {tab === "dashboard" && (
              <Overview orders={orders} products={products} lots={lots} rounds={rounds} claims={claims} onOpenOrders={(f) => go("orders", f)} onGoTab={(t) => go(t)} />
            )}
            {tab === "orders" && (
              <Orders
                key={orderFilter || "all"}
                orders={orders}
                products={products}
                rounds={rounds}
                users={users}
                initialFilter={orderFilter}
                onOrderCreated={(o) => setOrders((prev) => [o, ...prev])}
              />
            )}
            {tab === "products" && (
              <Products
                products={products}
                onUpdated={(p) => setProducts((prev) => prev.map((x) => (x.id === p.id ? p : x)))}
                onCreated={(p) => setProducts((prev) => [...prev, p])}
              />
            )}
            {tab === "rounds" && (
              <Rounds
                rounds={rounds}
                lots={lots}
                orders={orders}
                onRoundCreated={(r) => setRounds((prev) => [r, ...prev])}
                onRoundUpdated={(r) => setRounds((prev) => prev.map((x) => (x.id === r.id ? r : x)))}
                onLotCreated={(l) => setLots((prev) => [l, ...prev])}
              />
            )}
            {tab === "claims" && <Claims claims={claims} onUpdated={(c) => setClaims((prev) => prev.map((x) => (x.claimId === c.claimId ? c : x)))} />}
            {tab === "users" && <Members users={users} onSaved={() => loadAll(role)} />}
            {tab === "settings" && <Settings />}
          </main>
        </div>
        {health && <HealthDialog onClose={() => setHealth(false)} />}
      </div>
    </ActionsProvider>
  );
}
