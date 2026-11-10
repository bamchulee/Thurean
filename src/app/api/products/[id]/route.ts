import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateProductRecord } from "../../../../lib/sheets-db";
import { isAdminRequest, unauthorizedResponse } from "../../../../lib/admin-auth";
import type { Product } from "../../../../types/durian";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  try {
    const { id } = await context.params;
    const productId = decodeURIComponent(id);
    const body = (await req.json()) as Partial<Product>;

    const updates: Partial<Product> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.price !== undefined) updates.price = Number(body.price);
    if (body.isAvailable !== undefined) updates.isAvailable = Boolean(body.isAvailable);
    if (body.weight !== undefined) updates.weight = body.weight;
    if (body.badge !== undefined) updates.badge = body.badge;
    if (body.ripeness !== undefined) updates.ripeness = body.ripeness;

    const updated = await updateProductRecord(productId, updates);
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "ไม่พบสินค้านี้" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, product: updated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
