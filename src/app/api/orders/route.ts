import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAllDatabase } from "../../../lib/sheets-db";
import { isAdminRequest, unauthorizedResponse } from "../../../lib/admin-auth";
import { submitNewOrder } from "../../../lib/order-service";
import type { SubmitOrderInput } from "../../../lib/order-service";

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
    const body = (await req.json()) as SubmitOrderInput;
    const res = await submitNewOrder(body);
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
