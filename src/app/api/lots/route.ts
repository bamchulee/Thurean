import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createLotRecord, getAllDatabase, localNextId } from "../../../lib/sheets-db";
import { isAdminRequest, unauthorizedResponse } from "../../../lib/admin-auth";
import type { LotCost } from "../../../types/durian";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  try {
    const { data } = await getAllDatabase();
    return NextResponse.json({ ok: true, lots: data.lots });
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
    const body = (await req.json()) as Partial<LotCost>;
    const { data } = await getAllDatabase();
    if (!body.supplierName?.trim() || !body.weightKg || !body.costPerKg) {
      return NextResponse.json(
        { ok: false, error: "กรุณาระบุชื่อสวน/ล้ง น้ำหนัก (กก.) และราคาต้นทุน/กก." },
        { status: 400 }
      );
    }

    const weightKg = Number(body.weightKg);
    const costPerKg = Number(body.costPerKg);
    const totalFruitCost =
      body.totalFruitCost !== undefined
        ? Number(body.totalFruitCost)
        : Math.round(weightKg * costPerKg);

    const newLot: LotCost = {
      lotId: body.lotId?.trim() || localNextId("lots", data.lots.map((l) => l.lotId)),
      roundId: body.roundId?.trim() || "WK-ROUND-46",
      date: body.date || new Date().toISOString().slice(0, 10),
      supplierName: body.supplierName.trim(),
      supplierPhone: body.supplierPhone?.trim() || "",
      variety: body.variety?.trim() || "หมอนทอง",
      weightKg,
      costPerKg,
      totalFruitCost,
      packagingCost: Number(body.packagingCost) || 0,
      truckFuelCost: Number(body.truckFuelCost) || 0,
      notes: body.notes?.trim() || "",
    };

    const created = await createLotRecord(newLot, { autoId: !body.lotId?.trim() });
    return NextResponse.json({ ok: true, lot: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
