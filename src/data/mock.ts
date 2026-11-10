// ============================================================
// Seed / Initial Data: ร้าน "ทุเรียนวินคิน" (082-282-4238)
// ============================================================
import type {
  Product,
  Round,
  Order,
  LotCost,
  Claim,
  Promotion,
  DatabaseState,
} from "../types/durian";

export type { Product, Round, Order, LotCost, Claim, Promotion, DatabaseState };

export const shopInfo = {
  name: "ทุเรียนวินคิน",
  englishName: "WINKIN DURIAN",
  logo: "/logo.jpg",
  tagline: "คัดสดจากสวน วิ่งรถกระบะส่งตรงถึงบ้านคุณ การันตีเคลม 100%",
  description:
    "ทุเรียนวินคิน คัดสรรทุเรียนคุณภาพเยี่ยม วิ่งรับตรงจากสวนระยองและจันทบุรี คัดเฉพาะผลแก่จัด 85%+ ไม่ป้ายยาเร่งสุก บริการส่งด่วนถึงหน้าบ้าน รับประกันเนื้อทุกลูก พบปัญหาเปลี่ยนใหม่หรือคืนเงินทันที",
  phone: "082-282-4238",
  phoneFormatted: "082-282-4238",
  lineOA: "@713imada",
  bankAccount: {
    bank: "ธนาคารกสิกรไทย (KBANK)",
    number: "082-2-82423-8",
    name: "ร้านทุเรียนวินคิน",
    promptPay: "082-282-4238",
  },
  shippingMethods: [
    {
      name: "รถกระบะ / รถห้องเย็นส่งด่วน (คุมความเย็น 4°C)",
      price: 120,
      note: "รักษาความสด ไม่คายน้ำ แนะนำสำหรับเนื้อแกะ",
    },
    {
      name: "Flash Express พัสดุด่วน กล่องล็อกขั้วเจาะรู",
      price: 80,
      note: "ส่งด่วน 1-2 วัน สำหรับทุเรียนทั้งลูก",
    },
    {
      name: "นัดรับสินค้าหน้าร้าน / จุดนัดพบ",
      price: 0,
      note: "ไม่มีค่าใช้จ่าย",
    },
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
    image:
      "https://images.unsplash.com/photo-1519544442-93857b48665e?auto=format&fit=crop&w=800&q=80",
    badge: "ยอดนิยม",
    isAvailable: true,
    stockUnit: "kg",
    stockKg: 48.5,
    avgWeightKg: 3.7,
    description:
      "หมอนทองคัดผลแก่จัด 85%+ เปลือกบาง หนามแห้ง ทรงสวย พูใหญ่ เนื้อสีเหลืองทองเนียนละเอียด หวานมันกลมกล่อม เม็ดลีบ",
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
    image:
      "https://images.unsplash.com/photo-1519544442-93857b48665e?auto=format&fit=crop&w=800&h=600&q=80&crop=focalpoint&fp-z=1.7&fp-x=0.25&fp-y=0.3",
    badge: "พร้อมทาน",
    isAvailable: true,
    stockUnit: "qty",
    stockQty: 18,
    stockKg: 18,
    avgWeightKg: 1,
    description:
      "แกะสดใหม่วันต่อวัน คัดเฉพาะพูใหญ่เกรดสวย แพ็กใส่กล่องล็อกสุญญากาศอย่างดี ส่งรถเย็นถึงบ้านพร้อมเปิดทานทันที",
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
    image:
      "https://images.unsplash.com/photo-1519544442-93857b48665e?auto=format&fit=crop&w=800&h=600&q=80&crop=focalpoint&fp-z=1.7&fp-x=0.75&fp-y=0.3",
    badge: "หายาก",
    isAvailable: true,
    stockUnit: "kg",
    stockKg: 22,
    avgWeightKg: 2.8,
    description:
      "ก้านยาวแท้ ก้านใหญ่สมบูรณ์ เนื้อเนียนละเอียด ไร้เสี้ยน กลิ่นหอมสะอาด รสชาติหวานมันลึก สำหรับคนรักก้านยาวตัวจริง",
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
    image:
      "https://images.unsplash.com/photo-1519544442-93857b48665e?auto=format&fit=crop&w=800&h=600&q=80&crop=focalpoint&fp-z=1.7&fp-x=0.3&fp-y=0.75",
    badge: "หวานจัด",
    isAvailable: true,
    stockUnit: "kg",
    stockKg: 16.5,
    avgWeightKg: 2.1,
    description:
      "พวงมณีแท้ เม็ดเล็ก เนื้อสีเหลืองจำปาเข้ม รสหวานฉ่ำสะใจ คนชอบทุเรียนหวานเข้มข้นต้องไม่พลาด",
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
    image:
      "https://images.unsplash.com/photo-1519544442-93857b48665e?auto=format&fit=crop&w=800&q=80",
    isAvailable: true,
    stockUnit: "kg",
    stockKg: 19.5,
    avgWeightKg: 2.7,
    description:
      "ชะนีไข่เนื้อเหลืองทอง กลิ่นหอมเข้ม รสชาติหวานมันลึกสไตล์ทุเรียนแท้ดั้งเดิม คัดเนื้อไม่ให้เละ",
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
    image:
      "https://images.unsplash.com/photo-1519544442-93857b48665e?auto=format&fit=crop&w=800&h=600&q=80&crop=focalpoint&fp-z=1.7&fp-x=0.75&fp-y=0.75",
    badge: "นำเข้าพิเศษ",
    isAvailable: true,
    stockUnit: "kg",
    stockKg: 8,
    avgWeightKg: 2,
    description:
      "มูซานคิงแท้ เนื้อสีทองเข้ม เนื้อเนียนนุ่มละลายในปาก รสชาติหวานมันซับซ้อน อมขมปลายลิ้นนิดๆ",
    specs: {
      maturity: "สุกธรรมชาติ 100%",
      texture: "เนื้อเนียนละเอียด ละลายในปาก",
      flavor: "หวานมันเข้มข้น อมขมปลาย",
    },
  },
];

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

