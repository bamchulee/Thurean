import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getAllUsers,
  createUserRecord,
  updateUserRecord,
} from "../../../../lib/sheets-db";
import { createSessionToken, toSafeUser } from "../../../../lib/user-auth";
import type { User } from "../../../../types/durian";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      lineUserId,
      displayName,
      pictureUrl,
      phone,
      address,
      postalCode,
    } = body;

    if (!displayName && !lineUserId) {
      return NextResponse.json(
        { ok: false, error: "กรุณาระบุข้อมูล LINE ให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const cleanLineId = String(lineUserId || "").trim();
    const cleanName = String(displayName || "ลูกค้า LINE").trim();
    const cleanPhone = String(phone || "").trim();
    const cleanAddress = String(address || "").trim();
    const cleanPostal = String(postalCode || "").trim();
    const cleanAvatar = pictureUrl ? String(pictureUrl).trim() : "";

    const allUsers = await getAllUsers();

    // Check if user already exists by lineUserId or matching phone
    let existingUser = allUsers.find(
      (u) =>
        (cleanLineId && (u as any).lineUserId === cleanLineId) ||
        (cleanLineId && u.username === `line_${cleanLineId}`) ||
        (cleanPhone && cleanPhone.length >= 9 && u.phone === cleanPhone)
    );

    const now = new Date().toISOString();

    if (existingUser) {
      // Update existing record if new phone/address/avatar provided
      const updates: Partial<User> = {
        updatedAt: now,
      };

      if (cleanAvatar && !existingUser.avatarUrl) updates.avatarUrl = cleanAvatar;
      if (cleanPhone && (!existingUser.phone || cleanPhone !== existingUser.phone)) {
        updates.phone = cleanPhone;
      }
      if (cleanAddress && (!existingUser.address || cleanAddress !== existingUser.address)) {
        updates.address = cleanAddress;
      }
      if (cleanPostal && (!existingUser.postalCode || cleanPostal !== existingUser.postalCode)) {
        updates.postalCode = cleanPostal;
      }
      if (cleanName && (!existingUser.firstName || existingUser.firstName === "ลูกค้า LINE")) {
        updates.firstName = cleanName;
      }
      if (cleanLineId && !(existingUser as any).lineUserId) {
        (updates as any).lineUserId = cleanLineId;
      }

      const updated = await updateUserRecord(existingUser.id, updates);
      const finalUser = updated || existingUser;
      const safe = toSafeUser(finalUser);
      const token = createSessionToken(safe);

      const res = NextResponse.json({
        ok: true,
        user: safe,
        isNew: false,
      });

      res.cookies.set("winkin_user_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });

      return res;
    }

    // New LINE user registration
    const newUser: User = {
      id: `usr_line_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      username: cleanLineId ? `line_${cleanLineId}` : `line_${Date.now()}`,
      passwordHash: "LINE_AUTH_NO_PASSWORD",
      firstName: cleanName,
      lastName: "",
      phone: cleanPhone,
      address: cleanAddress,
      postalCode: cleanPostal,
      avatarUrl: cleanAvatar || "https://api.dicebear.com/7.x/bottts/svg?seed=MonthongKing&backgroundColor=fef08a",
      role: "user",
      createdAt: now,
      updatedAt: now,
    };
    (newUser as any).lineUserId = cleanLineId;

    await createUserRecord(newUser);
    const safe = toSafeUser(newUser);
    const token = createSessionToken(safe);

    const res = NextResponse.json({
      ok: true,
      user: safe,
      isNew: true,
    });

    res.cookies.set("winkin_user_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `เกิดข้อผิดพลาด: ${String(err)}` },
      { status: 500 }
    );
  }
}
