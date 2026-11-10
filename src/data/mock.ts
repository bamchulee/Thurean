// ============================================================
// Data Model & Mock Data: ร้าน "ทุเรียนวินคิน" (082-282-4238)
// ============================================================

export interface Product {
  id: string;
  name: string;
  variety: string;
  type: "whole" | "flesh";
  ripeness: string;
  weight: string;
  price: number;
  marketPrice?: number;
  unit: string;
  origin: string;
  brix: string;
  image: string;
  badge?: string;
  isAvailable: boolean;
  description: string;
  specs: {
    maturity: string;
    texture: string;
    flavor: string;
  };
}

export const shopInfo = {
  name: "ทุเรียนวินคิน",
  englishName: "WINKIN DURIAN",
  logo: "/logo.jpg",
  tagline: "คัดสดจากสวน วิ่งรถกระบะส่งตรงถึงบ้านคุณ การันตีเคลม 100%",
  description: "ทุเรียนวินคิน คัดสรรทุเรียนคุณภาพเยี่ยม วิ่งรับตรงจากสวนระยองและจันทบุรี คัดเฉพาะผลแก่จัด 85%+ ไม่ป้ายยาเร่งสุก บริการส่งด่วนถึงหน้าบ้าน รับประกันเนื้อทุกลูก พบปัญหาเปลี่ยนใหม่หรือคืนเงินทันที",
  phone: "082-282-4238",
  phoneFormatted: "082-282-4238",
  lineOA: "@durianwinkin",
  bankAccount: {
    bank: "ธนาคารกสิกรไทย (KBANK)",
    number: "082-2-82423-8",
    name: "ร้านทุเรียนวินคิน",
    promptPay: "082-282-4238",
  },
  shippingMethods: [
    { name: "รถกระบะ / รถห้องเย็นส่งด่วน (คุมความเย็น 4°C)", price: 120, note: "รักษาความสด ไม่คายน้ำ แนะนำสำหรับเนื้อแกะ" },
    { name: "Flash Express พัสดุด่วน กล่องล็อกขั้วเจาะรู", price: 80, note: "ส่งด่วน 1-2 วัน สำหรับทุเรียนทั้งลูก" },
    { name: "นัดรับสินค้าหน้าร้าน / จุดนัดพบ", price: 0, note: "ไม่มีค่าใช้จ่าย" },
  ],
};

