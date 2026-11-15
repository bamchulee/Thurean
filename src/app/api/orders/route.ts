import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAllDatabase } from "../../../lib/sheets-db";
import { isAdminRequest, unauthorizedResponse } from "../../../lib/admin-auth";
import { submitNewOrder } from "../../../lib/order-service";
import type { SubmitOrderInput } from "../../../lib/order-service";
import { getSessionUser, verifyLineAccessToken } from "../../../lib/line-verify";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  try {
    const { data, source, warning } = await getAllDatabase();
    return NextResponse.json({
      ok: true,
      source,
      warning,
      orders: data.orders,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = (await req.json()) as SubmitOrderInput & { lineAccessToken?: string };
    // ไม่เชื่อ userId / lineUserId จากเบราว์เซอร์ — ระบุตัวตนจาก session หรือ token ที่ LINE ยืนยันแล้ว
    const { userId: _u, lineUserId: _l, lineAccessToken, ...body } = raw;
    const session = getSessionUser(req);
    const lineProfile = session ? null : await verifyLineAccessToken(lineAccessToken);
    const res = await submitNewOrder({
      ...body,
      userId: session?.id,
      lineUserId: session?.lineUserId || lineProfile?.userId,
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: res.error },
        { status: res.status }
      );
    }
    return NextResponse.json({ ok: true, order: res.order }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
