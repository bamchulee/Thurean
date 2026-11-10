import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createPromotionRecord,
  getAllDatabase,
  updatePromotionRecord,
} from "../../../lib/sheets-db";
import { isAdminRequest, unauthorizedResponse } from "../../../lib/admin-auth";
import type { Promotion } from "../../../types/durian";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data } = await getAllDatabase();
    return NextResponse.json({
      ok: true,
      promotions: data.promotions || [],
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  try {
    const body = (await req.json()) as Partial<Promotion>;
    if (!body.title?.trim() || !body.discountText?.trim()) {
      return NextResponse.json(
        { ok: false, error: "กรุณากรอกชื่อโปรโมชั่นและข้อความส่วนลด" },
        { status: 400 }
      );
    }

    const promo: Promotion = {
      id: body.id?.trim() || `PROMO-${Math.floor(10 + Math.random() * 89)}`,
      title: body.title.trim(),
      badge: body.badge?.trim() || undefined,
      discountText: body.discountText.trim(),
      conditionText: body.conditionText?.trim() || "-",
      promoCode: body.promoCode?.trim() || undefined,
      isActive: body.isActive !== false,
    };

    const created = await createPromotionRecord(promo);
    return NextResponse.json({ ok: true, promotion: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  try {
    const body = (await req.json()) as Partial<Promotion> & { id?: string };
    if (!body.id?.trim()) {
      return NextResponse.json({ ok: false, error: "ต้องระบุรหัสโปรโมชั่น" }, { status: 400 });
    }
    const { id, ...updates } = body;
    const updated = await updatePromotionRecord(id.trim(), updates);
    if (!updated) {
      return NextResponse.json({ ok: false, error: "ไม่พบโปรโมชั่น" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, promotion: updated });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
