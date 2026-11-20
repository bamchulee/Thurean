// ============================================================
// บัญชีสมาชิก 1 คน = 1 แถวในชีต Users ผูกช่องทางเข้าสู่ระบบได้หลายทาง (LINE / Google)
// - เข้าครั้งแรกด้วยช่องทางไหน สร้างแถวใหม่ด้วยช่องทางนั้น
// - กด "เชื่อม" ช่องทางอื่นตอนล็อกอินอยู่ = เพิ่มรหัสช่องทางนั้นลงแถวเดิม
// - เชื่อม LINE แล้วเจอว่า LINE นี้มีแถวอยู่แล้ว (เคยคุยกับบอท/สั่งผ่าน LINE) → รวมเข้าแถวของ LINE
//   เพราะออเดอร์และแชททั้งหมดผูกกับแถวนั้น แถวเดิมปิดใช้งาน
// ============================================================
import {
  createUserRecord,
  getAllDatabase,
  getRuntimeConfig,
  localNextId,
  updateUserRecord,
  upsertLineUser,
} from "./sheets-db";
import type { User } from "../types/durian";

export type AuthProvider = "line" | "google";

export const AUTH_PROVIDERS: AuthProvider[] = ["line", "google"];

export const PROVIDER_LABEL: Record<AuthProvider, string> = {
  line: "LINE",
  google: "Google",
};

const ID_FIELD = { line: "lineUserId", google: "googleId" } as const;

export interface IdentityProfile {
  provider: AuthProvider;
  providerId: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
}

export type SignInResult = { ok: true; user: User; merged?: boolean } | { ok: false; error: string };

const ROLE_RANK: Record<string, number> = { user: 0, staff: 1, admin: 2 };

export function identityOf(user: Partial<User>, provider: AuthProvider): string {
  return String(user[ID_FIELD[provider]] || "").trim();
}

/** ช่องทางที่บัญชีนี้ผูกไว้จริง (ดูจากรหัสแต่ละช่องทาง) */
export function linkedProviders(user: Partial<User>): AuthProvider[] {
  return AUTH_PROVIDERS.filter((p) => identityOf(user, p));
}

function isActiveUser(u: User): boolean {
  return u.isActive !== 0 && (u.isActive as unknown) !== "0" && u.isActive !== false;
}

/** อ่านสดจากชีต — การผูก/รวมบัญชีต้องเห็นข้อมูลล่าสุดเสมอ */
async function freshUsers(): Promise<User[]> {
  const { data } = await getAllDatabase(true);
  return data.users || [];
}

export async function findUserByIdentity(provider: AuthProvider, providerId: string): Promise<User | undefined> {
  const id = providerId.trim();
  if (!id) return undefined;
  return (await freshUsers()).find((u) => isActiveUser(u) && identityOf(u, provider) === id);
}

function splitName(name: string): { firstName: string; lastName: string } {
  const clean = name.trim().replace(/^(คุณ|นาย|นางสาว|นาง)\s*/, "");
  const [firstName, ...rest] = clean.split(/\s+/);
  return { firstName: firstName || clean, lastName: rest.join(" ") };
}

function providersCsv(user: Partial<User>, extra?: AuthProvider): string {
  const set = new Set<AuthProvider>(linkedProviders(user));
  if (extra) set.add(extra);
  return AUTH_PROVIDERS.filter((p) => set.has(p)).join(",");
}

/** ข้อมูลโปรไฟล์ที่เติมได้เมื่อแถวยังว่าง (ไม่ทับของที่ลูกค้ากรอกเอง) */
function fillBlanks(target: Partial<User>, profile: IdentityProfile): Partial<User> {
  const updates: Partial<User> = {};
  if (profile.email && !target.email) updates.email = profile.email;
  if (profile.avatarUrl && !target.avatarUrl) updates.avatarUrl = profile.avatarUrl;
  if (profile.displayName && !target.displayName) updates.displayName = profile.displayName;
  if (profile.displayName && !target.firstName) Object.assign(updates, splitName(profile.displayName));
  return updates;
}

async function createFromIdentity(profile: IdentityProfile): Promise<User> {
  if (profile.provider === "line") {
    const user = await upsertLineUser({
      lineUserId: profile.providerId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      source: "line-login",
    });
    const updated = await updateUserRecord(user.id, { loginProviders: providersCsv(user, "line"), lastLoginAt: new Date().toISOString() });
    return updated || user;
  }
  const users = await freshUsers();
  const id = localNextId("users", users.map((u) => u.id));
  const now = new Date().toISOString();
  const name = profile.displayName || PROVIDER_LABEL[profile.provider];
  return createUserRecord({
    id,
    userId: id,
    username: `${profile.provider}_${profile.providerId}`,
    displayName: name,
    ...splitName(name),
    email: profile.email,
    avatarUrl: profile.avatarUrl,
    [ID_FIELD[profile.provider]]: profile.providerId,
    loginProviders: profile.provider,
    phone: "",
    address: "",
    postalCode: "",
    role: "user",
    source: profile.provider,
    lastLoginAt: now,
    isActive: 1,
    createDate: now,
    createdAt: now,
    createdBy: profile.provider,
    updatedAt: now,
    updatedBy: profile.provider,
  });
}

