import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateProductRecord } from "../../../../lib/sheets-db";
import { requireAdmin, unauthorizedResponse, getAdminOperatorName } from "../../../../lib/admin-auth";
import type { Product } from "../../../../types/durian";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin(req))) return unauthorizedResponse();

  try {
    const { id } = await context.params;
    const productId = decodeURIComponent(id);
    const body = (await req.json()) as Partial<Product>;

    const updates: Partial<Product> = {};
    if (body.productType !== undefined) updates.productType = body.productType;
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.pricePerKg !== undefined) {
      updates.pricePerKg = Number(body.pricePerKg);
      updates.price = Number(body.pricePerKg);
    }
    if (body.price !== undefined) {
      updates.price = Number(body.price);
      if (body.pricePerKg === undefined) updates.pricePerKg = Number(body.price);
    }
    if (body.maturity !== undefined) updates.maturity = body.maturity;
    if (body.texture !== undefined) updates.texture = body.texture;
    if (body.grade !== undefined) updates.grade = body.grade;
    if (body.image !== undefined) updates.image = body.image.trim();
    if (body.description !== undefined) updates.description = body.description.trim();
    if (body.isAvailable !== undefined) updates.isAvailable = Boolean(body.isAvailable);
    if (body.weight !== undefined) updates.weight = body.weight;
    if (body.badge !== undefined) updates.badge = body.badge;
    if (body.ripeness !== undefined) updates.ripeness = body.ripeness;
    if (body.stockUnit !== undefined) updates.stockUnit = body.stockUnit;
    if (body.stockKg !== undefined) updates.stockKg = Number(body.stockKg);
    if (body.avgWeightKg !== undefined) updates.avgWeightKg = Number(body.avgWeightKg);
    if (body.stockQty !== undefined) updates.stockQty = Number(body.stockQty);
    if (body.variety !== undefined) updates.variety = body.variety;
    if (body.origin !== undefined) updates.origin = body.origin;
    if (body.brix !== undefined) updates.brix = body.brix;
    if (body.unit !== undefined) updates.unit = body.unit;
    if (body.type !== undefined) updates.type = body.type === "flesh" ? "flesh" : "whole";
    if (body.marketPrice !== undefined) updates.marketPrice = Number(body.marketPrice) || 0;
    if (body.custom !== undefined && body.custom && typeof body.custom === "object") updates.custom = body.custom;
    if (body.isActive !== undefined) {
      updates.isActive = (body.isActive === 0 || (body.isActive as any) === "0" || body.isActive === false) ? 0 : 1;
    }
    updates.updatedBy = body.updatedBy?.trim() || getAdminOperatorName(req);
    updates.updatedAt = new Date().toISOString();

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
