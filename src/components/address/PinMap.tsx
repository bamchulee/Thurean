"use client";

// แผนที่ปักหมุดแบบแอปช้อปปิ้ง/เรียกรถ: หมุดอยู่กลางจอ ลากแผนที่ให้หมุดตรงบ้าน
// เขียนเอง (ไม่ใช้ไลบรารี) ใช้แผ่นแผนที่ OpenStreetMap — ลากด้วยนิ้ว/เมาส์, ปุ่ม + − ซูม, ล้อเมาส์ซูมได้
import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

const TILE = 256;
const MIN_Z = 5;
const MAX_Z = 19;

type LatLng = { lat: number; lng: number };

/** พิกัด → พิกเซลบนแผนที่โลกที่ซูม z */
function project(p: LatLng, z: number) {
  const s = TILE * 2 ** z;
  const sin = Math.sin((Math.max(-85, Math.min(85, p.lat)) * Math.PI) / 180);
  return { x: ((p.lng + 180) / 360) * s, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s };
}

function unproject(x: number, y: number, z: number): LatLng {
  const s = TILE * 2 ** z;
  const lng = (x / s) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / s;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

export function PinMap({
  value,
  onChange,
  fallbackCenter = { lat: 13.7563, lng: 100.5018 },
  className = "h-56",
}: {
  /** ตำแหน่งหมุดปัจจุบัน (null = ยังไม่ปัก) */
  value: LatLng | null;
  /** เรียกเมื่อลากเสร็จ / ซูมเสร็จ */
  onChange: (p: LatLng) => void;
  fallbackCenter?: LatLng;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [center, setCenter] = useState<LatLng>(value || fallbackCenter);
  const [zoom, setZoom] = useState(value ? 17 : 11);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const lastValue = useRef<string>("");

  // ค่าจากข้างนอกเปลี่ยน (กด GPS / ค้นหาสถานที่) → เลื่อนแผนที่ไปที่นั่น
  useEffect(() => {
    if (!value) return;
    const key = `${value.lat.toFixed(6)},${value.lng.toFixed(6)}`;
    if (key === lastValue.current) return;
    lastValue.current = key;
    queueMicrotask(() => {
      setCenter(value);
      setZoom((z) => Math.max(z, 16));
    });
  }, [value]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const commit = useCallback(
    (p: LatLng) => {
      lastValue.current = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
      onChange(p);
    },
    [onChange]
  );

  const onDown = (e: React.PointerEvent) => {
    const c = project(center, zoom);
    drag.current = { x: e.clientX, y: e.clientY, cx: c.x, cy: c.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setCenter(unproject(d.cx - (e.clientX - d.x), d.cy - (e.clientY - d.y), zoom));
  };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    commit(center);
  };
  const zoomBy = (dz: number) => {
    const z = Math.max(MIN_Z, Math.min(MAX_Z, zoom + dz));
    if (z === zoom) return;
    setZoom(z);
    commit(center);
  };

  // แผ่นแผนที่ที่ต้องโชว์
  const c = project(center, zoom);
  const left = c.x - size.w / 2;
  const top = c.y - size.h / 2;
  const n = 2 ** zoom;
  const tiles: { key: string; src: string; x: number; y: number }[] = [];
  if (size.w > 0) {
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + size.h) / TILE); ty++) {
      if (ty < 0 || ty >= n) continue;
      for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + size.w) / TILE); tx++) {
        const wx = ((tx % n) + n) % n;
        tiles.push({ key: `${zoom}/${tx}/${ty}`, src: `https://tile.openstreetmap.org/${zoom}/${wx}/${ty}.png`, x: tx * TILE - left, y: ty * TILE - top });
      }
    }
  }

  return (
    <div className={`relative overflow-hidden rounded-xl border border-stone-300 bg-[#E8E4D8] select-none ${className}`}>
      <div
        ref={box}
        className={`absolute inset-0 touch-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={(e) => zoomBy(e.deltaY < 0 ? 1 : -1)}
        role="application"
        aria-label="แผนที่ ลากเพื่อเลื่อนหมุดให้ตรงที่อยู่"
      >
        {tiles.map((t) => (
          <img key={t.key} src={t.src} alt="" draggable={false} className="absolute w-64 h-64 max-w-none pointer-events-none" style={{ left: t.x, top: t.y }} />
        ))}
      </div>

      {/* หมุดกลางจอ (ปลายหมุดชี้ที่จุดกึ่งกลาง) */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
        <svg width="34" height="44" viewBox="0 0 34 44" className={`drop-shadow-md transition-transform ${dragging ? "-translate-y-2" : ""}`}>
          <path d="M17 43s15-14.6 15-26A15 15 0 0 0 2 17c0 11.4 15 26 15 26z" fill="#D9480F" stroke="#fff" strokeWidth="2" />
          <circle cx="17" cy="17" r="6" fill="#fff" />
        </svg>
      </div>
      <span className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 w-3 h-1.5 rounded-full bg-black/30 transition ${dragging ? "scale-75 opacity-60" : ""}`} />

      {!value && !dragging && (
        <span className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-stone-700 shadow">
          ลากแผนที่ให้หมุดตรงบ้านคุณ
        </span>
      )}

      <div className="absolute right-2 bottom-6 flex flex-col overflow-hidden rounded-lg bg-white shadow">
        <button type="button" aria-label="ซูมเข้า" onClick={() => zoomBy(1)} className="w-8 h-8 flex items-center justify-center text-stone-700 hover:bg-stone-100">
          <Plus className="w-4 h-4" />
        </button>
        <span className="h-px bg-stone-200" />
        <button type="button" aria-label="ซูมออก" onClick={() => zoomBy(-1)} className="w-8 h-8 flex items-center justify-center text-stone-700 hover:bg-stone-100">
          <Minus className="w-4 h-4" />
        </button>
      </div>
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="absolute right-0 bottom-0 bg-white/80 px-1 text-[9px] text-stone-600"
      >
        © OpenStreetMap
      </a>
    </div>
  );
}
