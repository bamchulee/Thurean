"use client";

// ฟอร์มที่อยู่จัดส่งแบบแอปช้อปปิ้ง — ใช้ทุกที่ (สั่งซื้อ, ตะกร้า, บัญชีของฉัน)
//   ชื่อ / เบอร์ → ค้นหาสถานที่ / ตำแหน่งปัจจุบัน → ลากแผนที่ปักหมุด
//   → จังหวัด อำเภอ ตำบล รหัสไปรษณีย์ (เติมให้จากหมุด แก้เองได้) → บ้านเลขที่ ซอย ถนน
import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import { PinMap } from "./PinMap";
import {
  PROVINCES,
  inThailand,
  isBangkok,
  reverseGeocode,
  searchPlaces,
  type AddressValue,
  type GeoResult,
} from "../../lib/thai-address";

const field =
  "w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:border-[#1B4D31] focus:ring-2 focus:ring-[#1B4D31]/15 focus:outline-none";

type AutoKey = "province" | "district" | "subdistrict" | "postalCode";

export function AddressForm({
  value,
  onChange,
  showContact = true,
}: {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  /** แสดงช่องชื่อ/เบอร์ (หน้าบัญชีของฉันมีช่องชื่อแยกอยู่แล้ว) */
  showContact?: boolean;
}) {
  const v = value;
  const set = (patch: Partial<AddressValue>) => onChange({ ...v, ...patch });
  // ช่องที่ลูกค้าพิมพ์เอง — ปักหมุดใหม่จะไม่ไปเขียนทับ
  const touched = useRef<Set<AutoKey | "detail">>(new Set());
  // ค่าล่าสุด (ใช้ตอนผลค้นหาตำแหน่งกลับมาทีหลัง)
  const latest = useRef(v);
  useEffect(() => {
    latest.current = v;
  });

  const [place, setPlace] = useState("");
  const [placeLabel, setPlaceLabel] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  /** ค้นแล้วไม่เจอ (โชว์คำแนะนำ) */
  const [noResult, setNoResult] = useState(false);
  const [busy, setBusy] = useState<"" | "gps" | "search" | "geo">("");
  const [msg, setMsg] = useState("");
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bkk = isBangkok(v.province);
  const pin = inThailand(v.lat, v.lng) ? { lat: v.lat as number, lng: v.lng as number } : null;

  /** หมุดย้าย → เติมตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์ที่ลูกค้ายังไม่ได้พิมพ์เอง */
  const fillFrom = (g: GeoResult, onlyMissing = false) => {
    const cur = latest.current;
    const patch: Partial<AddressValue> = {};
    // ช่องที่ระบบเติมเอง: ตำแหน่งใหม่ไม่มีค่านั้น → ล้างค่าเก่าทิ้ง (กันรหัสไปรษณีย์ของที่เดิมค้าง)
    const auto = (k: AutoKey, val?: string) => {
      if (touched.current.has(k)) return;
      if (onlyMissing) {
        if (val && !cur[k]) patch[k] = val;
      } else patch[k] = val || "";
    };
    auto("province", g.province);
    auto("district", g.district);
    auto("subdistrict", g.subdistrict);
    auto("postalCode", g.postalCode);
    if (!cur.detail.trim() && !touched.current.has("detail") && g.road) patch.detail = g.road;
    setPlaceLabel(g.label);
    onChange({ ...cur, ...patch, lat: g.lat, lng: g.lng });
  };

  /** อ่านที่อยู่จากพิกัด (รอให้หยุดลากก่อน) */
  const lookup = (p: { lat: number; lng: number }, keepLabel?: string) => {
    if (geoTimer.current) clearTimeout(geoTimer.current);
    geoTimer.current = setTimeout(async () => {
      setBusy("geo");
      const g = await reverseGeocode(p.lat, p.lng);
      setBusy("");
      if (!g) return;
      // มาจากผลค้นหา: เติมแค่ช่องที่ยังว่าง (เช่น รหัสไปรษณีย์) และคงชื่อสถานที่ที่ลูกค้าเลือกไว้
      fillFrom({ ...g, lat: p.lat, lng: p.lng }, Boolean(keepLabel));
      if (keepLabel) setPlaceLabel(keepLabel);
    }, 700);
  };

  const onPin = (p: { lat: number; lng: number }) => {
    onChange({ ...latest.current, lat: p.lat, lng: p.lng });
    setPlaceLabel("");
    lookup(p);
  };

  useEffect(() => () => void (geoTimer.current && clearTimeout(geoTimer.current)), []);

  const useGps = () => {
    if (!navigator.geolocation) return setMsg("เครื่องนี้ใช้ตำแหน่งปัจจุบันไม่ได้ — ลากแผนที่ปักหมุดเองได้เลย");
    setBusy("gps");
    setMsg("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy("");
        onPin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setBusy("");
        setMsg("เปิดตำแหน่งไม่ได้ (ยังไม่อนุญาต) — ค้นหาสถานที่ หรือลากแผนที่ปักหมุดเองได้");
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  // ค้นหาสถานที่ (รอพิมพ์หยุด 0.5 วิ)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      queueMicrotask(() => {
        setResults([]);
        setNoResult(false);
      });
      return;
    }
    const t = setTimeout(async () => {
      setBusy("search");
      const found = await searchPlaces(q);
      setResults(found);
      setNoResult(found.length === 0);
      setBusy("");
    }, 500);
    return () => clearTimeout(t);
  }, [query]);

  const pickPlace = (g: GeoResult) => {
    setResults([]);
    setNoResult(false);
    setQuery("");
    setPlace(g.label);
    fillFrom(g);
    // ผลค้นหามักไม่มีรหัสไปรษณีย์ → อ่านเพิ่มจากพิกัด
    if (!g.postalCode) lookup({ lat: g.lat, lng: g.lng }, g.label);
  };

  const typed = (k: AutoKey | "detail", patch: Partial<AddressValue>) => {
    touched.current.add(k);
    set(patch);
  };

  return (
    <div className="space-y-3">
      {showContact && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <label className="block">
            <span className="text-xs font-semibold text-stone-600">ชื่อ-นามสกุล ผู้รับ *</span>
            <input className={`${field} mt-1`} value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="ชื่อ-นามสกุล" autoComplete="name" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-stone-600">เบอร์โทรศัพท์ *</span>
            <input
              className={`${field} mt-1`}
              value={v.phone}
              onChange={(e) => set({ phone: e.target.value.replace(/[^\d-]/g, "").slice(0, 12) })}
              placeholder="08X-XXX-XXXX"
              inputMode="tel"
              autoComplete="tel"
            />
          </label>
        </div>
      )}

      {/* ปักหมุด */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-stone-600 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-[#D9480F]" /> ปักหมุดตำแหน่งจัดส่ง
          </span>
          <button
            type="button"
            onClick={useGps}
            disabled={busy === "gps"}
            className="h-8 px-3 rounded-full border border-[#1B4D31] text-[#1B4D31] text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
          >
            <LocateFixed className="w-3.5 h-3.5" /> {busy === "gps" ? "กำลังหา…" : "ตำแหน่งปัจจุบัน"}
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            className={`${field} pl-9`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={place || "ค้นหา หมู่บ้าน ถนน ตำบล หรือสถานที่ใกล้บ้าน"}
          />
          {noResult && busy !== "search" && results.length === 0 && (
            <p className="mt-1 text-[11px] text-stone-500">ไม่พบสถานที่นี้ — ลองพิมพ์สั้นลง เช่น ชื่อตำบลหรือหมู่บ้าน แล้วลากแผนที่ปักหมุดเอง</p>
          )}
          {(results.length > 0 || busy === "search") && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-stone-200 bg-white shadow-lg overflow-hidden">
              {busy === "search" && results.length === 0 && <p className="px-3 py-2 text-xs text-stone-500">กำลังค้นหา…</p>}
              {results.map((r, i) => (
                <button key={i} type="button" onClick={() => pickPlace(r)} className="w-full text-left px-3 py-2 text-xs hover:bg-stone-50 border-b border-stone-100 last:border-0">
                  <span className="line-clamp-2">{r.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <PinMap value={pin} onChange={onPin} />
        <p className="text-[11px] text-stone-500 min-h-[1rem]">
          {busy === "geo"
            ? "กำลังอ่านที่อยู่จากหมุด…"
            : placeLabel
              ? `📍 ${placeLabel}`
              : pin
                ? `📍 ปักหมุดแล้ว (${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)})`
                : "ปักหมุดช่วยให้คนส่งของหาบ้านเจอ — ไม่บังคับ แต่แนะนำ"}
        </p>
        {msg && <p className="text-[11px] text-amber-700">{msg}</p>}
      </div>

      {/* ที่อยู่ตามไปรษณีย์ */}
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block col-span-2 sm:col-span-1">
          <span className="text-xs font-semibold text-stone-600">จังหวัด *</span>
          <select className={`${field} mt-1`} value={v.province} onChange={(e) => typed("province", { province: e.target.value })}>
            <option value="">เลือกจังหวัด</option>
            {PROVINCES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="block col-span-2 sm:col-span-1">
          <span className="text-xs font-semibold text-stone-600">{bkk ? "เขต *" : "อำเภอ *"}</span>
          <input className={`${field} mt-1`} value={v.district} onChange={(e) => typed("district", { district: e.target.value })} placeholder={bkk ? "เช่น บางรัก" : "เช่น เมืองระยอง"} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-stone-600">{bkk ? "แขวง *" : "ตำบล *"}</span>
          <input className={`${field} mt-1`} value={v.subdistrict} onChange={(e) => typed("subdistrict", { subdistrict: e.target.value })} placeholder={bkk ? "เช่น สีลม" : "เช่น ท่าประดู่"} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-stone-600">รหัสไปรษณีย์ *</span>
          <input
            className={`${field} mt-1`}
            value={v.postalCode}
            onChange={(e) => typed("postalCode", { postalCode: e.target.value.replace(/\D/g, "").slice(0, 5) })}
            placeholder="5 หลัก"
            inputMode="numeric"
            autoComplete="postal-code"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-semibold text-stone-600">บ้านเลขที่ หมู่ ซอย ถนน *</span>
        <textarea
          rows={2}
          className={`${field} mt-1 resize-none`}
          value={v.detail}
          onChange={(e) => typed("detail", { detail: e.target.value })}
          placeholder="เช่น 99/1 หมู่ 3 ซอยสุขุมวิท 55 ถนนสุขุมวิท (จุดสังเกต: ตรงข้ามเซเว่น)"
          autoComplete="street-address"
        />
      </label>
    </div>
  );
}
