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

export interface Product extends BaseAuditLog {
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
  stockUnit?: "kg" | "qty";
  stockKg?: number;
  avgWeightKg?: number;
  stockQty?: number;
  specs: {
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
}

export type PaymentStatus = "pending" | "confirmed" | "refunded";
export type OrderStatus =
  | "received"
  | "preparing"
  | "packed"
  | "shipped"
  | "delivered"
  | "claimed";

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
  items: OrderItem[];
  totalPrice: number;
  shippingMethod: string;
  shippingCost: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  deliveredAt?: string;
  trackingNo?: string;
  courier?: string;
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
  phone: string;
  reason: string;
  description: string;
  evidenceName?: string;
  status: ClaimStatus;
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
  role: "user" | "admin";
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
  lineLiffId?: string;
  lineLoginChannelId?: string;
  lineLoginChannelSecret?: string;
  adminPin?: string;
  publicBaseUrl?: string;
  liveStreamPlatform?: string;
  liveStreamUrl?: string;
  liveStreamNote?: string;
  isLiveNow?: boolean;
  lastSyncedAt?: string;
}
