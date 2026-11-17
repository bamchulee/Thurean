import type { NextRequest } from "next/server";
import { finishOAuth } from "../../../../../lib/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return finishOAuth(req, "line");
}
