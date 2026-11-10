import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createClaimRecord,
  getAllDatabase,
  getRuntimeConfig,
  updateOrderRecord,
} from "../../../lib/sheets-db";
import { isAdminRequest, unauthorizedResponse } from "../../../lib/admin-auth";
import {
  buildClaimAlertForAdmin,
  pushLineMessage,
} from "../../../lib/line-notify";
import type { Claim } from "../../../types/durian";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  try {
    const { data } = await getAllDatabase();
    return NextResponse.json({ ok: true, claims: data.claims });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      orderId?: string;
      phone?: string;
      reason?: string;
      description?: string;
      evidenceName?: string;
    };

    if (!body.orderId?.trim() || !body.phone?.trim() || !body.reason?.trim()) {
      return NextResponse.json(
        { ok: false, error: "กรุณากรอกรหัสคำสั่งซื้อ เบอร์โทร และลักษณะปัญหา" },
        { status: 400 }
      );
    }

    const orderIdClean = body.orderId.trim().toUpperCase();
    const { data } = await getAllDatabase();
    const matchedOrder = data.orders.find(
      (o) => o.id.toUpperCase() === orderIdClean
    );

    const newClaim: Claim = {
      claimId: `CLM-${Math.floor(10000 + Math.random() * 89999)}`,
      createdAt: new Date().toISOString(),
      orderId: orderIdClean,
      phone: body.phone.trim(),
      reason: body.reason.trim(),
      description: body.description?.trim() || "",
      evidenceName: body.evidenceName?.trim() || undefined,
      status: "pending",
      lotId: matchedOrder?.lotId || undefined,
    };

    const created = await createClaimRecord(newClaim);

    // Flag the order status if found
    if (matchedOrder) {
      await updateOrderRecord(matchedOrder.id, { orderStatus: "claimed" });
    }

    // Notify Admin via LINE OA
    const cfg = getRuntimeConfig();
    if (cfg.lineChannelAccessToken && cfg.lineAdminUserId) {
      await pushLineMessage(
        cfg.lineAdminUserId,
        buildClaimAlertForAdmin(created),
        cfg.lineChannelAccessToken
      );
    }

    return NextResponse.json({ ok: true, claim: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
