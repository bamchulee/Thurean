// ============================================================
// ที่อยู่ไทย: รายชื่อจังหวัด, จัดรูปแบบที่อยู่, ลิงก์ Google Maps, ค้นหาตำแหน่ง (OpenStreetMap Nominatim)
// ใช้ได้ทั้งหน้าเว็บและเซิร์ฟเวอร์
// ============================================================

export const PROVINCES = [
  "กรุงเทพมหานคร", "กระบี่", "กาญจนบุรี", "กาฬสินธุ์", "กำแพงเพชร", "ขอนแก่น", "จันทบุรี", "ฉะเชิงเทรา",
  "ชลบุรี", "ชัยนาท", "ชัยภูมิ", "ชุมพร", "เชียงราย", "เชียงใหม่", "ตรัง", "ตราด", "ตาก", "นครนายก",
  "นครปฐม", "นครพนม", "นครราชสีมา", "นครศรีธรรมราช", "นครสวรรค์", "นนทบุรี", "นราธิวาส", "น่าน",
  "บึงกาฬ", "บุรีรัมย์", "ปทุมธานี", "ประจวบคีรีขันธ์", "ปราจีนบุรี", "ปัตตานี", "พระนครศรีอยุธยา",
  "พะเยา", "พังงา", "พัทลุง", "พิจิตร", "พิษณุโลก", "เพชรบุรี", "เพชรบูรณ์", "แพร่", "ภูเก็ต",
  "มหาสารคาม", "มุกดาหาร", "แม่ฮ่องสอน", "ยโสธร", "ยะลา", "ร้อยเอ็ด", "ระนอง", "ระยอง", "ราชบุรี",
  "ลพบุรี", "ลำปาง", "ลำพูน", "เลย", "ศรีสะเกษ", "สกลนคร", "สงขลา", "สตูล", "สมุทรปราการ",
  "สมุทรสงคราม", "สมุทรสาคร", "สระแก้ว", "สระบุรี", "สิงห์บุรี", "สุโขทัย", "สุพรรณบุรี", "สุราษฎร์ธานี",
  "สุรินทร์", "หนองคาย", "หนองบัวลำภู", "อ่างทอง", "อำนาจเจริญ", "อุดรธานี", "อุตรดิตถ์", "อุทัยธานี",
  "อุบลราชธานี",
] as const;

export interface AddressValue {
  name: string;
  phone: string;
  /** บ้านเลขที่ หมู่ ซอย ถนน หมู่บ้าน */
  detail: string;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
  lat?: number;
  lng?: number;
}

export const EMPTY_ADDRESS: AddressValue = { name: "", phone: "", detail: "", subdistrict: "", district: "", province: "", postalCode: "" };

export const isBangkok = (province: string) => /กรุงเทพ/.test(province);

/** ตัดคำนำหน้าที่ผู้ใช้/OSM ใส่มาเอง (ต./ตำบล/แขวง, อ./อำเภอ/เขต, จ./จังหวัด) */
export function stripPrefix(s: string): string {
  return (s || "").trim().replace(/^(ตำบล|ต\.|แขวง|อำเภอ|อ\.|เขต|จังหวัด|จ\.)\s*/, "").trim();
}

/** ที่อยู่บรรทัดเดียวแบบไปรษณีย์ไทย (กรุงเทพใช้ แขวง/เขต) */
export function formatThaiAddress(v: Pick<AddressValue, "detail" | "subdistrict" | "district" | "province" | "postalCode">): string {
  const bkk = isBangkok(v.province);
  const sub = stripPrefix(v.subdistrict);
  const dist = stripPrefix(v.district);
  const prov = stripPrefix(v.province);
  return [
    v.detail.trim(),
    sub && `${bkk ? "แขวง" : "ต."}${sub}`,
    dist && `${bkk ? "เขต" : "อ."}${dist}`,
    prov && (bkk ? prov : `จ.${prov}`),
    v.postalCode.trim(),
  ]
    .filter(Boolean)
    .join(" ");
}

