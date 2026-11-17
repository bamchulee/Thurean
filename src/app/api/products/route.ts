import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createProductRecord, getAllDatabase, localNextId } from "../../../lib/sheets-db";
import { requireAdmin, unauthorizedResponse, getAdminOperatorName } from "../../../lib/admin-auth";
import type { Product } from "../../../types/durian";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, source } = await getAllDatabase();
    return NextResponse.json({ ok: true, source, products: data.products });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return unauthorizedResponse();

  try {
    const body = (await req.json()) as Partial<Product>;
    const { data } = await getAllDatabase();
    const targetPrice = Number(body.pricePerKg || body.price || 0);
    if (!body.name?.trim() || !targetPrice) {
      return NextResponse.json(
        { ok: false, error: "กรุณาระบุชื่อสินค้า และราคาต่อโล" },
        { status: 400 }
      );
    }

    // ช่องที่เว้นว่างให้ว่างจริง — ไม่เติมค่าตัวอย่าง
    const num = (v: unknown) => (v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? undefined : Number(v));
    const newProduct: Product = {
      id: body.id?.trim() || localNextId("products", data.products.map((p) => p.id)),
      productType: body.productType?.trim() || "",
      name: body.name.trim(),
      variety: body.variety?.trim() || "",
      type: body.type === "flesh" ? "flesh" : "whole",
      maturity: body.maturity?.trim() || body.specs?.maturity || "",
      texture: body.texture?.trim() || body.specs?.texture || "",
      grade: body.grade?.trim() || "",
      stockQty: num(body.stockQty),
      stockKg: num(body.stockKg),
      avgWeightKg: num(body.avgWeightKg),
      weight: body.weight?.trim() || "",
      pricePerKg: targetPrice,
      price: targetPrice,
      marketPrice: num(body.marketPrice),
      unit: body.unit?.trim() || "ลูก",
      origin: body.origin?.trim() || "",
      brix: body.brix?.trim() || "",
      image: body.image?.trim() || "",
      badge: body.badge?.trim() || undefined,
      custom: body.custom,
      isAvailable: body.isAvailable !== false,
      isActive: (body.isActive === 0 || (body.isActive as any) === "0" || body.isActive === false) ? 0 : 1,
      createDate: new Date().toISOString(),
      createdBy: body.createdBy?.trim() || getAdminOperatorName(req),
      updatedAt: new Date().toISOString(),
      updatedBy: body.updatedBy?.trim() || body.createdBy?.trim() || getAdminOperatorName(req),
      description: body.description?.trim() || "",
      specs: {
        maturity: body.maturity?.trim() || body.specs?.maturity || "",
        texture: body.texture?.trim() || body.specs?.texture || "",
        flavor: body.specs?.flavor || "",
      },
    };

    const created = await createProductRecord(newProduct, { autoId: !body.id?.trim() });
    return NextResponse.json({ ok: true, product: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
