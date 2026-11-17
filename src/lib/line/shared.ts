// ค่าคงที่และตัวช่วยที่ใช้ร่วมกัน (รูปสำรอง, ปุ่มลัดเมนูหลัก)

const FALLBACK_FLEX_IMAGE =
  "https://images.unsplash.com/photo-1519544442-93857b48665e?auto=format&fit=crop&w=800&q=80";

export function safeHttpsImage(url?: string): string {
  return url && url.startsWith("https://") ? url : FALLBACK_FLEX_IMAGE;
}

export function buildMainQuickReply() {
  return {
    items: [
      {
        type: "action",
        action: { type: "message", label: "สั่งซื้อทุเรียน", text: "สั่งซื้อ" },
      },
      {
        type: "action",
        action: { type: "message", label: "เช็กสต็อก", text: "เช็กสต็อก" },
      },
      {
        type: "action",
        action: { type: "message", label: "💬 คุยกับแอดมิน", text: "คุยกับแอดมิน" },
      },
      {
        type: "action",
        action: { type: "message", label: "📍 ที่อยู่จัดส่ง", text: "ที่อยู่" },
      },
      {
        type: "action",
        action: { type: "location", label: "🗺️ ปักหมุดแผนที่" },
      },
      {
        type: "action",
        action: { type: "message", label: "เช็กโปรโมชั่น", text: "โปรโมชั่น" },
      },
      {
        type: "action",
        action: { type: "message", label: "ดูไลฟ์สด", text: "ดูไลฟ์สด" },
      },
      {
        type: "action",
        action: { type: "message", label: "แจ้งเคลม", text: "แจ้งเคลม" },
      },
      {
        type: "action",
        action: { type: "message", label: "เพิ่มเติม", text: "เพิ่มเติม" },
      },
    ],
  };
}
