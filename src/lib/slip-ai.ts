// ============================================================
// ตรวจสลิปด้วย AI (Google Gemini) — ชั้นที่ 3 ต่อจากอ่าน QR และ OCR
//   Gemini อ่านรูปสลิปออกมาเป็นข้อมูล (ยอด วันเวลา เลขรายการ ผู้รับ) + ดูร่องรอยการแต่งรูป
//   การตัดสิน "ยอดตรง / บัญชีตรง" ทำด้วยโค้ดของเราเอง (ไม่ให้ AI ตัดสินเอง)
// ยังไม่ใส่ Gemini API key = ข้ามขั้นนี้ ทำงานแบบเดิม
// หมายเหตุ: AI ช่วยคัดกรองได้ดีขึ้น แต่ยังไม่ใช่การยืนยันกับธนาคาร — แอดมินควรเช็กเงินเข้าในแอปธนาคารก่อนกดยืนยัน
// ============================================================
import { maskedMatches, type ShopAccount, type TextCheck } from "./slip-text";

export interface SlipAiData {
  isBankSlip: boolean;
  bank?: string;
  amount?: number;
  date?: string;
  time?: string;
  reference?: string;
  receiverName?: string;
  receiverAccount?: string;
  senderName?: string;
  tamperingSigns: string[];
}

export interface SlipAiResult {
  data: SlipAiData;
  amountCheck: TextCheck;
  accountCheck: TextCheck;
  /** ไม่ใช่สลิป หรือเห็นร่องรอยแต่งรูป */
  suspicious: boolean;
  /** สรุป 1-2 บรรทัดไว้โชว์แอดมิน */
  note: string;
}

const PROMPT = `You are checking a Thai bank transfer slip image for a durian shop.
Read ONLY what is printed on the image. Do not guess. Use null when a value is not visible.
Return JSON with exactly these keys:
{
  "is_bank_slip": boolean,            // true only for a real-looking Thai mobile banking transfer slip / e-slip
  "bank": string|null,                // sending bank name as printed (Thai is fine)
  "amount": number|null,              // transfer amount in THB, e.g. 1920.00 -> 1920
  "date": string|null,                // as printed
  "time": string|null,                // as printed
  "reference": string|null,           // transaction reference / เลขที่รายการ
  "receiver_name": string|null,       // ผู้รับ / To
  "receiver_account": string|null,    // receiver account or PromptPay exactly as shown, masked digits as x
  "sender_name": string|null,
  "tampering_signs": string[]         // short Thai phrases for visible signs of editing (mismatched fonts, misaligned digits, pasted areas, inconsistent layout for that bank). Empty if none.
}`;

const squash = (s: string) =>
  (s || "")
    .replace(/[\s.()（）]/g, "")
    .replace(/^(นาย|นาง|น\.ส\.|นางสาว|ร้าน|บจก|บริษัท|mr|mrs|ms)/i, "")
    .toLowerCase();

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[,\s฿]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** ส่งรูปให้ Gemini อ่าน — ไม่มีคีย์ / เรียกไม่สำเร็จ คืน null (ไม่ทำให้ขั้นรับสลิปล้ม) */
export async function readSlipWithGemini(
  image: Buffer,
  mime: string,
  opts: { apiKey?: string; model?: string; timeoutMs?: number }
): Promise<SlipAiData | null> {
  if (!opts.apiKey) return null;
  const model = (opts.model || "gemini-3.8-flash").trim();
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: PROMPT }, { inline_data: { mime_type: mime || "image/jpeg", data: image.toString("base64") } }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
    });
    if (!res.ok) {
      console.warn("[slip-ai] gemini", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const textOut = json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const parsed = JSON.parse(textOut.replace(/^```(?:json)?|```$/g, "").trim()) as Record<string, unknown>;
    return {
      isBankSlip: parsed.is_bank_slip === true,
      bank: str(parsed.bank),
      amount: num(parsed.amount),
      date: str(parsed.date),
      time: str(parsed.time),
      reference: str(parsed.reference),
      receiverName: str(parsed.receiver_name),
      receiverAccount: str(parsed.receiver_account),
      senderName: str(parsed.sender_name),
      tamperingSigns: Array.isArray(parsed.tampering_signs) ? parsed.tampering_signs.filter((x): x is string => typeof x === "string" && x.trim() !== "").slice(0, 5) : [],
    };
  } catch (err) {
    console.warn("[slip-ai] gemini failed", String(err));
    return null;
  }
}

/** เทียบข้อมูลจาก Gemini กับยอดที่ต้องได้และบัญชีร้าน (ตัดสินด้วยโค้ด) */
export function judgeSlipAi(d: SlipAiData, expectedAmount: number, shop: ShopAccount): SlipAiResult {
  const expected = Math.round(expectedAmount * 100) / 100;
  const amountCheck: TextCheck =
    d.amount === undefined ? "unknown" : Math.abs(d.amount - expected) < 0.005 ? "match" : "mismatch";

  const ours = [shop.number, shop.promptPay].filter(Boolean);
  const acc = d.receiverAccount || "";
  const accDigits = acc.replace(/\D/g, "");
  const accountHit =
    Boolean(acc) &&
    ours.some((full) => maskedMatches(acc, full) || (accDigits.length >= 9 && full.replace(/\D/g, "") === accDigits));
  const nameKey = squash(shop.name);
  const nameHit = Boolean(d.receiverName) && nameKey.length >= 4 && squash(d.receiverName || "").includes(nameKey);
  const accountCheck: TextCheck = accountHit || nameHit ? "match" : acc || d.receiverName ? "mismatch" : "unknown";

  const suspicious = !d.isBankSlip || d.tamperingSigns.length > 0;
  const parts = [
    d.amount !== undefined ? `ยอด ฿${d.amount.toLocaleString()}` : "อ่านยอดไม่ได้",
    d.receiverName || d.receiverAccount ? `ผู้รับ ${[d.receiverName, d.receiverAccount].filter(Boolean).join(" ")}` : "",
    d.date || d.time ? `โอน ${[d.date, d.time].filter(Boolean).join(" ")}` : "",
  ].filter(Boolean);
  const verdict = !d.isBankSlip
    ? "⚠️ ดูไม่เหมือนสลิปโอนเงิน"
    : d.tamperingSigns.length
      ? `⚠️ น่าสงสัย: ${d.tamperingSigns.join(", ")}`
      : "ไม่พบร่องรอยแต่งสลิป";
  return { data: d, amountCheck, accountCheck, suspicious, note: `🤖 Gemini: ${parts.join(" · ")}\n${verdict}` };
}

/** รวมผล OCR กับ AI: ตรงกัน = ใช้เลย, อันหนึ่งไม่รู้ = ใช้อีกอัน, ขัดกัน = ให้แอดมินเช็กด้วยตา */
export function mergeCheck(a?: TextCheck, b?: TextCheck): TextCheck | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a === b) return a;
  if (a === "unknown") return b;
  if (b === "unknown") return a;
  return "unknown";
}
