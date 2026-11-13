import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAllUsers } from "../../../../lib/sheets-db";
import { toSafeUser } from "../../../../lib/user-auth";
import { isAdminRequest, unauthorizedResponse } from "../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!isAdminRequest(req)) {
      return unauthorizedResponse();
    }

    const users = await getAllUsers();
    const safeUsers = users.map((u) => toSafeUser(u));

    return NextResponse.json({
      ok: true,
      users: safeUsers,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
