// ============================================================
// Mock Data – จำลองข้อมูลที่จะดึงจาก Google Sheets ในอนาคต
// ============================================================

// ---------- สินค้าทุเรียน (แท็บ Products) ----------
export interface Product {
  id: string;
  name: string;
  variety: string;        // สายพันธุ์
  type: "whole" | "flesh"; // เหมาลูก / แกะเนื้อ
  ripeness: string;
  weight: string;          // น้ำหนักโดยประมาณ
  price: number;
  unit: string;
  image: string;
  badge?: string;          // NEW / HOT / SOLD OUT
  isAvailable: boolean;
  description: string;
}

export const products: Product[] = [
  {
    id: "D01",
    name: "หมอนทอง ระยอง เกรดพรีเมียม",
    variety: "หมอนทอง",
    type: "whole",
    ripeness: "สุกพอดี กรอบนอกนุ่มใน",
    weight: "3-4 กก.",
    price: 590,
    unit: "ลูก",
    image: "/images/monthong.jpg",
    badge: "HOT",
    isAvailable: true,
    description: "หมอนทองระยองแท้ คัดเกรดพรีเมียม เนื้อหนา เมล็ดลีบ หวานมัน ส่งตรงจากสวนคุณภาพ",
  },
  {
    id: "D02",
    name: "หมอนทอง แกะเนื้อพร้อมทาน 1 กก.",
    variety: "หมอนทอง",
    type: "flesh",
    ripeness: "สุกพอดี เนื้อเนียน",
    weight: "1 กก.",
    price: 350,
    unit: "กล่อง",
    image: "/images/flesh-box.jpg",
    badge: "NEW",
    isAvailable: true,
    description: "แกะเนื้อสดใหม่ คัดเฉพาะพูสวย แพ็กแช่เย็น พร้อมทานทันที เหมาะส่งของขวัญ",
  },
  {
    id: "D03",
    name: "ก้านยาว จันทบุรี",
    variety: "ก้านยาว",
    type: "whole",
    ripeness: "กรอบนอกนุ่มใน",
    weight: "2-3 กก.",
    price: 490,
    unit: "ลูก",
    image: "/images/kanyao.jpg",
    isAvailable: true,
    description: "ก้านยาวจันทบุรีแท้ เนื้อเหนียวละเอียด รสชาติหวานอมขม กลิ่นเบา ๆ ถูกใจคนรักทุเรียน",
  },
  {
    id: "D04",
    name: "พวงมณี นนทบุรี",
    variety: "พวงมณี",
    type: "whole",
    ripeness: "สุกเต็มที่",
    weight: "1.5-2.5 กก.",
    price: 890,
    unit: "ลูก",
    image: "/images/puangmanee.jpg",
    badge: "RARE",
    isAvailable: true,
    description: "ทุเรียนสายพันธุ์โบราณหายาก เนื้อละเอียดเป็นครีม หวานลึก กลิ่นเบา สายพันธุ์ที่ต้องลอง!",
  },
  {
    id: "D05",
    name: "มูซานคิง มาเลเซีย (นำเข้า)",
    variety: "มูซานคิง",
    type: "whole",
    ripeness: "สุกพอดี",
    weight: "1.5-2 กก.",
    price: 1290,
    unit: "ลูก",
    image: "/images/musangking.jpg",
    badge: "PREMIUM",
    isAvailable: false,
    description: "ราชาทุเรียนมาเลเซีย เนื้อสีเหลืองเข้มเหมือนคัสตาร์ด หวานขมกลมกล่อม (รอบถัดไปเร็ว ๆ นี้)",
  },
  {
    id: "D06",
    name: "ชะนี คัดพิเศษ",
    variety: "ชะนี",
    type: "whole",
    ripeness: "กรอบนอกนุ่มใน",
    weight: "2-3 กก.",
    price: 390,
    unit: "ลูก",
    image: "/images/chanee.jpg",
    isAvailable: true,
    description: "ชะนีเนื้อหนา รสหวาน กลิ่นเข้มข้น ราคาเข้าถึงง่าย เป็นทุเรียนที่คนไทยรู้จักดีที่สุด",
  },
];

// ---------- รอบเปิดขาย (แท็บ Rounds) ----------
export interface Round {
  id: string;
  name: string;
  closeDate: string;     // วันปิดรับจอง
  deliveryDate: string;  // วันส่งของ
  status: "open" | "closed" | "shipping" | "done";
}

export const currentRound: Round = {
  id: "R2026-11-A",
  name: "รอบส่งวันศุกร์ที่ 14 พ.ย. 2569",
  closeDate: "2026-11-12",
  deliveryDate: "2026-11-14",
  status: "open",
};

// ---------- ข้อมูลร้าน ----------
export const shopInfo = {
  name: "ทุเรียนบ้านสวน",
  tagline: "ทุเรียนคัดคุณภาพ ส่งตรงถึงบ้าน",
  description: "เราคัดสรรทุเรียนจากล้งและสวนคุณภาพทั่วภาคตะวันออก ส่งตรงถึงบ้านคุณ สด อร่อย การันตีคุณภาพทุกลูก!",
  phone: "08X-XXX-XXXX",
  lineOA: "@durian-bansuan",
  bankAccount: {
    bank: "กสิกรไทย",
    number: "XXX-X-XXXXX-X",
    name: "บจก. ทุเรียนบ้านสวน",
  },
  shippingMethods: [
    { name: "Flash Express (ส่งด่วน 1-2 วัน)", price: 80 },
    { name: "Kerry Express", price: 70 },
    { name: "ไปรษณีย์ไทย EMS", price: 60 },
    { name: "รับเอง (นัดรับสินค้า)", price: 0 },
  ],
};

// ---------- สถานะออเดอร์ตัวอย่าง (แท็บ Orders) ----------
export interface Order {
  id: string;
  createdAt: string;
  roundId: string;
  customerName: string;
  phone: string;
  items: { productId: string; productName: string; qty: number; price: number }[];
  totalPrice: number;
  shippingMethod: string;
  shippingCost: number;
  paymentStatus: "pending" | "confirmed" | "refunded";
  orderStatus: "received" | "preparing" | "packed" | "shipped" | "delivered" | "claimed";
  trackingNo?: string;
}

export const sampleOrders: Order[] = [
  {
    id: "ORD-1001",
    createdAt: "2026-11-09T10:30:00",
    roundId: "R2026-11-A",
    customerName: "คุณสมชาย",
    phone: "081-234-5678",
    items: [
      { productId: "D01", productName: "หมอนทอง ระยอง เกรดพรีเมียม", qty: 2, price: 590 },
      { productId: "D02", productName: "หมอนทอง แกะเนื้อพร้อมทาน 1 กก.", qty: 1, price: 350 },
    ],
    totalPrice: 1530,
    shippingMethod: "Flash Express (ส่งด่วน 1-2 วัน)",
    shippingCost: 80,
    paymentStatus: "confirmed",
    orderStatus: "preparing",
  },
];
