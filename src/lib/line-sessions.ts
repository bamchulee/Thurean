// ============================================================
// Lightweight LINE Chat Session Store (Order & Claim Wizards)
// ============================================================
import fs from "fs";
import path from "path";
import { getWritableDataDir } from "./storage-dir";

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

const TTL_MS = 30 * 60 * 1000;

function getSessionPath(): string {
  return path.join(getWritableDataDir(), "line-sessions.json");
}

function readSessions(): Record<string, LineSessionFlow> {
  try {
    const p = getSessionPath();
    if (!fs.existsSync(p)) return {};
    const parsed = JSON.parse(fs.readFileSync(p, "utf-8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSessions(map: Record<string, LineSessionFlow>) {
  const p = getSessionPath();
  const now = Date.now();
  const pruned: Record<string, LineSessionFlow> = {};
  for (const [k, v] of Object.entries(map)) {
    if (v && now - v.updatedAt < TTL_MS) pruned[k] = v;
  }
  fs.writeFileSync(p, JSON.stringify(pruned, null, 2), "utf-8");
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
