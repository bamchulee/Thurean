// ============================================================
// สิทธิ์ผู้ใช้ 3 ระดับ (ตรวจจากชีต Users ทุกครั้ง — ปลดสิทธิ์ใครแล้วมีผลทันทีไม่ต้องรอ cookie หมดอายุ)
//   user  = ลูกค้า: เห็นเฉพาะออเดอร์/ข้อมูลของตัวเอง
//   staff = พนักงาน: ดูออเดอร์ทั้งหมด ชั่ง ยืนยันสลิป จัดส่ง ยกเลิก เคลม (ไม่เห็นต้นทุน ยอดขาย ตั้งค่า สมาชิก)
//   admin = เจ้าของร้าน: ทุกอย่าง + กำหนดสิทธิ์คนอื่น
// ทุกคนเข้าระบบด้วย LINE / Google / Facebook (ไม่มี PIN / รหัสผ่าน)
// ============================================================
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAllDatabase } from "./sheets-db";
import { verifySessionToken } from "./user-auth";
import type { SafeUser, User } from "../types/durian";

export const USER_COOKIE_NAME = "winkin_user_token";
/** cookie รุ่นเก่า (PIN / admin token) — ไม่ใช้แล้ว ลบทิ้งตอนออกจากระบบ */
export const ADMIN_COOKIE_NAME = "winkin_admin_token";

export type StaffRole = "staff" | "admin";

export function getSessionFromRequest(req: NextRequest): SafeUser | null {
  const token = req.cookies.get(USER_COOKIE_NAME)?.value;
  return token ? verifySessionToken(token) : null;
}

/** ข้อมูลสมาชิกล่าสุดของคนที่ล็อกอินอยู่ (แคชชีตไม่เกิน ~5 นาที) — บัญชีที่ถูกปิด = ไม่ได้ล็อกอิน */
export async function getCurrentUser(req: NextRequest): Promise<User | null> {
  const session = getSessionFromRequest(req);
  if (!session?.id) return null;
  const { data } = await getAllDatabase();
  const user = (data.users || []).find((u) => u.id === session.id || u.userId === session.id);
  if (!user || user.isActive === 0 || (user.isActive as unknown) === "0" || user.isActive === false) return null;
  return user;
}

export async function getStaffRole(req: NextRequest): Promise<StaffRole | null> {
  const user = await getCurrentUser(req);
  return user?.role === "admin" || user?.role === "staff" ? user.role : null;
}

/** พนักงานหรือเจ้าของร้าน */
export async function requireStaff(req: NextRequest): Promise<boolean> {
  return (await getStaffRole(req)) !== null;
}

/** เจ้าของร้านเท่านั้น */
export async function requireAdmin(req: NextRequest): Promise<boolean> {
  return (await getStaffRole(req)) === "admin";
}

export function getAdminOperatorName(req: NextRequest): string {
  const session = getSessionFromRequest(req);
  if (!session) return "admin";
  const name =
    session.displayName ||
    (session.firstName ? `${session.firstName} ${session.lastName || ""}`.trim() : "") ||
    session.username;
  return name || `Admin (${session.id})`;
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { ok: false, error: "Unauthorized — ไม่มีสิทธิ์เข้าถึงส่วนนี้" },
    { status: 401 }
  );
}
