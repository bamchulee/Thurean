import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateRoundRecord } from "../../../../lib/sheets-db";
import { isAdminRequest, unauthorizedResponse } from "../../../../lib/admin-auth";
import type { Round } from "../../../../types/durian";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  try {
    const { id } = await context.params;
    const roundId = decodeURIComponent(id);
    const body = (await req.json()) as Partial<Round>;

    const updated = await updateRoundRecord(roundId, body);
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "ไม่พบรอบจัดส่งนี้" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, round: updated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