export const mapsLink = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

/** พิกัดอยู่ในประเทศไทยคร่าว ๆ (กันค่าแปลก ๆ) */
export const inThailand = (lat?: number, lng?: number) =>
  typeof lat === "number" && typeof lng === "number" && lat > 5 && lat < 21 && lng > 97 && lng < 106;

/** ช่องที่ขาด (ว่าง = ครบ) */
export function addressErrors(v: AddressValue, opts: { contact?: boolean } = {}): string[] {
  const e: string[] = [];
  if (opts.contact !== false) {
    if (!v.name.trim()) e.push("ชื่อผู้รับ");
    if (v.phone.replace(/\D/g, "").length < 9) e.push("เบอร์โทร");
  }
  if (!v.province) e.push("จังหวัด");
  if (!v.district.trim()) e.push(isBangkok(v.province) ? "เขต" : "อำเภอ");
  if (!v.subdistrict.trim()) e.push(isBangkok(v.province) ? "แขวง" : "ตำบล");
  if (!/^\d{5}$/.test(v.postalCode.trim())) e.push("รหัสไปรษณีย์ 5 หลัก");
  if (!v.detail.trim()) e.push("บ้านเลขที่ / ถนน");
  return e;
}

/** จับชื่อจังหวัดจากข้อความ (OSM ชอบส่ง "จังหวัดระยอง" หรือ "Bangkok") */
export function matchProvince(text?: string): string {
  const t = stripPrefix(text || "");
  if (!t) return "";
  if (/bangkok|กรุงเทพ/i.test(t)) return "กรุงเทพมหานคร";
  return PROVINCES.find((p) => t.includes(p) || p.includes(t)) || "";
}

export interface GeoResult {
  label: string;
  lat: number;
  lng: number;
  subdistrict?: string;
  district?: string;
  province?: string;
  postalCode?: string;
  road?: string;
}

function fromNominatim(r: { lat: string; lon: string; display_name?: string; address?: Record<string, string> }): GeoResult {
  const a = r.address || {};
  // OSM ใช้ชื่อช่องไม่เหมือนกันแต่ละพื้นที่ (กรุงเทพ: suburb = เขต, quarter = แขวง) → ดูจากคำนำหน้าก่อน
  const values = Object.values(a).map(String);
  const byPrefix = (re: RegExp) => values.find((x) => re.test(x.trim()));
  const sub = byPrefix(/^(แขวง|ตำบล|ต\.)/) || a.quarter || a.village || a.hamlet || a.town || a.suburb || "";
  const dist = byPrefix(/^(เขต|อำเภอ|อ\.)/) || a.city_district || a.district || a.county || a.municipality || "";
  return {
    label: r.display_name || "",
    lat: Number(r.lat),
    lng: Number(r.lon),
    subdistrict: stripPrefix(sub),
    district: stripPrefix(dist),
    province: matchProvince(a.province || a.state || a.city || ""),
    postalCode: (a.postcode || "").replace(/\D/g, "").slice(0, 5),
    road: [a.house_number, a.road].filter(Boolean).join(" "),
  };
}

/** พิกัด → ชื่อตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์ (ฟรี, OpenStreetMap) */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoResult | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=th`);
    if (!res.ok) return null;
    const j = await res.json();
    return j && j.lat ? fromNominatim(j) : null;
  } catch {
    return null;
  }
}

/** ค้นหาสถานที่ในไทย (หมู่บ้าน ถนน ตำบล ร้าน) → ตัวเลือกให้ลูกค้ากด */
export async function searchPlaces(q: string): Promise<GeoResult[]> {
  if (q.trim().length < 2) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=th&addressdetails=1&limit=5&accept-language=th`
    );
    if (!res.ok) return [];
    const j = (await res.json()) as Parameters<typeof fromNominatim>[0][];
    return j.map(fromNominatim);
  } catch {
    return [];
  }
}
