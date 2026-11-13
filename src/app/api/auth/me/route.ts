import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserById } from "../../../../lib/sheets-db";
import { verifySessionToken, toSafeUser } from "../../../../lib/user-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const cookieToken = req.cookies.get("winkin_user_token")?.value;
    const authHeader = req.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : undefined;

    const token = cookieToken || bearerToken;
    if (!token) {
      return NextResponse.json({ ok: false, user: null }, { status: 401 });
    }

    const session = verifySessionToken(token);
    if (!session || !session.id) {
      return NextResponse.json({ ok: false, user: null }, { status: 401 });
    }

    const user = await getUserById(session.id);
    if (!user) {
      return NextResponse.json({ ok: false, user: null }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      user: toSafeUser(user),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
