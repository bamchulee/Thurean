import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, USER_COOKIE_NAME } from "../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({
    ok: true,
    message: "ออกจากระบบเรียบร้อยแล้ว",
  });

  response.cookies.delete(USER_COOKIE_NAME);
  response.cookies.delete(ADMIN_COOKIE_NAME);

  return response;
}

