import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createAdminSessionToken,
  getRuntimeConfig,
  upsertLineUser,
} from "../../../../../lib/sheets-db";
import { createSessionToken, toSafeUser } from "../../../../../lib/user-auth";
import { ADMIN_COOKIE_NAME } from "../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

function getCallbackUrl(req: NextRequest, publicBaseUrl?: string): string {
  if (publicBaseUrl && publicBaseUrl.startsWith("http")) {
    return `${publicBaseUrl.replace(/\/+$/, "")}/api/auth/line/callback`;
  }
  const fwdHost =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const fwdProto = req.headers.get("x-forwarded-proto") || "https";
  if (fwdHost) {
    return `${fwdProto}://${fwdHost}/api/auth/line/callback`;
  }
  return "https://durianwinkin.vercel.app/api/auth/line/callback";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  const homeUrl = new URL("/", req.url);

  if (error || !code) {
    homeUrl.searchParams.set(
      "line_login_error",
      errorDescription || error || "cancelled"
    );
    return NextResponse.redirect(homeUrl);
  }

  const savedState = req.cookies.get("winkin_line_state")?.value;
  if (!state || !savedState || state !== savedState) {
    homeUrl.searchParams.set("line_login_error", "invalid_state");
    return NextResponse.redirect(homeUrl);
  }

  const cfg = getRuntimeConfig();
  const channelId = cfg.lineLoginChannelId || process.env.LINE_LOGIN_CHANNEL_ID;
  const channelSecret =
    cfg.lineLoginChannelSecret || process.env.LINE_LOGIN_CHANNEL_SECRET;

  if (!channelId || !channelSecret) {
    homeUrl.searchParams.set("line_login_error", "credentials_missing");
    return NextResponse.redirect(homeUrl);
  }

  try {
    const callbackUrl = getCallbackUrl(req, cfg.publicBaseUrl);

    // 1. Exchange code for access token
    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl,
        client_id: channelId,
        client_secret: channelSecret,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("LINE Token Exchange Failed:", errText);
      homeUrl.searchParams.set("line_login_error", "token_exchange_failed");
      return NextResponse.redirect(homeUrl);
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      id_token?: string;
    };

    // 2. Fetch User Profile from LINE
    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileRes.ok) {
      homeUrl.searchParams.set("line_login_error", "profile_fetch_failed");
      return NextResponse.redirect(homeUrl);
    }

    const profile = (await profileRes.json()) as {
      userId: string;
      displayName: string;
      pictureUrl?: string;
      statusMessage?: string;
    };

    // 3. Upsert user into Google Sheet (Users tab)
    const user = await upsertLineUser({
      lineUserId: profile.userId,
      displayName: profile.displayName,
      avatarUrl: profile.pictureUrl,
      source: "line-login",
      notes: "เข้าสู่ระบบผ่าน LINE Login OAuth สำเร็จ",
    });

    // 4. Set session cookie and redirect
    const safe = toSafeUser(user);
    const sessionToken = createSessionToken(safe);

    // If user is Admin, redirect to /admin directly, otherwise to home
    const redirectUrl =
      safe.role === "admin"
        ? new URL("/admin", req.url)
        : homeUrl;

    if (safe.role !== "admin") {
      redirectUrl.searchParams.set("login_success", "line");
    }

    const res = NextResponse.redirect(redirectUrl);

    res.cookies.set("winkin_user_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    if (safe.role === "admin") {
      const adminToken = createAdminSessionToken(cfg.adminPin || "2824");
      res.cookies.set(ADMIN_COOKIE_NAME, adminToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }

    res.cookies.delete("winkin_line_state");
    return res;
  } catch (err) {
    console.error("LINE Login Callback Error:", err);
    homeUrl.searchParams.set("line_login_error", "server_error");
    return NextResponse.redirect(homeUrl);
  }
}
