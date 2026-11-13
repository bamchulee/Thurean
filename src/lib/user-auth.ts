import crypto from "crypto";
import type { SafeUser, User } from "../types/durian";

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.ADMIN_SECRET ||
  "winkin-durian-user-secret-salt-2026";

/**
 * Hash password with scrypt and random 16-byte salt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify plaintext password against stored salt:hash
 */
export function verifyPassword(password: string, stored: string): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, originalHash] = stored.split(":");
  if (!salt || !originalHash) return false;
  try {
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    const bufA = Buffer.from(hash, "hex");
    const bufB = Buffer.from(originalHash, "hex");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Create a signed, stateless session token
 */
export function createSessionToken(user: SafeUser): string {
  const payload = JSON.stringify({
    id: user.id,
    username: user.username,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 days
  });
  const hmac = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  const b64Payload = Buffer.from(payload, "utf-8").toString("base64url");
  return `${b64Payload}.${hmac}`;
}

/**
 * Verify session token and return user metadata if valid
 */
export function verifySessionToken(
  token: string
): { id: string; username: string; role: "user" | "admin" } | null {
  if (!token || !token.includes(".")) return null;
  const [b64Payload, hmac] = token.split(".");
  if (!b64Payload || !hmac) return null;

  try {
    const payloadStr = Buffer.from(b64Payload, "base64url").toString("utf-8");
    const expectedHmac = crypto
      .createHmac("sha256", SESSION_SECRET)
      .update(payloadStr)
      .digest("base64url");

    if (hmac !== expectedHmac) return null;

    const data = JSON.parse(payloadStr);
    if (!data.id || !data.username) return null;
    if (data.exp && Date.now() > data.exp) return null; // expired

    return {
      id: data.id,
      username: data.username,
      role: data.role || "user",
    };
  } catch {
    return null;
  }
}

/**
 * Strip passwordHash before sending to client
 */
export function toSafeUser(user: User): SafeUser {
  const { passwordHash: _pwd, ...safe } = user;
  return safe;
}
