import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateClaimRecord } from "../../../../lib/sheets-db";
import { isAdminRequest, unauthorizedResponse } from "../../../../lib/admin-auth";
import type { ClaimStatus } from "../../../../types/durian";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  try {
    const { id } = await context.params;
    const claimId = decodeURIComponent(id);
    const body = (await req.json()) as {
      status?: ClaimStatus;
      resolutionNote?: string;
    };

    const updated = await updateClaimRecord(claimId, {
      status: body.status,
      resolutionNote: body.resolutionNote,
    });

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "ไม่พบคำร้องเคลมนี้" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, claim: updated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
