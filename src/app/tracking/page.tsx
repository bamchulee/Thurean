"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  MapPin,
  Package,
  RefreshCw,
  Scale,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Truck,
  User,
  X,
  XCircle,
  MessageSquare,
} from "lucide-react";
import { shopInfo } from "../../data/mock";
import type { Order } from "../../types/durian";
import { LineIcon } from "../../components/Icons";
import { resolveCourierInfo } from "../../lib/courier";

interface CurrentUser {
  id: string;
  name?: string;
  displayName?: string;
  lineUserId?: string;
  phone?: string;
  role?: string;
}

const statusSteps = [
  {
    key: "รอชั่งน้ำหนัก/สรุปยอด",
    aliases: ["received", "pending_weigh"],
    icon: Scale,
    label: "1. รอชั่งน้ำหนัก & สรุปราคา",
    desc: "ทีมงานคัดผลผลิตตามเกรดและไซส์ นำขึ้นตาชั่งเพื่อสรุปราคาจริง",
  },
  {
    key: "รอชำระเงิน",
    aliases: ["pending_payment", "weighed"],
    icon: Clock,
    label: "2. รอชำระเงิน",
    desc: "แจ้งยอดชั่งจริงพร้อม QR Code PromptPay ให้ลูกค้าชำระเงิน",
  },
  {
    key: "ชำระเงินแล้ว/เตรียมจัดส่ง",
    aliases: ["paid", "preparing", "packed"],
    icon: Package,
    label: "3. ชำระเงินแล้ว / เตรียมจัดส่ง",
    desc: "ร้านตรวจสอบยอดชำระ แพ็กกล่องเจาะรูระบายอากาศ / คุมความเย็น",
  },
  {
    key: "กำลังจัดส่ง",
    aliases: ["shipped", "shipping"],
    icon: Truck,
    label: "4. กำลังจัดส่ง",
    desc: "ส่งมอบให้บริษัทขนส่ง อยู่ระหว่างเดินทาง มีเลขพัสดุสำหรับติดตาม",
  },
  {
    key: "จัดส่งสำเร็จ",
    aliases: ["delivered", "completed", "claimed"],
    icon: CheckCircle2,
    label: "5. จัดส่งสำเร็จ (ประกัน 24 ชม.)",
    desc: "พัสดุถึงมือผู้รับเรียบร้อย • สามารถกดแจ้งเคลมได้ภายใน 24 ชม.",
  },
];

function getStatusIndex(status?: string): number {
  if (!status) return 0;
  if (status === "claimed") return 4;
  const idx = statusSteps.findIndex(
    (s) => s.key === status || s.aliases.includes(status)
  );
  return idx >= 0 ? idx : 0;
}

function getClaimWarrantyInfo(order: Order): {
  isDelivered: boolean;
  isEligible: boolean;
  isClaimed: boolean;
  hoursElapsed: number;
  hoursLeft: number;
  minutesLeft: number;
} {
  const isClaimed = order.orderStatus === "claimed";
  const isDelivered =
    order.orderStatus === "จัดส่งสำเร็จ" ||
    order.orderStatus === "delivered" ||
    isClaimed;

  if (!isDelivered) {
    return {
      isDelivered: false,
      isEligible: false,
      isClaimed: false,
      hoursElapsed: 0,
      hoursLeft: 0,
      minutesLeft: 0,
    };
  }

  const deliveredTime = order.deliveredAt
    ? new Date(order.deliveredAt).getTime()
    : order.updatedAt
    ? new Date(order.updatedAt).getTime()
    : new Date(order.createdAt).getTime();

  const now = Date.now();
  const diffHours = (now - deliveredTime) / (1000 * 60 * 60);
  const hoursElapsed = Math.floor(diffHours);
  const totalMinutesRemaining = Math.max(
    0,
    Math.floor(24 * 60 - diffHours * 60)
  );
  const hoursLeft = Math.floor(totalMinutesRemaining / 60);
  const minutesLeft = totalMinutesRemaining % 60;
  const isEligible = diffHours <= 24 && !isClaimed;

  return {
    isDelivered: true,
    isEligible,
    isClaimed,
    hoursElapsed,
    hoursLeft,
    minutesLeft,
  };
}

