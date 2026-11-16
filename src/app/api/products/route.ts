import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createProductRecord, getAllDatabase, localNextId } from "../../../lib/sheets-db";
import { isAdminRequest, unauthorizedResponse, getAdminOperatorName } from "../../../lib/admin-auth";
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
  if (!isAdminRequest(req)) return unauthorizedResponse();

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

    const newProduct: Product = {
      id: body.id?.trim() || localNextId("products", data.products.map((p) => p.id)),
      productType: body.productType?.trim() || "รับคัดลูก",
      name: body.name.trim(),
      variety: body.variety?.trim() || "หมอนทอง",
      type: body.type === "flesh" ? "flesh" : "whole",
      maturity: body.maturity?.trim() || body.specs?.maturity || "แก่จัด 85%+",
      texture: body.texture?.trim() || body.specs?.texture || "กรอบนอกนุ่มใน",
      grade: body.grade?.trim() || "เกรด A+ พรีเมียม",
      stockQty: typeof body.stockQty === "number" ? body.stockQty : 10,
      stockKg: typeof body.stockKg === "number" ? body.stockKg : 30,
      weight: body.weight?.trim() || "3.0 - 3.5 กก.",
      pricePerKg: targetPrice,
      price: targetPrice,
      marketPrice: body.marketPrice ? Number(body.marketPrice) : undefined,
      unit: body.unit?.trim() || "ลูก",
      origin: body.origin?.trim() || "สวนระยองแท้",
      brix: body.brix?.trim() || "33° Brix",
      image:
        body.image?.trim() ||
        "https://images.unsplash.com/photo-1519544442-93857b48665e?auto=format&fit=crop&w=800&q=80",
      badge: body.badge?.trim() || undefined,
      isAvailable: body.isAvailable !== false,
      isActive: (body.isActive === 0 || (body.isActive as any) === "0" || body.isActive === false) ? 0 : 1,
      createDate: new Date().toISOString(),
      createdBy: body.createdBy?.trim() || getAdminOperatorName(req),
      updatedAt: new Date().toISOString(),
      updatedBy: body.updatedBy?.trim() || body.createdBy?.trim() || getAdminOperatorName(req),
      description: body.description?.trim() || "ทุเรียนคัดคุณภาพจากสวนโดยทุเรียนวินคิน",
      specs: {
        maturity: body.maturity?.trim() || body.specs?.maturity || "แก่จัด 85%+",
        texture: body.texture?.trim() || body.specs?.texture || "กรอบนอกนุ่มใน",
        flavor: body.specs?.flavor || "หวานมันกลมกล่อม",
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