export const sampleOrders: Order[] = [
  {
    id: "WK-9521",
    createdAt: "2026-11-10T14:30:00",
    roundId: "WK-ROUND-46",
    customerName: "คุณกฤษฎา วัฒนกุล",
    phone: "081-892-1122",
    address: "123/45 ซอยสุขุมวิท 55 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110",
    ripenessPref: "กรอบนอกนุ่มใน (ไก่ฉีก)",
    items: [
      {
        productId: "WK-01",
        productName: "หมอนทองระยอง คัดเกรดพรีเมียม A+",
        qty: 1,
        price: 890,
      },
      {
        productId: "WK-02",
        productName: "หมอนทองแกะเนื้อพร้อมทาน 1,000 กรัม",
        qty: 1,
        price: 790,
      },
    ],
    totalPrice: 1680,
    shippingMethod: "รถกระบะ / รถห้องเย็นส่งด่วน (คุมความเย็น 4°C)",
    shippingCost: 120,
    paymentStatus: "confirmed",
    orderStatus: "preparing",
    courier: "รถกระบะทุเรียนวินคินวิ่งส่งเอง",
    lotId: "LOT-RY-01",
  },
  {
    id: "WK-9522",
    createdAt: "2026-11-10T16:10:00",
    roundId: "WK-ROUND-46",
    customerName: "คุณสมหญิง ใจดี",
    phone: "089-876-5432",
    address: "88/12 หมู่บ้านพฤกษา ถ.รังสิต-นครนายก ปทุมธานี 12130",
    ripenessPref: "สุกพอดีกิน (เนื้อเนียน)",
    items: [
      {
        productId: "WK-03",
        productName: "ก้านยาวจันทบุรี คัดพิเศษต้นเก่าแก่",
        qty: 1,
        price: 1390,
      },
    ],
    totalPrice: 1390,
    shippingMethod: "Flash Express พัสดุด่วน กล่องล็อกขั้วเจาะรู",
    shippingCost: 80,
    paymentStatus: "pending",
    orderStatus: "received",
  },
  {
    id: "WK-9520",
    createdAt: "2026-11-09T11:20:00",
    roundId: "WK-ROUND-46",
    customerName: "คุณวิชัย มั่งมี",
    phone: "062-111-2222",
    address: "45/9 ถ.นิมมานเหมินท์ ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200",
    ripenessPref: "กรอบนอกนุ่มใน (ไก่ฉีก)",
    items: [
      {
        productId: "WK-01",
        productName: "หมอนทองระยอง คัดเกรดพรีเมียม A+",
        qty: 2,
        price: 890,
      },
      {
        productId: "WK-05",
        productName: "ชะนีไข่ระยอง สดจากสวน",
        qty: 1,
        price: 550,
      },
    ],
    totalPrice: 2330,
    shippingMethod: "รถกระบะ / รถห้องเย็นส่งด่วน (คุมความเย็น 4°C)",
    shippingCost: 120,
    paymentStatus: "confirmed",
    orderStatus: "shipped",
    trackingNo: "SCGTH884291823",
    courier: "SCG Express (รถห้องเย็น)",
    lotId: "LOT-RY-01",
  },
];

