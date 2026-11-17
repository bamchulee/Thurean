// ============================================================
// Core Domain Types for ร้าน "ทุเรียนวินคิน"
// ============================================================

export interface BaseAuditLog {
  isActive?: number | boolean;
  createDate?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type ProductSaleType = "รับคัดลูก" | "รับมาเป็นโลแล้วขายเลย";
export type ProductMaturity = "แก่จัด 85%+" | "สุกพอดีกิน" | "สุกพร้อมทาน 100%" | "ห่าม/ตัดสดบ่มเอง 80%";
export type ProductTexture = "กรอบนอกนุ่มใน" | "เนื้อไก่ฉีก" | "นุ่มละมุน/ครีมมี่" | "สุกนิ่มหวานฉ่ำ";
export type ProductGrade = "เกรด A+ พรีเมียม" | "เกรด A ทรงสวย" | "เกรด B ผลไม่สมมาตร" | "เกรดจัมโบ้" | "เกรดมินิ";

export interface Product extends BaseAuditLog {
  id: string; // รหัสโปรดักID
  productType?: ProductSaleType | string; // ประเภท: รับคัดลูก / รับมาเป็นโลแล้วขายเลย (ดรอปดาวน์)
  name: string; // ชื่อสินค้า Name
  maturity?: ProductMaturity | string; // ระดับความสุก maturity (ดรอปดาวน์)
  texture?: ProductTexture | string; // texture (ดรอปดาวน์)
  stockQty?: number; // จำนวนลูก
  grade?: ProductGrade | string; // ไซส์/เกรด (ดรอปดาวน์)
  weight: string; // น้ำหนักต่อลูก
  image: string; // รูป
  description: string; // รายละเอียด
  pricePerKg?: number; // ราคาต่อโล
  price: number; // ราคา
  variety?: string;
  type?: "whole" | "flesh";
  ripeness?: string;
  marketPrice?: number;
  unit?: string;
  origin?: string;
  brix?: string;
  badge?: string;
  isAvailable?: boolean;
  stockUnit?: "kg" | "qty";
  stockKg?: number;
  avgWeightKg?: number;
  specs?: {
    maturity: string;
    texture: string;
    flavor: string;
  };
}

export interface Round extends BaseAuditLog {
  id: string;
  name: string;
  truckRoute: string;
  harvestDate: string;
  closeDate: string;
  deliveryDate: string;
  status: "open" | "closed" | "shipping" | "done";
  quotaRemaining: number;
  totalQuota: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  qty: number;
  price: number;
  productType?: string;
  grade?: string;
  weightPerItem?: string | number;
  pricePerKg?: number;
  actualWeightKg?: number;
  /** น้ำหนักที่ชั่งได้ทีละลูก (กก.) — กรอกจากหน้าออเดอร์ของแอดมิน */
  fruitKgs?: number[];
}

export type PaymentStatus = "pending" | "slip_submitted" | "confirmed" | "refunded" | string;
export type OrderStatus =
  | "received"
  | "preparing"
  | "packed"
  | "shipped"
  | "delivered"
  | "claimed"
  | "สั่งจอง"
  | "รอชั่งน้ำหนัก/สรุปยอด"
  | "รอชำระเงิน"
  | "ชำระเงินแล้ว/เตรียมจัดส่ง"
  | "กำลังจัดส่ง"
  | "จัดส่งสำเร็จ"
  | "ยกเลิก"
  | string;

export interface Order extends BaseAuditLog {
  id: string;
  createdAt: string;
  roundId: string;
  userId?: string;
  customerName: string;
  phone: string;
  address?: string;
  lineUserId?: string;
  ripenessPref?: string;
  productType?: string;
  productId?: string;
  productName?: string;
  pricePerItem?: number;
  weightPerItem?: string | number;
  quantity?: number;
  totalPrice: number;
  courier?: string;
  channel?: string;
  vehicleType?: string;
  trackingNo?: string;
  items: OrderItem[];
  shippingMethod: string;
  shippingCost: number;
  grandTotal?: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  deliveredAt?: string;
  weighedAt?: string;
  slipSubmittedAt?: string;
  paidAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  bookingKey?: string; // กันออเดอร์ซ้ำจากปุ่มยืนยันอันเดิมใน LINE
  slipUrl?: string;
  lotId?: string;
  mapsUrl?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface LotCost extends BaseAuditLog {
  lotId: string;
  roundId: string;
  date: string;
  supplierName: string;
  supplierPhone?: string;
  variety: string;
  weightKg: number;
  costPerKg: number;
  totalFruitCost: number;
  packagingCost: number;
  truckFuelCost: number;
  notes?: string;
}

export type ClaimStatus = "pending" | "approved_replace" | "approved_refund" | "rejected";

export interface Claim extends BaseAuditLog {
  claimId: string;
  createdAt: string;
  orderId: string;
  userId?: string;
  lineUserId?: string;
  customerName?: string;
  phone: string;
  ripenessType?: "ready_to_eat" | "ripen_at_home" | string;
  deliveredAt?: string;
  reason: string;
  description: string;
  evidenceName?: string;
  evidencePhotos?: string[];
  status: ClaimStatus;
  resolutionType?: "replacement" | "refund" | string;
  resolutionNote?: string;
  lotId?: string;
}

export interface Promotion extends BaseAuditLog {
  id: string;
  title: string;
  badge?: string;
  discountText: string;
  conditionText: string;
  promoCode?: string;
  isActive: boolean;
}

export interface User extends BaseAuditLog {
  id: string;
  userId?: string;
  username: string;
  lineUserId?: string;
  displayName?: string;
  passwordHash?: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  postalCode: string;
  avatarUrl?: string;
  mapsUrl?: string;
  latitude?: number;
  longitude?: number;
  lastLoginAt?: string;
  /** user = ลูกค้า, staff = พนักงาน (ชั่ง/ยืนยันสลิป/จัดส่ง), admin = เจ้าของร้าน (ทุกอย่าง) */
  role: "user" | "staff" | "admin";
  googleId?: string;
  email?: string;
  /** ช่องทางที่ผูกไว้ คั่นด้วยจุลภาค เช่น "google,line" */
  loginProviders?: string;
  source?: "line-login" | "line-chat" | "web" | string;
  notes?: string;
  orderCount?: number;
  totalSpent?: number;
  createdAt: string;
  updatedAt: string;
}

export type SafeUser = Omit<User, "passwordHash">;

export interface DatabaseState {
  products: Product[];
  rounds: Round[];
  orders: Order[];
  lots: LotCost[];
  claims: Claim[];
  promotions?: Promotion[];
  users?: User[];
  config?: {
    lineAdminGroupId?: string;
    lineAdminUserId?: string;
  };
}

export interface RuntimeConfig {
  googleSheetsWebAppUrl?: string;
  googleSheetsApiKey?: string;
  googleSheetViewUrl?: string;
  userSheetViewUrl?: string;
  thureanSheetViewUrl?: string;
  lineOaId?: string;
  lineChannelAccessToken?: string;
  lineAdminUserId?: string;
  lineAdminGroupId?: string;
  lineLiffId?: string;
  lineLoginChannelId?: string;
  lineLoginChannelSecret?: string;
  lineChannelSecret?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  adminPin?: string;
  publicBaseUrl?: string;
  liveStreamPlatform?: string;
  liveStreamUrl?: string;
  liveStreamNote?: string;
  isLiveNow?: boolean;
  lastSyncedAt?: string;
}
