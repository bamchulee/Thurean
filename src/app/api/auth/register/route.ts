import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getUserByUsername,
  createUserRecord,
} from "../../../../lib/sheets-db";
import {
  hashPassword,
  createSessionToken,
  toSafeUser,
} from "../../../../lib/user-auth";
import type { User } from "../../../../types/durian";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      username,
      password,
      firstName,
      lastName,
      phone,
      address,
      postalCode,
      avatarUrl,
    } = body;

    // Validation
    const cleanUsername = String(username || "").trim().toLowerCase();
    if (!cleanUsername || cleanUsername.length < 3) {
      return NextResponse.json(
        { ok: false, error: "ชื่อผู้ใช้ (Username) ต้องมีความยาวอย่างน้อย 3 ตัวอักษร" },
        { status: 400 }
      );
    }

    const cleanPassword = String(password || "").trim();
    if (!cleanPassword || cleanPassword.length < 4) {
      return NextResponse.json(
        { ok: false, error: "รหัสผ่าน (Password) ต้องมีความยาวอย่างน้อย 4 ตัวอักษร" },
        { status: 400 }
      );
    }

    const cleanFirst = String(firstName || "").trim();
    const cleanLast = String(lastName || "").trim();
    if (!cleanFirst || !cleanLast) {
      return NextResponse.json(
        { ok: false, error: "กรุณากรอกชื่อและนามสกุลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const cleanPhone = String(phone || "").trim().replace(/[^0-9]/g, "");
    if (!cleanPhone || cleanPhone.length < 9) {
      return NextResponse.json(
        { ok: false, error: "กรุณาระบุหมายเลขโทรศัพท์ 9-10 หลักให้ถูกต้อง" },
        { status: 400 }
      );
    }

    const cleanAddress = String(address || "").trim();
    if (!cleanAddress) {
      return NextResponse.json(
        { ok: false, error: "กรุณากรอกที่อยู่จัดส่ง" },
        { status: 400 }
      );
    }

    const cleanPostal = String(postalCode || "").trim().replace(/[^0-9]/g, "");
    if (!cleanPostal || cleanPostal.length !== 5) {
      return NextResponse.json(
        { ok: false, error: "กรุณาระบุรหัสไปรษณีย์ 5 หลักให้ถูกต้อง" },
        { status: 400 }
      );
    }

    // Check existing
    const existing = await getUserByUsername(cleanUsername);
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "ชื่อผู้ใช้หรือเบอร์โทรนี้ถูกลงทะเบียนไว้แล้ว" },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      username: cleanUsername,
      passwordHash: hashPassword(cleanPassword),
      firstName: cleanFirst,
      lastName: cleanLast,
      phone: cleanPhone,
      address: cleanAddress,
      postalCode: cleanPostal,
      avatarUrl: avatarUrl ? String(avatarUrl).trim() : undefined,
      role: "user",
      createdAt: now,
      updatedAt: now,
    };

    // Save to Google Sheet & Local DB
    await createUserRecord(newUser);

    const safe = toSafeUser(newUser);
    const token = createSessionToken(safe);

    const response = NextResponse.json({
      ok: true,
      user: safe,
      token,
      message: "ลงทะเบียนสมาชิกสำเร็จ ยินดีต้อนรับสู่ครอบครัวทุเรียนวินคิน!",
    });

    // Set HTTP-Only Cookie
    response.cookies.set("winkin_user_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `เกิดข้อผิดพลาดในการสมัครสมาชิก: ${String(err)}` },
      { status: 500 }
    );
  }
}
