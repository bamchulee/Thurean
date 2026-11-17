// ============================================================
// อ่านยอดเงินและบัญชีผู้รับจากตัวหนังสือบนสลิป (ได้จาก OCR ของ Google Drive — ฟรี)
// จับได้: โอนขาด/เกิน, โอนเข้าบัญชีอื่น (ลูกค้าพลาดเอง)
// จับไม่ได้: สลิปปลอมที่ตั้งใจพิมพ์ยอด/ชื่อร้านให้ถูก — ตัวหนังสือบนรูปแก้ได้ ต้องตรวจกับธนาคารจริงถึงจะกันได้
// ============================================================

export type TextCheck = "match" | "mismatch" | "unknown";

export interface SlipTextResult {
  /** ยอดที่อ่านได้จากสลิป (บาท) */
  amount?: number;
  amountCheck: TextCheck;
  accountCheck: TextCheck;
  /** เหตุผลสั้นๆ ไว้โชว์แอดมิน/ลูกค้า */
  notes: string[];
}

export interface ShopAccount {
  name: string;
  number: string;
  promptPay: string;
}

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

/** ตัวเลขไทย → อารบิก, ตัวอักษรที่ OCR ชอบสับสนในตัวเลข */
export function normalizeSlipText(text: string): string {
  return text
    .replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)))
    .replace(/ /g, " ")
    .replace(/[，]/g, ",")
    .replace(/[．]/g, ".");
}

const toNumber = (s: string) => Number(s.replace(/[,\s]/g, ""));

/** ยอดเงินในสลิป: ตัวเลขทศนิยม 2 ตำแหน่ง ให้น้ำหนักกับบรรทัดที่มีคำว่า จำนวน/ยอด/บาท/Amount */
export function findAmounts(text: string): { value: number; score: number }[] {
  const lines = normalizeSlipText(text).split(/\r?\n/);
  const out: { value: number; score: number }[] = [];
  lines.forEach((line, i) => {
    const context = `${lines[i - 1] || ""} ${line} ${lines[i + 1] || ""}`;
    const re = /(?<![\d.])(\d{1,3}(?:[,\s]\d{3})+|\d+)\.(\d{2})(?!\d)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const value = toNumber(`${m[1]}.${m[2]}`);
      if (!(value > 0) || value > 10_000_000) continue;
      let score = 1;
      if (/จำนวน|ยอด|amount|total/i.test(context)) score += 3;
      if (/บาท|THB|฿/i.test(context)) score += 2;
      if (/ค่าธรรมเนียม|fee/i.test(context)) score -= 4;
      out.push({ value, score });
    }
  });
  return out.sort((a, b) => b.score - a.score || b.value - a.value);
}

const digitsOf = (s: string) => s.replace(/\D/g, "");

/**
 * เลขบัญชีบนสลิปถูกปิดบางหลัก เช่น xxx-x-x2423-x หรือ 082-2-xxx23-8
 * เทียบทีละหลักเฉพาะตำแหน่งที่เห็นตัวเลข — ต้องตรงอย่างน้อย 4 หลัก
 */
export function maskedMatches(masked: string, full: string): boolean {
  const m = masked.replace(/[\s-]/g, "").replace(/[*•●]/g, "x").toLowerCase();
  const f = digitsOf(full);
  if (!f || m.length !== f.length) return false;
  let seen = 0;
  for (let i = 0; i < m.length; i++) {
    if (m[i] === "x") continue;
    if (m[i] !== f[i]) return false;
    seen++;
  }
  return seen >= 4;
}

/** เลขบัญชี/พร้อมเพย์ที่ถูกปิดบางส่วนในสลิป */
export function findMaskedAccounts(text: string): string[] {
  const t = normalizeSlipText(text);
  const re = /[0-9xX*•●]{1,4}(?:[-\s][0-9xX*•●]{1,6}){1,4}/g;
  const found = t.match(re) || [];
  return found
    .map((s) => s.trim())
    .filter((s) => /[xX*•●]/.test(s) && /\d/.test(s) && s.replace(/[\s-]/g, "").length >= 9 && s.replace(/[\s-]/g, "").length <= 15);
}

const squash = (s: string) => s.replace(/[\s.()（）]/g, "").replace(/^(นาย|นาง|น\.ส\.|นางสาว|ร้าน|บจก|บริษัท)/, "");

export function readSlipText(text: string, expectedAmount: number, shop: ShopAccount): SlipTextResult {
  const notes: string[] = [];
  const clean = normalizeSlipText(text || "");
  if (!clean.trim()) return { amountCheck: "unknown", accountCheck: "unknown", notes: ["อ่านตัวหนังสือบนสลิปไม่ได้"] };

  // ---- ยอด ----
  const amounts = findAmounts(clean);
  const expected = Math.round(expectedAmount * 100) / 100;
  let amount: number | undefined;
  let amountCheck: TextCheck = "unknown";
  if (amounts.some((a) => Math.abs(a.value - expected) < 0.005)) {
    amount = expected;
    amountCheck = "match";
  } else if (amounts.length) {
    amount = amounts[0].value;
    amountCheck = "mismatch";
    const diff = Math.round((amount - expected) * 100) / 100;
    notes.push(diff < 0 ? `ยอดในสลิป ฿${amount.toLocaleString()} ขาดไป ฿${Math.abs(diff).toLocaleString()}` : `ยอดในสลิป ฿${amount.toLocaleString()} เกินมา ฿${diff.toLocaleString()}`);
  } else {
    notes.push("หายอดเงินในสลิปไม่เจอ");
  }

  // ---- บัญชีผู้รับ ----
  const masked = findMaskedAccounts(clean);
  const ours = [shop.number, shop.promptPay].filter(Boolean);
  const accountHit = masked.some((m) => ours.some((full) => maskedMatches(m, full)));
  const fullHit = ours.some((full) => digitsOf(full).length >= 9 && digitsOf(clean).includes(digitsOf(full)));
  const nameKey = squash(shop.name);
  const nameHit = nameKey.length >= 4 && squash(clean).includes(nameKey);
  let accountCheck: TextCheck = "unknown";
  if (accountHit || fullHit || nameHit) {
    accountCheck = "match";
  } else if (masked.length >= 2) {
    // มีบัญชีผู้โอน + ผู้รับให้เห็น แต่ไม่มีอันไหนเป็นของร้าน
    accountCheck = "mismatch";
    notes.push("บัญชีผู้รับในสลิปไม่ใช่บัญชีร้าน");
  } else {
    notes.push("ไม่เห็นบัญชีผู้รับชัดเจน — เช็กด้วยตา");
  }

  return { amount, amountCheck, accountCheck, notes };
}
