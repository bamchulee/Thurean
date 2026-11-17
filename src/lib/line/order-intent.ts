// ============================================================
// อ่านข้อความที่ลูกค้าพิมพ์เอง (สั่งแบบปากเปล่า) แล้วคัดว่าเป็นเรื่องอะไร
//   order       — รู้สินค้าแน่นอน (+ จำนวน / ความสุก ถ้าพิมพ์มา) → บอททำต่อได้
//   order_multi — สั่งหลายอย่างในข้อความเดียว → ส่งให้แอดมินยืนยัน
//   order_vague — อยากสั่งแต่ไม่รู้ว่าพันธุ์ไหน / ตรงหลายตัว → ให้ลูกค้าเลือกจากเมนู
//   greeting / thanks — ทักทาย / ขอบคุณ
//   question    — คำถามอื่น ๆ → ส่งให้แอดมินตอบ (ไม่ให้บอทเดา)
// หลัก: ไม่แน่ใจ = ไม่เดา  ถามเฉพาะส่วนที่ขาด หรือส่งต่อคน
// ============================================================
import type { Product } from "../../types/durian";

export interface OrderLine {
  product: Product;
  qty?: number;
}

export type ChatIntent =
  | { kind: "order"; line: OrderLine; ripeness?: string; byWeight?: boolean }
  | { kind: "order_multi"; lines: OrderLine[]; ripeness?: string }
  | { kind: "order_vague"; candidates: Product[] }
  | { kind: "greeting" }
  | { kind: "thanks" }
  | { kind: "question" }
  | { kind: "none" };

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
const NUMBER_WORDS: [RegExp, number][] = [
  [/(ลูก|ผล)(เดียว|นึง|หนึ่ง)/, 1],
  [/หนึ่ง|นึง/, 1],
  [/สอง/, 2],
  [/สาม/, 3],
  [/สี่/, 4],
  [/ห้า/, 5],
  [/หก/, 6],
  [/เจ็ด/, 7],
  [/แปด/, 8],
  [/เก้า/, 9],
  [/สิบ/, 10],
];