export const initialLots: LotCost[] = [
  {
    lotId: "LOT-RY-01",
    roundId: "WK-ROUND-46",
    date: "2026-11-10",
    supplierName: "สวนลุงสมชาย อ.แกลง (ระยอง)",
    supplierPhone: "081-555-7890",
    variety: "หมอนทอง + ชะนี",
    weightKg: 65,
    costPerKg: 135,
    totalFruitCost: 8775,
    packagingCost: 450,
    truckFuelCost: 1200,
    notes: "ตัดแก่ 85%+ สภาพสวย เนื้อทอง ไร้หนอน",
  },
];

export const initialClaims: Claim[] = [
  {
    claimId: "CLM-40812",
    createdAt: "2026-11-09T18:45:00",
    orderId: "WK-9520",
    phone: "062-111-2222",
    reason: "unripe",
    description: "พูด้านหนึ่งยังแข็งเล็กน้อย อีกพูอร่อยมากครับ",
    evidenceName: "durian_slice_proof.jpg",
    status: "pending",
    lotId: "LOT-RY-01",
  },
];

export const initialPromotions: Promotion[] = [
  {
    id: "PROMO-01",
    title: "สั่งหมอนทอง 2 ลูกขึ้นไป ฟรีค่าส่งรถเย็น!",
    badge: "คุ้มสุดประจำรอบ",
    discountText: "ประหยัดทันที ฿120 ค่าส่งรถควบคุมความเย็น",
    conditionText: "สั่งซื้อทุเรียนเกรดพรีเมียมตั้งแต่ 2 ลูกขึ้นไปใน 1 ออเดอร์",
    promoCode: "FREECOOL2",
    isActive: true,
  },
  {
    id: "PROMO-02",
    title: "แพ็กคู่เนื้อล้วนพร้อมทาน 2 กก.",
    badge: "พร้อมเปิดกล่องทาน",
    discountText: "พิเศษ ฿1,490 จากปกติ ฿1,580",
    conditionText: "เฉพาะหมอนทองแกะเนื้อพร้อมทาน 1,000 กรัม x2 กล่อง",
    promoCode: "DUO2KG",
    isActive: true,
  },
  {
    id: "PROMO-03",
    title: "การันตีเนื้ออ่อน/เน่า เคลม 100% ฟรี",
    badge: "รับประกันทุกลูก",
    discountText: "เคลมเปลี่ยนลูกใหม่หรือคืนเงินเต็มจำนวน",
    conditionText: "ถ่ายรูปส่งเข้ามาทางแชท LINE ภายใน 24 ชม. หลังได้รับ",
    isActive: true,
  },
];

export function createInitialDatabase(): DatabaseState {
  return {
    products: JSON.parse(JSON.stringify(products)),
    rounds: [JSON.parse(JSON.stringify(currentRound))],
    orders: JSON.parse(JSON.stringify(sampleOrders)),
    lots: JSON.parse(JSON.stringify(initialLots)),
    claims: JSON.parse(JSON.stringify(initialClaims)),
    promotions: JSON.parse(JSON.stringify(initialPromotions)),
  };
}
