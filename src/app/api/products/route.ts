import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createProductRecord, getAllDatabase } from "../../../lib/sheets-db";
import { isAdminRequest, unauthorizedResponse } from "../../../lib/admin-auth";
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
    if (!body.name?.trim() || !body.variety?.trim() || !body.price) {
      return NextResponse.json(
        { ok: false, error: "กรุณาระบุชื่อสินค้า สายพันธุ์ และราคา" },
        { status: 400 }
      );
    }

    const newProduct: Product = {
      id: body.id?.trim() || `WK-${Math.floor(10 + Math.random() * 89)}`,
      name: body.name.trim(),
      variety: body.variety.trim(),
      type: body.type === "flesh" ? "flesh" : "whole",
      ripeness: body.ripeness?.trim() || "กรอบนอกนุ่มใน (ไก่ฉีก)",
      weight: body.weight?.trim() || "3.0 - 3.5 กก.",
      price: Number(body.price),
      marketPrice: body.marketPrice ? Number(body.marketPrice) : undefined,
      unit: body.unit?.trim() || "ลูก",
      origin: body.origin?.trim() || "สวนระยองแท้",
      brix: body.brix?.trim() || "33° Brix",
      image:
        body.image?.trim() ||
        "https://images.unsplash.com/photo-1519544442-93857b48665e?auto=format&fit=crop&w=800&q=80",
      badge: body.badge?.trim() || undefined,
      isAvailable: body.isAvailable !== false,
      description: body.description?.trim() || "ทุเรียนคัดคุณภาพจากสวนโดยทุเรียนวินคิน",
      specs: {
        maturity: body.specs?.maturity || "แก่จัด 85%+",
        texture: body.specs?.texture || "เนียนแน่น ไม่เละ",
        flavor: body.specs?.flavor || "หวานมันกลมกล่อม",
      },
    };

    const created = await createProductRecord(newProduct);
    return NextResponse.json({ ok: true, product: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
