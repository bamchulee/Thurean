// ============================================================
// เข้าสู่ระบบด้วย LINE / Google / Facebook (OAuth 2.0 authorization code)
// /api/auth/<provider>/login?mode=login|link&next=/path → ผู้ให้บริการ → /api/auth/<provider>/callback
// state เซ็นด้วย HMAC (ไม่ต้องเก็บในเซิร์ฟเวอร์) + nonce ใน cookie กันคนอื่นยัดผลล็อกอินมาให้
// ============================================================
import crypto from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRuntimeConfig } from "./sheets-db";
import { getSigningSecret } from "./secrets";
import { createSessionToken, toSafeUser, verifySessionToken } from "./user-auth";
import { USER_COOKIE_NAME } from "./admin-auth";
import { type AuthProvider, type IdentityProfile, signInWithIdentity } from "./auth-identity";

const NONCE_COOKIE = "winkin_oauth_nonce";
const STATE_TTL_MS = 15 * 60 * 1000;
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

interface ProviderCredentials {
  clientId: string;
  clientSecret: string;
}

function credentialsFor(provider: AuthProvider): ProviderCredentials | null {
  const cfg = getRuntimeConfig();
  const pick = (id?: string, secret?: string) => (id && secret ? { clientId: id.trim(), clientSecret: secret.trim() } : null);
  switch (provider) {
    case "line":
      return pick(cfg.lineLoginChannelId, cfg.lineLoginChannelSecret);
    case "google":
      return pick(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    case "facebook":
      return pick(process.env.FACEBOOK_APP_ID, process.env.FACEBOOK_APP_SECRET);
  }
}

/** ช่องทางที่ตั้งค่าครบแล้ว — หน้าเว็บซ่อนปุ่มที่ยังไม่พร้อม */
export function configuredProviders(): Record<AuthProvider, boolean> {
  return {
    line: Boolean(credentialsFor("line")),
    google: Boolean(credentialsFor("google")),
    facebook: Boolean(credentialsFor("facebook")),
  };
}

function baseUrl(req: NextRequest): string {
  const configured = getRuntimeConfig().publicBaseUrl;
  if (configured && configured.startsWith("http")) return configured.replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function callbackUrl(req: NextRequest, provider: AuthProvider): string {
  return `${baseUrl(req)}/api/auth/${provider}/callback`;
}

/** กลับได้เฉพาะหน้าในเว็บนี้ (กัน open redirect) */
export function safeNext(raw?: string | null): string {
  const v = (raw || "").trim();
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/";
}

interface StatePayload {
  p: AuthProvider;
  m: "login" | "link";
  n: string; // nonce (ตรงกับ cookie)
  next: string;
  uid?: string; // ผู้ใช้ที่กดเชื่อม (mode=link)
  exp: number;
}

function signState(payload: StatePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getSigningSecret()).update(`oauth:${body}`).digest("base64url");
  return `${body}.${sig}`;
}

function readState(state: string | null): StatePayload | null {
  if (!state || !state.includes(".")) return null;
  const [body, sig] = state.split(".");
  const expected = crypto.createHmac("sha256", getSigningSecret()).update(`oauth:${body}`).digest("base64url");
  const a = Buffer.from(sig || "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StatePayload;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function currentSessionUserId(req: NextRequest): string | undefined {
  const token = req.cookies.get(USER_COOKIE_NAME)?.value;
  return token ? verifySessionToken(token)?.id : undefined;
}

function redirectWith(req: NextRequest, next: string, params: Record<string, string>): NextResponse {
  const url = new URL(next, baseUrl(req));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url);
  res.cookies.delete(NONCE_COOKIE);
  return res;
}

// ------------------------------------------------------------
// เริ่ม: ส่งผู้ใช้ไปหน้ายินยอมของผู้ให้บริการ
// ------------------------------------------------------------

export function startOAuth(req: NextRequest, provider: AuthProvider): NextResponse {
  const params = req.nextUrl.searchParams;
  const next = safeNext(params.get("next") || params.get("redirect"));
  const creds = credentialsFor(provider);
  if (!creds) return redirectWith(req, next, { auth_error: `${provider}_not_configured` });

  const mode = params.get("mode") === "link" ? "link" : "login";
  const uid = mode === "link" ? currentSessionUserId(req) : undefined;
  if (mode === "link" && !uid) return redirectWith(req, next, { auth_error: "login_required" });

  const nonce = crypto.randomBytes(16).toString("hex");
  const state = signState({ p: provider, m: mode, n: nonce, next, uid, exp: Date.now() + STATE_TTL_MS });
  const redirectUri = callbackUrl(req, provider);

  let url: URL;
  if (provider === "line") {
    url = new URL("https://access.line.me/oauth2/v2.1/authorize");
    url.searchParams.set("scope", "profile openid");
    // ชวนเพิ่มเพื่อน OA ตอนล็อกอิน — ต้องเป็นเพื่อนถึงจะได้รับยอด/QR/สถานะทาง LINE
    url.searchParams.set("bot_prompt", "aggressive");
  } else if (provider === "google") {
    url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("prompt", "select_account");
  } else {
    url = new URL("https://www.facebook.com/dialog/oauth");
    url.searchParams.set("scope", "public_profile,email");
  }
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url);
  res.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_MS / 1000,
  });
  return res;
}

