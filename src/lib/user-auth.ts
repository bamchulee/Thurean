import crypto from "crypto";
import type { SafeUser, User } from "../types/durian";

import { getSigningSecret } from "./secrets";

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
    userId: (user as any).userId || user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    address: user.address,
    postalCode: user.postalCode,
    avatarUrl: user.avatarUrl,
    lineUserId: user.lineUserId,
    source: user.source,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 days
  });
  const hmac = crypto
    .createHmac("sha256", getSigningSecret())
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
): SafeUser | null {
  if (!token || !token.includes(".")) return null;
  const [b64Payload, hmac] = token.split(".");
  if (!b64Payload || !hmac) return null;

  try {
    const payloadStr = Buffer.from(b64Payload, "base64url").toString("utf-8");
    const expectedHmac = crypto
      .createHmac("sha256", getSigningSecret())
      .update(payloadStr)
      .digest("base64url");

    const a = Buffer.from(hmac);
    const b = Buffer.from(expectedHmac);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const data = JSON.parse(payloadStr);
    if (!data.id) return null;
    if (data.exp && Date.now() > data.exp) return null; // expired

    return {
      id: data.id,
      userId: data.userId || data.id,
      username: data.username || data.id,
      displayName: data.displayName,
      role: data.role || "user",
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      phone: data.phone || "",
      address: data.address || "",
      postalCode: data.postalCode || "",
      avatarUrl: data.avatarUrl,
      lineUserId: data.lineUserId,
      source: data.source,
      createdAt: data.createdAt || "",
      updatedAt: data.updatedAt || "",
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
