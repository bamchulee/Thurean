import { after } from "next/server";

/**
 * ให้งานเบื้องหลังทำต่อจนจบหลังตอบผู้ใช้แล้ว (Vercel จะไม่หยุดฟังก์ชันกลางคัน)
 * นอกคำขอ (สคริปต์/เทสต์) ก็ปล่อยให้ promise วิ่งไปตามปกติ
 */
export function keepAlive(task: Promise<unknown>): void {
  try {
    after(() => task.catch(() => {}));
  } catch {
    // ไม่ได้อยู่ในคำขอ — งานวิ่งอยู่แล้ว ไม่ต้องทำอะไร
  }
}

/** เริ่มงานทันทีโดยไม่ให้ผู้ใช้รอ (เช่น ส่ง LINE แจ้งเตือน) — error แค่ log ไม่ทำให้คำขอล้ม */
export function runInBackground(label: string, task: () => Promise<unknown>): void {
  const p = task().catch((err) => console.warn(`[background] ${label} failed:`, err));
  keepAlive(p);
}