// ------------------------------------------------------------
// กลับมาจากผู้ให้บริการ: แลก code → โปรไฟล์ → ล็อกอิน/ผูกบัญชี
// ------------------------------------------------------------

async function fetchProfile(
  provider: AuthProvider,
  code: string,
  redirectUri: string,
  creds: ProviderCredentials
): Promise<IdentityProfile & { lineFriend?: boolean }> {
  if (provider === "line") {
    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }),
    });
    if (!tokenRes.ok) throw new Error(`line token ${tokenRes.status}`);
    const { access_token } = (await tokenRes.json()) as { access_token: string };
    const auth = { headers: { Authorization: `Bearer ${access_token}` } };
    const profileRes = await fetch("https://api.line.me/v2/profile", auth);
    if (!profileRes.ok) throw new Error(`line profile ${profileRes.status}`);
    const p = (await profileRes.json()) as { userId: string; displayName?: string; pictureUrl?: string };
    let lineFriend: boolean | undefined;
    try {
      const fr = await fetch("https://api.line.me/friendship/v1/status", auth);
      if (fr.ok) lineFriend = Boolean(((await fr.json()) as { friendFlag?: boolean }).friendFlag);
    } catch {
      // ไม่รู้สถานะเพื่อนก็ล็อกอินต่อได้
    }
    return { provider, providerId: p.userId, displayName: p.displayName, avatarUrl: p.pictureUrl, lineFriend };
  }

  if (provider === "google") {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }),
    });
    if (!tokenRes.ok) throw new Error(`google token ${tokenRes.status}`);
    const { access_token } = (await tokenRes.json()) as { access_token: string };
    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!infoRes.ok) throw new Error(`google userinfo ${infoRes.status}`);
    const g = (await infoRes.json()) as { sub: string; name?: string; email?: string; email_verified?: boolean; picture?: string };
    return {
      provider,
      providerId: g.sub,
      displayName: g.name,
      email: g.email_verified ? g.email : undefined,
      avatarUrl: g.picture,
    };
  }

  const tokenUrl = new URL("https://graph.facebook.com/oauth/access_token");
  tokenUrl.searchParams.set("client_id", creds.clientId);
  tokenUrl.searchParams.set("client_secret", creds.clientSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);
  const tokenRes = await fetch(tokenUrl);
  if (!tokenRes.ok) throw new Error(`facebook token ${tokenRes.status}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const meUrl = new URL("https://graph.facebook.com/me");
  meUrl.searchParams.set("fields", "id,name,email,picture.type(large)");
  meUrl.searchParams.set("access_token", access_token);
  const meRes = await fetch(meUrl);
  if (!meRes.ok) throw new Error(`facebook me ${meRes.status}`);
  const f = (await meRes.json()) as { id: string; name?: string; email?: string; picture?: { data?: { url?: string } } };
  return { provider, providerId: f.id, displayName: f.name, email: f.email, avatarUrl: f.picture?.data?.url };
}

export async function finishOAuth(req: NextRequest, provider: AuthProvider): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;
  const state = readState(params.get("state"));
  if (!state || state.p !== provider) return redirectWith(req, "/", { auth_error: "invalid_state" });

  const next = safeNext(state.next);
  if (params.get("error")) return redirectWith(req, next, { auth_error: "cancelled" });

  // cookie หาย (เช่น LINE สลับไปเปิดแอปแล้วกลับเข้าคนละเบราว์เซอร์) ยอมเฉพาะการล็อกอินธรรมดา
  const nonceCookie = req.cookies.get(NONCE_COOKIE)?.value;
  if (nonceCookie ? nonceCookie !== state.n : state.m === "link") {
    return redirectWith(req, next, { auth_error: "invalid_state" });
  }
  // ผูกบัญชีได้เฉพาะคนเดียวกับที่กดเชื่อม
  if (state.m === "link" && currentSessionUserId(req) !== state.uid) {
    return redirectWith(req, next, { auth_error: "login_required" });
  }

  const creds = credentialsFor(provider);
  const code = params.get("code");
  if (!creds || !code) return redirectWith(req, next, { auth_error: `${provider}_not_configured` });

  let profile: IdentityProfile & { lineFriend?: boolean };
  try {
    profile = await fetchProfile(provider, code, callbackUrl(req, provider), creds);
  } catch (err) {
    console.error(`[oauth] ${provider} profile failed`, err);
    return redirectWith(req, next, { auth_error: `${provider}_failed` });
  }

  const result = await signInWithIdentity(profile, state.m === "link" ? state.uid : undefined);
  if (!result.ok) return redirectWith(req, next, { auth_error: "link_conflict", auth_message: result.error });

  const res = redirectWith(req, next, {
    [state.m === "link" ? "linked" : "login"]: provider,
    ...(profile.lineFriend === false ? { line_friend: "0" } : {}),
  });
  res.cookies.set(USER_COOKIE_NAME, createSessionToken(toSafeUser(result.user)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