export const products: Product[] = [
  {
    id: "WK-01",
    name: "หมอนทองระยอง คัดเกรดพรีเมียม A+",
    variety: "หมอนทอง",
    type: "whole",
    ripeness: "กรอบนอกนุ่มใน (ไก่ฉีก)",
    weight: "3.5 - 4.0 กก.",
    price: 890,
    marketPrice: 1050,
    unit: "ลูก",
    origin: "สวนระยองแท้ (วิ่งรับตรงจากสวน)",
    brix: "32° - 34° Brix",
    image: "https://images.unsplash.com/photo-1519544442-93857b48665e?auto=format&fit=crop&w=800&q=80",
    badge: "ยอดนิยม",
    isAvailable: true,
    description: "หมอนทองคัดผลแก่จัด 85%+ เปลือกบาง หนามแห้ง ทรงสวย พูใหญ่ เนื้อสีเหลืองทองเนียนละเอียด หวานมันกลมกล่อม เม็ดลีบ",
    specs: {
      maturity: "แก่จัด 85%+",
      texture: "กรอบนอก นุ่มใน เนื้อไก่ฉีก ไม่เละ",
      flavor: "หวานมันเข้มข้น หอมละมุน",
    },
  },
  {
    id: "WK-02",
    name: "หมอนทองแกะเนื้อพร้อมทาน 1,000 กรัม",
    variety: "หมอนทอง",
    type: "flesh",
    ripeness: "สุกพอดีกิน (เนื้อเนียนครีม)",
    weight: "1 กก. (เนื้อล้วนไม่รวมเปลือก)",
    price: 790,
    marketPrice: 950,
    unit: "กล่อง",
    origin: "สวนจันทบุรี คัดเกรดพรีเมียม",
    brix: "33° Brix",
    image: "https://images.unsplash.com/photo-1587132137056-bfbf0166836e?auto=format&fit=crop&w=800&q=80",
    badge: "พร้อมทาน",
    isAvailable: true,
    description: "แกะสดใหม่วันต่อวัน คัดเฉพาะพูใหญ่เกรดสวย แพ็กใส่กล่องล็อกสุญญากาศอย่างดี ส่งรถเย็นถึงบ้านพร้อมเปิดทานทันที",
    specs: {
      maturity: "สุกธรรมชาติ 100%",
      texture: "เนียนนุ่ม สัมผัสเหมือนคัสตาร์ด",
      flavor: "หวานมันจัดเต็ม อร่อยถูกใจ",
    },
  },
  {
    id: "WK-03",
    name: "ก้านยาวจันทบุรี คัดพิเศษต้นเก่าแก่",
    variety: "ก้านยาว",
    type: "whole",
    ripeness: "กรอบนอกนุ่มใน",
    weight: "2.5 - 3.2 กก.",
    price: 1390,
    marketPrice: 1650,
    unit: "ลูก",
    origin: "สวนจันทบุรี ดั้งเดิม",
    brix: "34° - 36° Brix",
    image: "https://images.unsplash.com/photo-1546548970-71785318a17b?auto=format&fit=crop&w=800&q=80",
    badge: "หายาก",
    isAvailable: true,
    description: "ก้านยาวแท้ ก้านใหญ่สมบูรณ์ เนื้อเนียนละเอียด ไร้เสี้ยน กลิ่นหอมสะอาด รสชาติหวานมันลึก สำหรับคนรักก้านยาวตัวจริง",
    specs: {
      maturity: "แก่จัด 88%",
      texture: "เนื้อเนียนละเอียด ละมุนลิ้น",
      flavor: "หวานมันนำ กลิ่นหอมเป็นเอกลักษณ์",
    },
  },
  {
    id: "WK-04",
    name: "พวงมณี ระยอง คัดเนื้อเข้มหวานจัด",
    variety: "พวงมณี",
    type: "whole",
    ripeness: "สุกพอดีกิน",
    weight: "1.8 - 2.4 กก.",
    price: 650,
    marketPrice: 790,
    unit: "ลูก",
    origin: "สวนระยอง",
    brix: "35° Brix",
    image: "https://images.unsplash.com/photo-1579613832125-5d34a13ffe0a?auto=format&fit=crop&w=800&q=80",
    badge: "หวานจัด",
    isAvailable: true,
    description: "พวงมณีแท้ เม็ดเล็ก เนื้อสีเหลืองจำปาเข้ม รสหวานฉ่ำสะใจ คนชอบทุเรียนหวานเข้มข้นต้องไม่พลาด",
    specs: {
      maturity: "แก่จัด 85%",
      texture: "เนื้อนุ่มละเอียด เม็ดเล็กลีบ",
      flavor: "หวานจัดจ้าน ละมุนลิ้น",
    },
  },
  {
    id: "WK-05",
    name: "ชะนีไข่ระยอง สดจากสวน",
    variety: "ชะนี",
    type: "whole",
    ripeness: "เนื้อสุกพอดี (ไม่เละ)",
    weight: "2.5 - 3.0 กก.",
    price: 550,
    marketPrice: 690,
    unit: "ลูก",
    origin: "สวนระยอง",
    brix: "33° Brix",
    image: "https://images.unsplash.com/photo-1519544442-93857b48665e?auto=format&fit=crop&w=800&q=80",
    isAvailable: true,
    description: "ชะนีไข่เนื้อเหลืองทอง กลิ่นหอมเข้ม รสชาติหวานมันลึกสไตล์ทุเรียนแท้ดั้งเดิม คัดเนื้อไม่ให้เละ",
    specs: {
      maturity: "แก่จัด 85%",
      texture: "เหนียวหนึบ รสเข้ม",
      flavor: "หวานมันลึก หอมดั้งเดิม",
    },
  },
  {
    id: "WK-06",
    name: "มูซานคิง คัดพิเศษ (รอบส่งจำกัด)",
    variety: "มูซานคิง",
    type: "whole",
    ripeness: "สุกหล่นธรรมชาติ",
    weight: "1.8 - 2.2 กก.",
    price: 1790,
    marketPrice: 2100,
    unit: "ลูก",
    origin: "เบตง จ.ยะลา",
    brix: "36° Brix",
    image: "https://images.unsplash.com/photo-1552623770-3881998abc5f?auto=format&fit=crop&w=800&q=80",
    badge: "นำเข้าพิเศษ",
    isAvailable: true,
    description: "มูซานคิงแท้ เนื้อสีทองเข้ม เนื้อเนียนนุ่มละลายในปาก รสชาติหวานมันซับซ้อน อมขมปลายลิ้นนิดๆ",
    specs: {
      maturity: "สุกธรรมชาติ 100%",
      texture: "เนื้อเนียนละเอียด ละลายในปาก",
      flavor: "หวานมันเข้มข้น อมขมปลาย",
    },
  },
];

export interface Round {
  id: string;
  name: string;
  truckRoute: string;       // สายวิ่งรถกระบะรับของ
  harvestDate: string;
  closeDate: string;
  deliveryDate: string;
  status: "open" | "closed" | "shipping" | "done";
  quotaRemaining: number;
  totalQuota: number;
}

export const currentRound: Round = {
  id: "WK-ROUND-46",
  name: "รอบรถกระบะวิ่งรับตรงจากสวนระยอง-จันทบุรี",
  truckRoute: "สายวิ่ง: ระยอง (แกลง) → จันทบุรี (ท่าใหม่) → ส่งตรงถึงบ้านคุณ",
  harvestDate: "ศุกร์ที่ 14 พฤศจิกายน 2569",
  closeDate: "2026-11-13T20:00:00",
  deliveryDate: "15 - 16 พฤศจิกายน 2569",
  status: "open",
  quotaRemaining: 34,
  totalQuota: 120,
};

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
    id: "WK-9521",
    createdAt: "2026-11-10T14:30:00",
    roundId: "WK-ROUND-46",
    customerName: "คุณกฤษฎา วัฒนกุล",
    phone: "081-892-XXXX",
    items: [
      { productId: "WK-01", productName: "หมอนทองระยอง คัดเกรดพรีเมียม A+", qty: 1, price: 890 },
      { productId: "WK-02", productName: "หมอนทองแกะเนื้อพร้อมทาน 1,000 กรัม", qty: 1, price: 790 },
    ],
    totalPrice: 1680,
    shippingMethod: "รถกระบะ / รถห้องเย็นส่งด่วน (คุมความเย็น 4°C)",
    shippingCost: 120,
    paymentStatus: "confirmed",
    orderStatus: "preparing",
  },
];