export default function TrackingPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Search state
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<Order[] | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [copiedTrack, setCopiedTrack] = useState(false);

  // Filter tab for user's order list
  const [filterTab, setFilterTab] = useState<"all" | "in_progress" | "delivered" | "cancelled">("all");

  // Ticket Modal state
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketOrder, setTicketOrder] = useState<Order | null>(null);
  const [ticketName, setTicketName] = useState("");
  const [ticketPhone, setTicketPhone] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState<string | null>(null);

  const handleOpenTicket = (order?: Order | null) => {
    const targetOrder = order || selectedOrder || null;
    setTicketOrder(targetOrder);
    if (targetOrder) {
      setTicketName(targetOrder.customerName || "");
      setTicketPhone(targetOrder.phone || "");
    } else if (currentUser) {
      setTicketName(currentUser.name || currentUser.displayName || "");
    }
    setTicketMessage("");
    setTicketSuccess(null);
    setShowTicketModal(true);
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketMessage.trim()) return;
    setSubmittingTicket(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: ticketName,
          phone: ticketPhone,
          orderId: ticketOrder?.id,
          message: ticketMessage,
          source: "web-tracking",
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setTicketSuccess(json.ticketId);
        setTicketMessage("");
      } else {
        alert(json.error || "เกิดข้อผิดพลาดในการส่งข้อความ");
      }
    } catch {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmittingTicket(false);
    }
  };

  // Load current session & user orders
  const loadUserAndOrders = async () => {
    setLoadingOrders(true);
    try {
      // 1. Check logged-in user
      const meRes = await fetch("/api/auth/me");
      const meJson = await meRes.json();
      if (meRes.ok && meJson.ok && meJson.user) {
        setCurrentUser(meJson.user);
      } else {
        setCurrentUser(null);
      }

      // 2. Fetch orders
      const ordersRes = await fetch("/api/orders");
      const ordersJson = await ordersRes.json();
      if (ordersRes.ok && ordersJson.ok && Array.isArray(ordersJson.orders)) {
        setUserOrders(ordersJson.orders);
      } else {
        setUserOrders([]);
      }
    } catch {
      setUserOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    loadUserAndOrders();

    // Check query params (?id=OD123456 or ?phone=0812345678)
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    const phoneParam = params.get("phone");
    if (idParam) {
      setSearchInput(idParam);
      performLookup(idParam);
    } else if (phoneParam) {
      setSearchInput(phoneParam);
      performLookup(phoneParam);
    }
  }, []);

  const performLookup = async (query: string) => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setNotFound(false);
    setSelectedOrder(null);
    setSearchResults(null);

    const cleanDigits = q.replace(/[^\d]/g, "");
    const isPhoneNumber = cleanDigits.length >= 9 && cleanDigits.length <= 11 && !q.toUpperCase().startsWith("OD") && !q.toUpperCase().startsWith("WK");

    try {
      if (isPhoneNumber) {
        // Search by phone number
        const res = await fetch(`/api/orders?phone=${encodeURIComponent(cleanDigits)}`);
        const json = await res.json();
        if (res.ok && json.ok && Array.isArray(json.orders) && json.orders.length > 0) {
          setSearchResults(json.orders);
          if (json.orders.length === 1) {
            setSelectedOrder(json.orders[0]);
          }
        } else {
          setNotFound(true);
        }
      } else {
        // Search by Order ID or Tracking Number
        const res = await fetch(`/api/orders/${encodeURIComponent(q)}`);
        const json = (await res.json()) as { ok: boolean; order?: Order };
        if (res.ok && json.ok && json.order) {
          setSelectedOrder(json.order);
          setSearchResults([json.order]);
        } else {
          setNotFound(true);
        }
      }
    } catch {
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performLookup(searchInput);
  };

  // Filter user orders
  const filteredUserOrders = userOrders.filter((o) => {
    const isDelivered = o.orderStatus === "จัดส่งสำเร็จ" || o.orderStatus === "delivered" || o.orderStatus === "claimed";
    const isCancelled = o.orderStatus === "ยกเลิก" || o.orderStatus === "cancelled";
    if (filterTab === "delivered") return isDelivered;
    if (filterTab === "cancelled") return isCancelled;
    if (filterTab === "in_progress") return !isDelivered && !isCancelled;
    return true;
  });

  const displayOrder = selectedOrder;
  const currentStep = displayOrder ? getStatusIndex(displayOrder.orderStatus) : -1;
  const courierInfo = displayOrder
    ? resolveCourierInfo(
        displayOrder.trackingNo,
        displayOrder.courier,
        displayOrder.shippingMethod
      )
    : null;

  const warranty = displayOrder ? getClaimWarrantyInfo(displayOrder) : null;

  return (
    <div className="min-h-screen bg-[#FBF6E3]">
      {/* Top Navbar */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <img
              src={shopInfo.logo}
              alt={shopInfo.name}
              className="w-10 h-10 rounded-full border border-stone-200 bg-white object-cover"
            />
            <div>
              <h1 className="font-extrabold text-sm sm:text-base text-[#1B4D31]">
                {shopInfo.name}
              </h1>
              <p className="text-[10px] sm:text-xs text-stone-500 font-mono">
                ประวัติคำสั่งซื้อ &amp; ติดตามพัสดุ
              </p>
            </div>
          </a>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadUserAndOrders}
              title="รีเฟรชข้อมูล"
              className="p-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? "animate-spin text-[#1B4D31]" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => handleOpenTicket(selectedOrder)}
              className="text-xs font-bold bg-amber-400 hover:bg-amber-300 text-stone-950 px-3.5 py-2 rounded-xl transition inline-flex items-center gap-1.5 shadow-xs"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">คุยกับแอดมิน (Ticket)</span>
              <span className="sm:hidden">Ticket</span>
            </button>
            <a
              href="/"
              className="text-xs font-bold bg-[#1B4D31] hover:bg-[#143B25] text-white px-3.5 py-2 rounded-xl transition inline-flex items-center gap-1.5 shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>กลับหน้าร้าน</span>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Title Header */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 bg-emerald-100/70 text-[#1B4D31] border border-emerald-300 text-xs font-bold px-3 py-1 rounded-full mb-2.5">
            <Package className="w-3.5 h-3.5 text-emerald-800" />
            <span>ORDER TRACKING &amp; CLAIM SYSTEM</span>
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
            ประวัติการสั่งซื้อ &amp; ติดตามสถานะ
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-lg mx-auto">
            ตรวจสอบความคืบหน้าคำสั่งซื้อ อัปเดตน้ำหนักชั่งจริง และแจ้งเคลมประกันคุณภาพสินค้าภายใน 24 ชม.
          </p>
        </div>

        {/* Search Box */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setNotFound(false);
                }}
                placeholder="กรอกรหัสออเดอร์ (เช่น OD000001) หรือ เบอร์โทร 10 หลัก"
                className="w-full border border-stone-300 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-[#1B4D31] focus:ring-1 focus:ring-[#1B4D31] focus:outline-none bg-stone-50/50 text-stone-900"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="bg-[#1B4D31] hover:bg-[#143B25] text-white px-6 py-3 rounded-xl text-sm font-bold transition shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 shrink-0"
            >
              {searching ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>กำลังค้นหา...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>ค้นหาออเดอร์</span>
                </>
              )}
            </button>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-xs text-stone-500 pt-3 border-t border-stone-100">
            <span>
              💡 ค้นหาได้ด้วย <strong>รหัสคำสั่งซื้อ OD...</strong> หรือ <strong>เบอร์โทรศัพท์ผู้รับ</strong>
            </span>
            {currentUser && (
              <span className="text-[#1B4D31] font-semibold flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                <span>เข้าสู่ระบบเป็น: {currentUser.name || currentUser.displayName || currentUser.id}</span>
              </span>
            )}
          </div>
        </div>

        {/* Not Found Alert */}
        {notFound && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center shadow-xs">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <p className="font-extrabold text-rose-800 text-base mb-1">
              ไม่พบข้อมูลคำสั่งซื้อในระบบ
            </p>
            <p className="text-xs text-stone-600 max-w-md mx-auto">
              กรุณาตรวจสอบรหัสออเดอร์หรือเบอร์โทรศัพท์อีกครั้ง หากสั่งซื้อผ่าน LINE OA สามารถสอบถามแอดมินได้โดยตรงที่{" "}
              <strong className="text-[#1B4D31] font-mono">{shopInfo.phone}</strong>
            </p>
          </div>
        )}

        {/* Search Results Multi-List (when searching by phone) */}
        {searchResults && searchResults.length > 1 && (
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-extrabold text-sm text-stone-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-[#1B4D31]" />
                <span>พบ {searchResults.length} คำสั่งซื้อที่เกี่ยวข้อง</span>
              </h3>
              <span className="text-xs text-stone-500">คลิกที่ออเดอร์เพื่อดูรายละเอียด</span>
            </div>
            <div className="space-y-2">
              {searchResults.map((order) => {
                const isSelected = selectedOrder?.id === order.id;
                const isDone = order.orderStatus === "จัดส่งสำเร็จ" || order.orderStatus === "delivered";
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedOrder(order)}
                    className={`w-full text-left p-3.5 rounded-xl border transition flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-emerald-50/70 border-emerald-500 ring-1 ring-emerald-500"
                        : "bg-stone-50 border-stone-200 hover:bg-stone-100/70"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-[#1B4D31]">
                          {order.id}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isDone
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {order.orderStatus || "กำลังดำเนินการ"}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 mt-1 line-clamp-1">
                        {order.items.map((it) => `${it.productName} x${it.qty}`).join(", ")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-sm text-stone-900">
                        ฿{(order.totalPrice + (order.shippingCost || 0)).toLocaleString()}
                      </span>
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        {new Date(order.createdAt).toLocaleDateString("th-TH", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Order Detailed Card */}
        {displayOrder && (
          <div className="space-y-5">
            {/* Order Header Summary */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 pb-4 mb-4">
                <div>
                  <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
                    รหัสคำสั่งซื้อ
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-black text-[#1B4D31] font-mono tracking-tight">
                      {displayOrder.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(displayOrder.id);
                        setCopiedTrack(true);
                        setTimeout(() => setCopiedTrack(false), 2000);
                      }}
                      title="คัดลอกรหัสออเดอร์"
                      className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-500 text-xs inline-flex items-center gap-1"
                    >
                      {copiedTrack ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-xs text-stone-500 mt-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-stone-400" />
                    <span>
                      สั่งซื้อเมื่อ:{" "}
                      {new Date(displayOrder.createdAt).toLocaleString("th-TH", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-extrabold inline-flex items-center gap-1.5 ${
                      displayOrder.orderStatus === "จัดส่งสำเร็จ" || displayOrder.orderStatus === "delivered"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : displayOrder.orderStatus === "ยกเลิก"
                        ? "bg-rose-100 text-rose-800 border border-rose-300"
                        : "bg-amber-100 text-amber-900 border border-amber-300"
                    }`}
                  >
                    {displayOrder.orderStatus === "จัดส่งสำเร็จ" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-amber-700" />
                    )}
                    <span>{displayOrder.orderStatus || "รอชั่งน้ำหนัก/สรุปยอด"}</span>
                  </span>

                  <span className="text-[11px] text-stone-500">
                    {displayOrder.channel ? `ช่องทาง: ${displayOrder.channel}` : "สั่งผ่านเว็บ"}
                  </span>
                </div>
              </div>

              {/* Recipient & Courier Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-stone-50/80 rounded-xl p-3.5 border border-stone-200">
                  <span className="text-stone-400 block text-[10px] uppercase font-bold">
                    ผู้รับสินค้า
                  </span>
                  <p className="font-bold text-stone-900 mt-1">
                    {displayOrder.customerName} ({displayOrder.phone})
                  </p>
                  {displayOrder.address && (
                    <p className="text-stone-500 text-[11px] mt-0.5 line-clamp-2">
                      {displayOrder.address}
                    </p>
                  )}
                </div>

                <div className="bg-stone-50/80 rounded-xl p-3.5 border border-stone-200">
                  <span className="text-stone-400 block text-[10px] uppercase font-bold">
                    ขนส่ง &amp; ยานพาหนะ
                  </span>
                  <p className="font-bold text-[#1B4D31] mt-1">
                    {courierInfo?.name || displayOrder.courier || "ไปรษณีย์ไทย EMS"}
                  </p>
                  <p className="text-[11px] text-stone-600 mt-0.5">
                    {displayOrder.vehicleType || "รถห้องเย็นปรับอุณหภูมิ"}
                  </p>
                </div>
              </div>

              {/* Weighed info notification */}
              {displayOrder.weightPerItem && (
                <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-950 p-3 rounded-xl text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>น้ำหนักชั่งจริงจากสวน:</strong> {displayOrder.weightPerItem}{" "}
                      {displayOrder.quantity ? `(จำนวน ${displayOrder.quantity} ลูก)` : ""}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-amber-800">
                    ฿{displayOrder.totalPrice.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* 24-HOUR WARRANTY & CLAIM BANNER (CRITICAL) */}
            {warranty && (
              <div
                className={`rounded-2xl p-5 border shadow-xs ${
                  warranty.isClaimed
                    ? "bg-blue-50 border-blue-200 text-blue-950"
                    : warranty.isDelivered && warranty.isEligible
                    ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                    : warranty.isDelivered && !warranty.isEligible
                    ? "bg-stone-100 border-stone-300 text-stone-700"
                    : "bg-amber-50/70 border-amber-200 text-amber-900"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {warranty.isClaimed ? (
                        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
                      ) : warranty.isDelivered && warranty.isEligible ? (
                        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                      ) : warranty.isDelivered ? (
                        <ShieldAlert className="w-5 h-5 text-stone-500 shrink-0" />
                      ) : (
                        <Timer className="w-5 h-5 text-amber-600 shrink-0" />
                      )}
                      <h4 className="font-extrabold text-sm sm:text-base">
                        {warranty.isClaimed
                          ? "ออเดอร์นี้ได้ยื่นเรื่องแจ้งเคลมแล้ว"
                          : warranty.isDelivered && warranty.isEligible
                          ? "อยู่ในระยะเวลารับประกันเคลมคุณภาพสินค้า (24 ชั่วโมง)"
                          : warranty.isDelivered
                          ? "สิ้นสุดระยะเวลารับประกันเคลมสินค้าแล้ว (เกิน 24 ชม.)"
                          : "เงื่อนไขการรับประกันเคลมคุณภาพ (24 ชั่วโมง)"}
                      </h4>
                    </div>

                    <p className="text-xs opacity-90 leading-relaxed">
                      {warranty.isClaimed
                        ? "ทีมงานกำลังตรวจสอบคำร้องและหลักฐานรูปภาพของท่าน หากมีความคืบหน้าจะแจ้งเตือนผ่าน LINE ทันที"
                        : warranty.isDelivered && warranty.isEligible
                        ? `สินค้าจัดส่งถึงมือแล้ว ${warranty.hoursElapsed} ชั่วโมง • สามารถเปิดกล้องถ่ายภาพและกดแจ้งเคลมได้อีก ${warranty.hoursLeft} ชั่วโมง ${warranty.minutesLeft} นาที`
                        : warranty.isDelivered
                        ? `จัดส่งสำเร็จแล้วเป็นเวลาประมาณ ${warranty.hoursElapsed} ชั่วโมง (เกิน 24 ชม. ตามนโยบายรับประกันความสดของสวนทุเรียนวินคิน)`
                        : "เมื่อสินค้าจัดส่งสำเร็จถึงมือผู้รับแล้ว ท่านสามารถตรวจสอบเนื้อทุเรียนและกดแจ้งเคลมผ่านระบบนี้ได้ภายใน 24 ชม."}
                    </p>
                  </div>

                  {warranty.isDelivered && warranty.isEligible && (
                    <a
                      href={`/claim?orderId=${encodeURIComponent(displayOrder.id)}`}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs px-5 py-3 rounded-xl transition shadow-sm inline-flex items-center justify-center gap-2 shrink-0"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>แจ้งเคลมสินค้านี้</span>
                    </a>
                  )}

                  {warranty.isDelivered && !warranty.isEligible && !warranty.isClaimed && (
                    <span className="text-[11px] font-bold bg-stone-200 text-stone-600 px-3 py-2 rounded-xl text-center shrink-0">
                      หมดเวลารับประกัน
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Stepper Timeline */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
              <h3 className="text-sm font-extrabold text-stone-900 mb-5 flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#1B4D31]" />
                <span>ขั้นตอนและสถานะการดำเนินการ</span>
              </h3>

              <div className="space-y-6 relative pl-7 border-l-2 border-stone-200 ml-3">
                {statusSteps.map((step, idx) => {
                  const isDone = idx <= currentStep;
                  const isCurrent = idx === currentStep;
                  const Icon = step.icon;

                  return (
                    <div key={step.key} className="relative">
                      <div
                        className={`absolute -left-[39px] -top-0.5 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-transform ${
                          isCurrent
                            ? "bg-amber-400 border-[#1B4D31] text-stone-950 scale-110 shadow-sm"
                            : isDone
                            ? "bg-[#1B4D31] border-[#1B4D31] text-white"
                            : "bg-white border-stone-300 text-stone-400"
                        }`}
                      >
                        {isCurrent ? (
                          <Icon className="w-3.5 h-3.5" />
                        ) : isDone ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Icon className="w-3 h-3" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm font-bold ${
                              isCurrent
                                ? "text-[#1B4D31]"
                                : isDone
                                ? "text-stone-800"
                                : "text-stone-400"
                            }`}
                          >
                            {step.label}
                          </p>
                          {isCurrent && (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              สถานะปัจจุบัน
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tracking Number Card */}
            {displayOrder.trackingNo && (
              <div className="bg-[#1B4D31] text-white rounded-2xl p-5 border border-emerald-900 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                <div>
                  <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider block">
                    หมายเลขพัสดุ • {courierInfo?.name || displayOrder.courier}
                  </span>
                  <p className="font-mono text-xl font-black text-white tracking-wider mt-0.5">
                    {displayOrder.trackingNo}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {courierInfo?.trackingUrl && (
                    <a
                      href={courierInfo.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-white/15 hover:bg-white/25 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>เปิดเว็บขนส่ง</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(displayOrder.trackingNo || "");
                      setCopiedTrack(true);
                      setTimeout(() => setCopiedTrack(false), 2000);
                    }}
                    className="bg-amber-400 hover:bg-amber-300 text-stone-950 px-4 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 shadow-xs"
                  >
                    {copiedTrack ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-stone-950" />
                        <span>คัดลอกแล้ว</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-stone-950" />
                        <span>คัดลอกเลข</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Items in Order */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
              <h3 className="text-sm font-extrabold text-stone-900 mb-3">
                รายการทุเรียนในคำสั่งซื้อ
              </h3>
              <div className="divide-y divide-stone-100 text-xs">
                {displayOrder.items.map((it, i) => (
                  <div key={i} className="py-2.5 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-stone-800">
                        {it.productName}
                      </span>
                      <span className="text-stone-400 ml-1.5">x{it.qty} {(it as any).unit || "ลูก"}</span>
                      {it.weightPerItem && (
                        <p className="text-[11px] text-amber-700">นน. ชั่งจริง: {it.weightPerItem}</p>
                      )}
                    </div>
                    <span className="font-mono font-bold text-stone-900">
                      ฿{(it.price * it.qty).toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="py-2.5 flex justify-between items-center text-stone-500">
                  <span>ค่าจัดส่ง (คุมอุณหภูมิ/EMS)</span>
                  <span className="font-mono">
                    {displayOrder.shippingCost === 0
                      ? "ฟรี"
                      : `฿${displayOrder.shippingCost.toLocaleString()}`}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-200 flex justify-between items-baseline mt-1">
                <span className="text-sm font-bold text-stone-700">
                  ยอดรวมทั้งสิ้น
                </span>
                <span className="text-2xl font-black text-[#1B4D31] font-mono">
                  ฿{(displayOrder.totalPrice + (displayOrder.shippingCost || 0)).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Contact Action */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => handleOpenTicket(displayOrder)}
                className="flex-1 py-3.5 rounded-xl bg-amber-400 text-stone-950 text-xs font-bold text-center hover:bg-amber-300 transition shadow-xs inline-flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4 text-stone-950" />
                <span>💬 เปิด Ticket คุยกับแอดมิน (#{displayOrder.id})</span>
              </button>
              <a
                href={`https://line.me/R/ti/p/${shopInfo.lineOA}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3.5 rounded-xl bg-[#06C755] text-white text-xs font-bold text-center hover:bg-[#05b34c] transition shadow-xs inline-flex items-center justify-center gap-2"
              >
                <LineIcon className="w-4 h-4" />
                <span>สอบถามแอดมินทาง LINE ({shopInfo.lineOA})</span>
              </a>
              <a
                href="/"
                className="flex-1 py-3.5 rounded-xl bg-white border border-stone-300 text-stone-700 text-xs font-bold text-center hover:bg-stone-50 transition inline-flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>กลับไปเลือกซื้อทุเรียนเพิ่ม</span>
              </a>
            </div>
          </div>
        )}

        {/* LOGGED-IN CUSTOMER ORDERS SECTION (When not currently inspecting single search) */}
        {!selectedOrder && (
          <div className="space-y-4 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-black text-lg text-stone-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-[#1B4D31]" />
                <span>ประวัติคำสั่งซื้อทั้งหมดของฉัน</span>
              </h3>

              {/* Filter Tabs */}
              <div className="flex items-center bg-stone-200/70 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFilterTab("all")}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    filterTab === "all"
                      ? "bg-white text-[#1B4D31] shadow-xs"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  ทั้งหมด ({userOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("in_progress")}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    filterTab === "in_progress"
                      ? "bg-white text-amber-900 shadow-xs"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  กำลังดำเนินการ
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("delivered")}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    filterTab === "delivered"
                      ? "bg-white text-emerald-800 shadow-xs"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  จัดส่งสำเร็จ (เสร็จสิ้น)
                </button>
              </div>
            </div>

            {loadingOrders ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
                <RefreshCw className="w-6 h-6 animate-spin text-[#1B4D31] mx-auto mb-2" />
                <p className="text-xs text-stone-500">กำลังโหลดประวัติการสั่งซื้อ...</p>
              </div>
            ) : filteredUserOrders.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
                  <Package className="w-6 h-6" />
                </div>
                <p className="font-bold text-stone-800 text-sm">
                  {filterTab === "all"
                    ? "ยังไม่พบรายการคำสั่งซื้อในระบบ"
                    : "ไม่มีรายการคำสั่งซื้อในหมวดหมู่นี้"}
                </p>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  หากคุณเคยสั่งซื้อผ่านเบอร์โทรศัพท์ สามารถพิมพ์เบอร์โทรในช่องค้นหาด้านบน หรือกดสั่งซื้อทุเรียนรอบใหม่ได้เลยครับ
                </p>
                <a
                  href="/"
                  className="inline-flex items-center gap-1.5 bg-[#1B4D31] text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-[#143B25] transition"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>สั่งซื้อทุเรียนรอบนี้</span>
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUserOrders.map((order) => {
                  const isDone =
                    order.orderStatus === "จัดส่งสำเร็จ" ||
                    order.orderStatus === "delivered";
                  const orderWarranty = getClaimWarrantyInfo(order);

                  return (
                    <div
                      key={order.id}
                      className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs hover:border-emerald-300 transition space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-stone-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-base text-[#1B4D31]">
                              #{order.id}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                isDone
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : order.orderStatus === "ยกเลิก"
                                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                                  : "bg-amber-100 text-amber-900 border border-amber-200"
                              }`}
                            >
                              {order.orderStatus || "รอชั่งน้ำหนัก/สรุปยอด"}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-400 mt-0.5">
                            สั่งเมื่อ:{" "}
                            {new Date(order.createdAt).toLocaleDateString("th-TH", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="font-mono font-black text-base text-stone-900">
                            ฿{(order.totalPrice + (order.shippingCost || 0)).toLocaleString()}
                          </span>
                          <p className="text-[10px] text-stone-400">
                            {order.paymentStatus === "confirmed" ? "ชำระแล้ว" : "รอชำระเงิน"}
                          </p>
                        </div>
                      </div>

                      {/* Items row */}
                      <div className="text-xs text-stone-700">
                        <p className="font-semibold text-stone-800">
                          {order.items.map((it) => `${it.productName} x${it.qty}`).join(", ")}
                        </p>
                        {order.weightPerItem && (
                          <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                            ⚖️ น้ำหนักชั่งจริง: {order.weightPerItem}
                          </p>
                        )}
                      </div>

                      {/* 24-hr Claim info & Action button */}
                      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100">
                        {isDone ? (
                          orderWarranty.isEligible ? (
                            <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>อยู่ในเวลารับประกัน (เหลือ {orderWarranty.hoursLeft} ชม. {orderWarranty.minutesLeft} นาที)</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-stone-400 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span>สิ้นสุดระยะเวลารับประกัน (เกิน 24 ชม.)</span>
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] text-stone-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>แจ้งเคลมได้ภายใน 24 ชม. หลังสถานะจัดส่งสำเร็จ</span>
                          </span>
                        )}

                        <div className="flex items-center gap-2">
                          {isDone && orderWarranty.isEligible && (
                            <a
                              href={`/claim?orderId=${encodeURIComponent(order.id)}`}
                              className="text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition inline-flex items-center gap-1"
                            >
                              <ShieldCheck className="w-3 h-3 text-emerald-700" />
                              <span>กดเคลมสินค้า</span>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="text-xs font-bold text-[#1B4D31] bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg transition inline-flex items-center gap-1"
                          >
                            <span>ดูไทม์ไลน์พัสดุ</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {/* Support Ticket Modal */}
        {showTicketModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 relative animate-in fade-in zoom-in duration-150">
              <button
                type="button"
                onClick={() => {
                  setShowTicketModal(false);
                  setTicketSuccess(null);
                }}
                className="absolute right-4 top-4 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-stone-900">
                    เปิด Ticket สอบถาม / แจ้งเรื่องแอดมิน
                  </h3>
                  <p className="text-xs text-stone-500">
                    ข้อความจะแจ้งเตือนเข้ากลุ่มแอดมินทันที ทีมงานจะรีบตอบกลับครับ
                  </p>
                </div>
              </div>

              {ticketSuccess ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-emerald-900 text-sm">
                      แจ้งทีมงานเรียบร้อยแล้ว!
                    </h4>
                    <p className="font-mono text-xs text-emerald-700 mt-1 font-bold">
                      รหัส Ticket: #{ticketSuccess}
                    </p>
                    <p className="text-xs text-stone-600 mt-2">
                      แอดมินได้รับข้อความของคุณแล้ว และจะรีบติดต่อกลับตามข้อมูลที่ระบุไว้ครับ 🙏
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTicketModal(false);
                      setTicketSuccess(null);
                    }}
                    className="w-full py-2.5 rounded-xl bg-[#1B4D31] text-white text-xs font-bold hover:bg-[#143B25] transition"
                  >
                    ปิดหน้าต่าง
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitTicket} className="space-y-4">
                  {ticketOrder && (
                    <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs flex justify-between items-center">
                      <span className="text-stone-500">อ้างอิงคำสั่งซื้อ:</span>
                      <span className="font-mono font-bold text-[#1B4D31]">
                        #{ticketOrder.id}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        ชื่อผู้ติดต่อ *
                      </label>
                      <input
                        type="text"
                        required
                        value={ticketName}
                        onChange={(e) => setTicketName(e.target.value)}
                        placeholder="ชื่อของคุณ"
                        className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs focus:border-[#1B4D31] focus:ring-1 focus:ring-[#1B4D31] focus:outline-none bg-stone-50/50 text-stone-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        เบอร์โทรศัพท์ (ถ้ามี)
                      </label>
                      <input
                        type="tel"
                        value={ticketPhone}
                        onChange={(e) => setTicketPhone(e.target.value)}
                        placeholder="0812345678"
                        className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs focus:border-[#1B4D31] focus:ring-1 focus:ring-[#1B4D31] focus:outline-none bg-stone-50/50 text-stone-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      ข้อความ / เรื่องที่ต้องการสอบถาม *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={ticketMessage}
                      onChange={(e) => setTicketMessage(e.target.value)}
                      placeholder="เช่น สอบถามสถานะการจัดส่ง, ขอเปลี่ยนที่อยู่จัดส่ง, ทุเรียนสุกระดับไหนพร้อมทาน..."
                      className="w-full border border-stone-300 rounded-xl p-3 text-xs focus:border-[#1B4D31] focus:ring-1 focus:ring-[#1B4D31] focus:outline-none bg-stone-50/50 text-stone-900 resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowTicketModal(false)}
                      className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-xs font-bold hover:bg-stone-50 transition"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={submittingTicket || !ticketMessage.trim()}
                      className="px-5 py-2.5 rounded-xl bg-[#1B4D31] hover:bg-[#143B25] text-white text-xs font-bold transition shadow-xs disabled:opacity-60 flex items-center gap-2"
                    >
                      {submittingTicket ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>กำลังส่งเรื่อง...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>ส่งข้อความถึงแอดมิน</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}