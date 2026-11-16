import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";
import { getRuntimeConfig } from "../../../../../lib/sheets-db";

export const dynamic = "force-dynamic";

function getCallbackUrl(req: NextRequest, publicBaseUrl?: string): string {
  if (publicBaseUrl && publicBaseUrl.startsWith("http")) {
    return `${publicBaseUrl.replace(/\/+$/, "")}/api/auth/line/callback`;
  }
  const fwdHost =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const fwdProto = req.headers.get("x-forwarded-proto") || "https";
  if (fwdHost && (fwdHost.includes("localhost") || fwdHost.includes("127.0.0.1"))) {
    return `${fwdProto}://${fwdHost}/api/auth/line/callback`;
  }
  return "https://durianwinkin.vercel.app/api/auth/line/callback";
}

export async function GET(req: NextRequest) {
  const cfg = getRuntimeConfig();
  const channelId = cfg.lineLoginChannelId || process.env.LINE_LOGIN_CHANNEL_ID || "2012605985";

  if (!channelId) {
    // If not configured, redirect back to shop with error notice
    const url = new URL("/", req.url);
    url.searchParams.set("line_login_error", "not_configured");
    return NextResponse.redirect(url);
  }

  const callbackUrl = getCallbackUrl(req, cfg.publicBaseUrl);
  const state = crypto.randomBytes(16).toString("hex");

  const lineAuthUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
  lineAuthUrl.searchParams.set("response_type", "code");
  lineAuthUrl.searchParams.set("client_id", channelId);
  lineAuthUrl.searchParams.set("redirect_uri", callbackUrl);
  lineAuthUrl.searchParams.set("state", state);
  lineAuthUrl.searchParams.set("scope", "profile openid");
  lineAuthUrl.searchParams.set("bot_prompt", "normal");

  const res = NextResponse.redirect(lineAuthUrl);
  res.cookies.set("winkin_line_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15, // 15 minutes
  });

  const redirectParam = req.nextUrl.searchParams.get("redirect");
  if (redirectParam && redirectParam.startsWith("/")) {
    res.cookies.set("winkin_line_redirect", redirectParam, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15, // 15 minutes
    });
  }

  return res;
}
