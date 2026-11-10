import { NextResponse } from "next/server";
import { getAllDatabase } from "../../../lib/sheets-db";
import { shopInfo } from "../../../data/mock";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, source, warning } = await getAllDatabase();
    const activeRound =
      data.rounds.find((r) => r.status === "open") || data.rounds[0] || null;

    return NextResponse.json({
      ok: true,
      source,
      warning,
      products: data.products,
      currentRound: activeRound,
      shopInfo,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