/**
 * เข้าสู่ระบบ / ผูกช่องทาง
 * @param linkToUserId ส่งมาเมื่อผู้ใช้ล็อกอินอยู่แล้วและกด "เชื่อม" ช่องทางนี้
 */
export async function signInWithIdentity(profile: IdentityProfile, linkToUserId?: string): Promise<SignInResult> {
  const now = new Date().toISOString();
  const owner = await findUserByIdentity(profile.provider, profile.providerId);

  if (!linkToUserId) {
    if (!owner) return { ok: true, user: await createFromIdentity(profile) };
    const updates: Partial<User> = {
      ...fillBlanks(owner, profile),
      loginProviders: providersCsv(owner, profile.provider),
      lastLoginAt: now,
    };
    // LINE ที่ผูกเป็นแอดมินหลักไว้ (LINE_ADMIN_USER_ID / พิมพ์ /admin <PIN> กับบอท) ได้สิทธิ์เจ้าของร้าน
    const adminLineId = getRuntimeConfig().lineAdminUserId;
    if (profile.provider === "line" && adminLineId && adminLineId === profile.providerId && owner.role !== "admin" && owner.role !== "superadmin") {
      updates.role = "admin";
    }
    return { ok: true, user: (await updateUserRecord(owner.id, updates)) || { ...owner, ...updates } };
  }

  const current = (await freshUsers()).find((u) => u.id === linkToUserId);
  if (!current || !isActiveUser(current)) return { ok: false, error: "ไม่พบบัญชีที่ล็อกอินอยู่ กรุณาเข้าสู่ระบบใหม่" };

  // ช่องทางนี้ผูกกับบัญชีนี้อยู่แล้ว
  if (owner && owner.id === current.id) return { ok: true, user: current };

  if (owner) {
    // เชื่อม LINE ที่มีบัญชีอยู่แล้ว (เคยสั่ง/คุยผ่าน LINE) → รวมเข้าบัญชี LINE
    if (profile.provider !== "line") {
      return { ok: false, error: `${PROVIDER_LABEL[profile.provider]} นี้ผูกกับสมาชิกคนอื่นแล้ว` };
    }
    const fromCurrent: Partial<User> = {};
    for (const p of AUTH_PROVIDERS) {
      if (p !== "line" && identityOf(current, p) && !identityOf(owner, p)) fromCurrent[ID_FIELD[p]] = identityOf(current, p);
    }
    for (const key of ["email", "phone", "address", "postalCode", "mapsUrl", "avatarUrl", "firstName", "lastName"] as const) {
      if (current[key] && !owner[key]) (fromCurrent as Record<string, unknown>)[key] = current[key];
    }
    const role = (ROLE_RANK[current.role] || 0) > (ROLE_RANK[owner.role] || 0) ? current.role : owner.role;
    const mergedFields = { ...owner, ...fromCurrent };
    const updates: Partial<User> = {
      ...fromCurrent,
      role,
      loginProviders: providersCsv(mergedFields, "line"),
      lastLoginAt: now,
    };
    const merged = (await updateUserRecord(owner.id, updates)) || { ...owner, ...updates };
    // ปิดบัญชีเดิม และถอดรหัสช่องทางออก ไม่ให้ล็อกอินซ้อนเข้าแถวเก่า
    await updateUserRecord(current.id, {
      isActive: 0,
      googleId: "",
      notes: `รวมเข้ากับบัญชี ${owner.id} เมื่อ ${now}`,
    });
    return { ok: true, user: merged, merged: true };
  }

  if (identityOf(current, profile.provider)) {
    return { ok: false, error: `บัญชีนี้ผูก ${PROVIDER_LABEL[profile.provider]} อื่นไว้แล้ว` };
  }
  const updates: Partial<User> = {
    [ID_FIELD[profile.provider]]: profile.providerId,
    ...fillBlanks(current, profile),
    loginProviders: providersCsv(current, profile.provider),
    lastLoginAt: now,
  };
  return { ok: true, user: (await updateUserRecord(current.id, updates)) || { ...current, ...updates } };
}
