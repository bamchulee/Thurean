import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRoundRecord, getAllDatabase } from "../../../lib/sheets-db";
import { isAdminRequest, unauthorizedResponse } from "../../../lib/admin-auth";
import type { Round } from "../../../types/durian";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  try {
    const { data } = await getAllDatabase();
    return NextResponse.json({ ok: true, rounds: data.rounds });
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
    const body = (await req.json()) as Partial<Round>;
    if (!body.name?.trim()) {
      return NextResponse.json(
        { ok: false, error: "กรุณาระบุชื่อรอบจัดส่ง" },
        { status: 400 }
      );
    }

    const totalQuota = Number(body.totalQuota) || 100;
    const newRound: Round = {
      id: body.id?.trim() || `WK-ROUND-${Math.floor(47 + Math.random() * 50)}`,
      name: body.name.trim(),
      truckRoute:
        body.truckRoute?.trim() ||
        "สายวิ่ง: ระยอง (แกลง) → จันทบุรี → ส่งตรงถึงบ้าน",
      harvestDate: body.harvestDate?.trim() || "ศุกร์นี้",
      closeDate: body.closeDate?.trim() || new Date(Date.now() + 3 * 86400000).toISOString(),
      deliveryDate: body.deliveryDate?.trim() || "เสาร์-อาทิตย์นี้",
      status: "open",
      quotaRemaining: totalQuota,
      totalQuota,
    };

    const created = await createRoundRecord(newRound);
    return NextResponse.json({ ok: true, round: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
