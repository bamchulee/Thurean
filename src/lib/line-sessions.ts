// ============================================================
// Lightweight LINE Chat Session Store (Order & Claim Wizards)
// ============================================================
import fs from "fs";
import path from "path";

export type LineSessionFlow =
  | {
      flow: "order";
      step:
        | "pick_qty"
        | "pick_ripeness"
        | "pick_shipping"
        | "enter_contact"
        | "await_slip";
      productId: string;
      productName: string;
      price: number;
      qty?: number;
      ripenessPref?: string;
      shippingMethod?: string;
      shippingCost?: number;
      totalPrice?: number;
      grandTotal?: number;
      customerName?: string;
      phone?: string;
      address?: string;
      updatedAt: number;
    }
  | {
      flow: "claim";
      step: "enter_order" | "enter_phone" | "pick_reason" | "enter_detail";
      orderId?: string;
      phone?: string;
      reason?: string;
      updatedAt: number;
    }
  | {
      flow: "track";
      step: "enter_query";
      updatedAt: number;
    };

const SESSION_PATH = path.join(process.cwd(), "data", "line-sessions.json");
const TTL_MS = 30 * 60 * 1000;

function readSessions(): Record<string, LineSessionFlow> {
  try {
    if (!fs.existsSync(SESSION_PATH)) return {};
    const parsed = JSON.parse(fs.readFileSync(SESSION_PATH, "utf-8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSessions(map: Record<string, LineSessionFlow>) {
  const dir = path.dirname(SESSION_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const now = Date.now();
  const pruned: Record<string, LineSessionFlow> = {};
  for (const [k, v] of Object.entries(map)) {
    if (v && now - v.updatedAt < TTL_MS) pruned[k] = v;
  }
  fs.writeFileSync(SESSION_PATH, JSON.stringify(pruned, null, 2), "utf-8");
}

export function getLineSession(userId: string): LineSessionFlow | null {
  if (!userId) return null;
  const all = readSessions();
  const item = all[userId];
  if (!item || Date.now() - item.updatedAt >= TTL_MS) return null;
  return item;
}

export function setLineSession(userId: string, session: LineSessionFlow): void {
  if (!userId) return;
  const all = readSessions();
  all[userId] = { ...session, updatedAt: Date.now() };
  writeSessions(all);
}

export function clearLineSession(userId: string): void {
  if (!userId) return;
  const all = readSessions();
  if (userId in all) {
    delete all[userId];
    writeSessions(all);
  }
}
