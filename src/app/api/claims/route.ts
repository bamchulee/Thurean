import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAllDatabase } from "../../../lib/sheets-db";
import { getCurrentUser, requireStaff, unauthorizedResponse } from "../../../lib/admin-auth";
import { submitNewClaim } from "../../../lib/order-service";
import type { SubmitClaimInput } from "../../../lib/order-service";
import { getSessionUser } from "../../../lib/line-verify";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { data } = await getAllDatabase();
    if ((await requireStaff(req))) {
      return NextResponse.json({ ok: true, claims: data.claims });
    }

    // ลูกค้า: เฉพาะเคลมของบัญชีตัวเอง (ไม่จับคู่ด้วยเบอร์โทร — เบอร์ในโปรไฟล์แก้เองได้)
    const user = await getCurrentUser(req);
    if (user) {
      const userClaims = data.claims.filter(
        (c) => (c.userId && c.userId === user.id) || (user.lineUserId && c.lineUserId === user.lineUserId)
      );
      return NextResponse.json({ ok: true, claims: userClaims });
    }

    return unauthorizedResponse();
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: _u, ...body } = (await req.json()) as SubmitClaimInput;
    const res = await submitNewClaim({ ...body, userId: getSessionUser(req)?.id });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: res.error },
        { status: res.status }
      );
    }
    return NextResponse.json({ ok: true, claim: res.claim }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
