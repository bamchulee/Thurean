// ลูกค้าเห็นได้เฉพาะออเดอร์ที่ผูกกับบัญชีตัวเอง (รหัสสมาชิก หรือ LINE ที่ยืนยันแล้ว)
// ไม่จับคู่ด้วยเบอร์โทร: เบอร์ในโปรไฟล์แก้เองได้ ถ้าใช้จับคู่จะส่องออเดอร์คนอื่นได้
import type { Order, User } from "../types/durian";

export function isOwnOrder(order: Order, user: Pick<User, "id" | "lineUserId">): boolean {
  return Boolean(
    (order.userId && order.userId === user.id) ||
      (user.lineUserId && order.lineUserId && order.lineUserId === user.lineUserId)
  );
}
