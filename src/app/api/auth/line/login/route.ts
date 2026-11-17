import type { NextRequest } from "next/server";
import { startOAuth } from "../../../../../lib/oauth";

export const dynamic = "force-dynamic";

// เข้าสู่ระบบ / เชื่อมบัญชี (line) — ?mode=link&next=/path
export function GET(req: NextRequest) {
  return startOAuth(req, "line");
}
