// ============================================================
// ฐานข้อมูลที่อยู่ไทย (จังหวัด → อำเภอ/เขต → ตำบล/แขวง + รหัสไปรษณีย์) สำหรับหน้าเว็บ
// ไฟล์ public/data/th-address.json สร้างจาก scripts/build-thai-address.js — โหลดครั้งเดียวตอนเปิดฟอร์ม
// ============================================================
import { useEffect, useState } from "react";
import { stripPrefix } from "./thai-address";

/** { จังหวัด: { อำเภอ: [[ตำบล, รหัสไปรษณีย์], ...] } } */
export type ThaiAddressData = Record<string, Record<string, [string, string][]>>;

export interface TambonRow {
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
}

let cache: Promise<ThaiAddressData | null> | null = null;

export function loadThaiAddress(): Promise<ThaiAddressData | null> {
  if (!cache) {
    cache = fetch("/data/th-address.json")
      .then((r) => (r.ok ? (r.json() as Promise<ThaiAddressData>) : null))
      .catch(() => null);
  }
  return cache;
}

/** ข้อมูลที่อยู่ไทย (null ระหว่างโหลด / โหลดไม่ได้ — ฟอร์มกลับไปใช้ช่องพิมพ์เอง) */
export function useThaiAddress(): ThaiAddressData | null {
  const [data, setData] = useState<ThaiAddressData | null>(null);
  useEffect(() => {
    let alive = true;
    loadThaiAddress().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);
  return data;
}

const norm = (s: string) => stripPrefix(s).replace(/\s+/g, "").replace(/^เมือง(?=.)/, "เมือง");

/** หาชื่อที่ตรงกับฐานข้อมูล (ตรงตัว > ขึ้นต้นเหมือน > มีคำนั้นอยู่) */
function bestMatch(names: string[], wanted: string): string | undefined {
  const w = norm(wanted);
  if (!w) return undefined;
  return (
    names.find((n) => norm(n) === w) ||
    names.find((n) => norm(n) === `เมือง${w}` || `เมือง${norm(n)}` === w) ||
    names.find((n) => norm(n).startsWith(w) || w.startsWith(norm(n))) ||
    names.find((n) => norm(n).includes(w) || w.includes(norm(n)))
  );
}

/** ชื่อจากแผนที่ → ชื่อตามไปรษณีย์ + รหัสไปรษณีย์จริง (ไม่เจอ = คืนเท่าที่หาได้) */
export function canonicalize(
  data: ThaiAddressData,
  q: { province?: string; district?: string; subdistrict?: string; postalCode?: string }
): Partial<TambonRow> {
  const province = q.province && data[q.province] ? q.province : undefined;
  if (!province) return {};
  const amphoes = data[province];
  let district = q.district ? bestMatch(Object.keys(amphoes), q.district) : undefined;
  let tambon: [string, string] | undefined;
  if (district && q.subdistrict) {
    const name = bestMatch(amphoes[district].map(([t]) => t), q.subdistrict);
    tambon = amphoes[district].find(([t, z]) => t === name && (!q.postalCode || z === q.postalCode)) || amphoes[district].find(([t]) => t === name);
  }
  // ไม่รู้อำเภอ แต่รู้ตำบล → หาตำบลนั้นทั้งจังหวัด (ต้องเจอที่เดียวถึงจะเชื่อ)
  if (!district && q.subdistrict) {
    const hits = Object.entries(amphoes).flatMap(([a, ts]) => ts.filter(([t]) => norm(t) === norm(q.subdistrict || "")).map((t) => [a, t] as const));
    if (hits.length === 1) {
      district = hits[0][0];
      tambon = hits[0][1];
    }
  }
  return {
    province,
    district,
    subdistrict: tambon?.[0],
    postalCode: tambon?.[1] || (district && new Set(amphoes[district].map(([, z]) => z)).size === 1 ? amphoes[district][0][1] : undefined),
  };
}

/** ค้นหาด้วยชื่อตำบล / อำเภอ / รหัสไปรษณีย์ (พิมพ์ทีเดียวได้ครบ 4 ช่อง) */
export function searchTambon(data: ThaiAddressData, q: string, limit = 8): TambonRow[] {
  const s = q.trim().replace(/\s+/g, "");
  if (s.length < 2) return [];
  const out: TambonRow[] = [];
  const isZip = /^\d+$/.test(s);
  for (const [province, amphoes] of Object.entries(data)) {
    for (const [district, tambons] of Object.entries(amphoes)) {
      for (const [subdistrict, postalCode] of tambons) {
        const hit = isZip ? postalCode.startsWith(s) : subdistrict.includes(s) || district.includes(s);
        if (hit) {
          out.push({ subdistrict, district, province, postalCode });
          if (out.length >= limit * 4) break;
        }
      }
    }
  }
  // ชื่อตำบลตรงตัวขึ้นก่อน
  return out.sort((a, b) => Number(b.subdistrict.startsWith(s)) - Number(a.subdistrict.startsWith(s))).slice(0, limit);
}