/** ตัวเลขไทย→อารบิก ตัดคำลงท้าย เว้นวรรคเดียว */
export function normalizeChat(raw: string): string {
  return (raw || "")
    .toLowerCase()
    .replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)))
    .replace(/(ครับผม|ครับ|คับ|ค่ะ|คะ|ค่า|จ้า|จ้ะ|นะคะ|นะครับ|นะ)(?=\s|$|[!?.,])/g, " ")
    .replace(/[!?.,~]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const squash = (s: string) => s.replace(/\s+/g, "");
const GENERIC = /ทุเรียน|เกรด|ลูก|ผล|กก\.?|กิโล|ไซส์|size|พิเศษ|คัด|สด|\d+(\.\d+)?|-|\(|\)/g;

/** คำที่ใช้จับสินค้า: ชื่อเต็ม, พันธุ์, ชื่อย่อพันธุ์ (หมอนทอง→หมอน) */
function productKeys(p: Product): string[] {
  const keys = new Set<string>();
  const name = squash((p.name || "").toLowerCase());
  if (name) keys.add(name);
  const core = squash((p.name || "").toLowerCase().replace(GENERIC, " "));
  if (core.length >= 3) keys.add(core);
  // คำในชื่อที่เว้นวรรคไว้ (เช่น "หมอนทองแกะเนื้อ" ใน "หมอนทองแกะเนื้อ กล่อง 500 กรัม")
  for (const word of (p.name || "").toLowerCase().split(/\s+/)) {
    const w = word.replace(GENERIC, "");
    if (w.length >= 4) keys.add(w);
  }
  const variety = squash((p.variety || "").toLowerCase());
  if (variety.length >= 2) {
    keys.add(variety);
    if (variety.startsWith("หมอนทอง")) keys.add("หมอน");
    if (variety.startsWith("ก้านยาว")) keys.add("ก้าน");
  }
  return [...keys];
}

const ORDER_WORDS = /(เอา|สั่ง|จอง|ขอ|ต้องการ|ซื้อ|อยากได้|รับ|cf|ซีเอฟ|เอฟ)/;
const QUESTION_WORDS = /(ไหม|มั้ย|มัย|หรือเปล่า|รึเปล่า|เท่าไร|เท่าไหร่|กี่บาท|ราคา|ยังมี|เหลือ|ได้ไหม|ยังไง|อย่างไร|\?)/;
const GREETING = /^(สวัสดี|หวัดดี|ดีจ้า|ดีครับ|ดีค่ะ|hello|hi|hey|ทักครับ|ทักค่ะ)/;
const THANKS = /^(ขอบคุณ|ขอบใจ|thank|thx|ok|โอเค|ได้เลย|รับทราบ|👍|🙏|ค่ะ|ครับ)$/;

/** ความสุก → รหัสใน RIPENESS_OPTIONS (1 กรอบนอกนุ่มใน, 2 สุกพอดี/นุ่ม, 3 ห่าม, 4 งอม) */
export function ripenessFromText(t: string): string | undefined {
  if (/งอม|สุกมาก|เละ|หวานจัด/.test(t)) return "4";
  if (/ห่าม/.test(t)) return "3";
  if (/ไม่กรอบ|นุ่ม|ครีม|สุกพอดี|พร้อมทาน|สุกแล้ว/.test(t)) return "2";
  if (/กรอบ/.test(t)) return "1";
  return undefined;
}

const UNIT = "(ลูก|ผล|กล่อง|ชิ้น|อัน|แพ็ค|แพค|พู)";
const WEIGHT_UNIT = /(\d+(?:\.\d+)?)\s*(กิโล|โล|กก|kg)/;

/** จำนวนใกล้ ๆ ตำแหน่งชื่อสินค้า — ไม่เอาเบอร์โทร ราคา หรือน้ำหนัก */
function qtyNear(t: string, at: number, keyLen: number): number | undefined {
  const after = t.slice(at + keyLen, at + keyLen + 14);
  const before = t.slice(Math.max(0, at - 12), at);
  const pick = (s: string, re: RegExp) => {
    const m = re.exec(s);
    if (!m) return undefined;
    const n = Number(m[1]);
    return n >= 1 && n <= 99 ? n : undefined;
  };
  const unitAfter = new RegExp(`^\\s*(\\d{1,2})\\s*${UNIT}`);
  const bareAfter = /^\s*(?:x|×|\*)?\s*(\d{1,2})(?!\d|\s*(บาท|฿|กิโล|โล|กก|kg|\.\d))/;
  const unitBefore = new RegExp(`(\\d{1,2})\\s*${UNIT}?\\s*$`);
  const n = pick(after, unitAfter) ?? pick(after, bareAfter) ?? pick(before, unitBefore);
  if (n !== undefined) return n;
  const words = after.slice(0, 10);
  for (const [re, v] of NUMBER_WORDS) if (re.test(words)) return v;
  return undefined;
}

/** หาสินค้าที่ถูกพูดถึง: คีย์ยาวสุดชนะ, พันธุ์เดียวกันหลายตัว = กำกวม */
function findMentions(t: string, products: Product[]) {
  const flat = squash(t);
  const hits: { product: Product; key: string; at: number }[] = [];
  for (const p of products) {
    let best: { key: string; at: number } | null = null;
    for (const key of productKeys(p)) {
      const at = flat.indexOf(key);
      if (at >= 0 && (!best || key.length > best.key.length)) best = { key, at };
    }
    if (best) hits.push({ product: p, ...best });
  }
  return { flat, hits };
}

export function readChatIntent(raw: string, products: Product[]): ChatIntent {
  const t = normalizeChat(raw);
  if (!t) return { kind: "none" };
  if (THANKS.test(t)) return { kind: "thanks" };
  if (GREETING.test(t) && t.length <= 20) return { kind: "greeting" };

  const { flat, hits } = findMentions(t, products);
  const wantsOrder = ORDER_WORDS.test(t);
  const ripeness = ripenessFromText(t);

  if (hits.length === 0) {
    if (wantsOrder && /ทุเรียน|ลูก|โล|กิโล/.test(t)) return { kind: "order_vague", candidates: [] };
    return t.length >= 2 ? { kind: "question" } : { kind: "none" };
  }

  // หลายตัวตรงด้วยคีย์เดียวกัน (เช่น "หมอนทอง" มี 2 เกรด) → ให้ลูกค้าเลือก
  const longest = Math.max(...hits.map((h) => h.key.length));
  const top = hits.filter((h) => h.key.length === longest);
  const distinctPositions = new Set(hits.map((h) => h.at));

  // คนละสินค้า คนละตำแหน่งในข้อความ = สั่งหลายอย่าง
  if (distinctPositions.size >= 2) {
    const byPos = new Map<number, (typeof hits)[number]>();
    for (const h of hits) {
      const cur = byPos.get(h.at);
      if (!cur || h.key.length > cur.key.length) byPos.set(h.at, h);
    }
    const lines = [...byPos.values()]
      .sort((a, b) => a.at - b.at)
      .map((h) => ({ product: h.product, qty: qtyNear(flat, h.at, h.key.length) }));
    // ชื่อหนึ่งเป็นส่วนของอีกชื่อ (หมอน ⊂ หมอนทองแกะ) นับเป็นตัวเดียว
    const uniq = lines.filter((l, i) => lines.findIndex((x) => x.product.id === l.product.id) === i);
    if (uniq.length >= 2) return { kind: "order_multi", lines: uniq, ripeness };
  }

  if (top.length > 1) return { kind: "order_vague", candidates: top.map((h) => h.product) };

  const hit = top[0];
  const qty = qtyNear(flat, hit.at, hit.key.length);
  const byWeight = qty === undefined && WEIGHT_UNIT.test(t);
  return { kind: "order", line: { product: hit.product, qty }, ripeness, byWeight };
}

/** ข้อความพูดถึงสินค้าแต่เป็นคำถาม (ยังมีไหม / ราคาเท่าไร) */
export function isQuestion(raw: string): boolean {
  return QUESTION_WORDS.test(normalizeChat(raw));
}
