import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "../../../../lib/admin-auth";
import { toSafeUser } from "../../../../lib/user-auth";
import { configuredProviders } from "../../../../lib/oauth";
import { loadAppSettings } from "../../../../lib/sheets-db";

export const dynamic = "force-dynamic";

// สมาชิกที่ล็อกอินอยู่ (ข้อมูลล่าสุดจากชีต) + ช่องทางเข้าสู่ระบบที่ร้านตั้งค่าไว้
export async function GET(req: NextRequest) {
  try {
    await loadAppSettings();
    const providers = configuredProviders();
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ ok: false, user: null, providers }, { status: 401 });
    return NextResponse.json({ ok: true, user: toSafeUser(user), providers });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
