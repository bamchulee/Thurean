// ============================================================
// Core Domain Types for ร้าน "ทุเรียนวินคิน"
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

export interface Round {
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

export interface Order {
  id: string;
  createdAt: string;
  roundId: string;
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
  trackingNo?: string;
  lotId?: string;
  notes?: string;
}

export interface LotCost {
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

export interface Claim {
  claimId: string;
  createdAt: string;
  orderId: string;
  phone: string;
  reason: string;
  description: string;
  evidenceName?: string;
  status: ClaimStatus;
  resolutionNote?: string;
  lotId?: string;
}

export interface DatabaseState {
  products: Product[];
  rounds: Round[];
  orders: Order[];
  lots: LotCost[];
  claims: Claim[];
}

export interface RuntimeConfig {
  googleSheetsWebAppUrl?: string;
  googleSheetViewUrl?: string;
  lineChannelAccessToken?: string;
  lineAdminUserId?: string;
  adminPin?: string;
  lastSyncedAt?: string;
}
