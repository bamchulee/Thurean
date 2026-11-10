// ============================================================
// Multi-Courier Detection & Tracking URL Builder
// ============================================================

export interface CourierOption {
  id: string;
  name: string;
  trackUrlTemplate?: string; // Use {tracking} placeholder
}

export const COURIER_OPTIONS: CourierOption[] = [
  {
    id: "flash",
    name: "Flash Express",
    trackUrlTemplate: "https://www.flashexpress.co.th/fle/tracking?se={tracking}",
  },
  {
    id: "scg",
    name: "SCG Express (รถห้องเย็น)",
    trackUrlTemplate: "https://www.scgexpress.co.th/tracking/?tracking={tracking}",
  },
  {
    id: "inter",
    name: "Inter Express (รถห้องเย็น)",
    trackUrlTemplate: "https://www.iel.co.th/",
  },
  {
    id: "kex",
    name: "KEX / Kerry Express",
    trackUrlTemplate: "https://th.kex-express.com/th/track/?track={tracking}",
  },
  {
    id: "jnt",
    name: "J&T Express",
    trackUrlTemplate: "https://www.jtexpress.co.th/service/track?bills={tracking}",
  },
  {
    id: "thaipost",
    name: "ไปรษณีย์ไทย (EMS)",
    trackUrlTemplate: "https://track.thailandpost.co.th/?trackNumber={tracking}",
  },
  {
    id: "own_truck",
    name: "รถกระบะทุเรียนวินคินวิ่งส่งเอง",
  },
];

export interface ResolvedCourier {
  id: string;
  name: string;
  detectedBy: "explicit" | "prefix" | "shipping_method";
  trackingUrl?: string;
}

/**
 * Resolves which courier company carries the order:
 * 1) Explicit `order.courier` saved by admin in Google Sheet / Admin UI
 * 2) Auto-detection from Thai parcel tracking prefix (`TH...`, `SCG...`, `...TH`, etc.)
 * 3) Fallback inference from selected shipping method
 */
export function resolveCourierInfo(
  trackingNo?: string,
  explicitCourier?: string,
  shippingMethod?: string
): ResolvedCourier {
  const cleanTrack = (trackingNo || "").trim();
  const cleanCourier = (explicitCourier || "").trim();

  const buildResult = (
    opt: CourierOption,
    detectedBy: ResolvedCourier["detectedBy"],
    customName?: string
  ): ResolvedCourier => ({
    id: opt.id,
    name: customName || opt.name,
    detectedBy,
    trackingUrl:
      opt.trackUrlTemplate && cleanTrack
        ? opt.trackUrlTemplate.replace("{tracking}", encodeURIComponent(cleanTrack))
        : opt.trackUrlTemplate?.replace(/\?.*$/, ""),
  });

  // 1. Explicit courier name saved on Order
  if (cleanCourier) {
    const low = cleanCourier.toLowerCase();
    const matched = COURIER_OPTIONS.find(
      (c) =>
        c.id === low ||
        c.name.toLowerCase().includes(low) ||
        low.includes(c.id)
    );
    if (matched) return buildResult(matched, "explicit", cleanCourier);
    return {
      id: "custom",
      name: cleanCourier,
      detectedBy: "explicit",
    };
  }

  // 2. Prefix / pattern auto-detection from tracking number
  if (cleanTrack) {
    const upper = cleanTrack.toUpperCase();
    if (upper.startsWith("SCG")) {
      return buildResult(COURIER_OPTIONS[1], "prefix");
    }
    if (upper.startsWith("IEL") || upper.startsWith("IE")) {
      return buildResult(COURIER_OPTIONS[2], "prefix");
    }
    if (/^[A-Z]{2}\d{9}TH$/.test(upper)) {
      return buildResult(COURIER_OPTIONS[5], "prefix");
    }
    if (upper.startsWith("TH") || upper.startsWith("F")) {
      return buildResult(COURIER_OPTIONS[0], "prefix");
    }
    if (upper.startsWith("KEX") || upper.startsWith("KER") || upper.startsWith("SHP")) {
      return buildResult(COURIER_OPTIONS[3], "prefix");
    }
    if (/^(6|8)\d{11}$/.test(upper)) {
      return buildResult(COURIER_OPTIONS[4], "prefix");
    }
  }

  // 3. Fallback from shippingMethod description
  const shipLow = (shippingMethod || "").toLowerCase();
  if (shipLow.includes("flash")) return buildResult(COURIER_OPTIONS[0], "shipping_method");
  if (shipLow.includes("scg")) return buildResult(COURIER_OPTIONS[1], "shipping_method");
  if (shipLow.includes("inter")) return buildResult(COURIER_OPTIONS[2], "shipping_method");
  if (shipLow.includes("kerry") || shipLow.includes("kex"))
    return buildResult(COURIER_OPTIONS[3], "shipping_method");
  if (shipLow.includes("ไปรษณีย์") || shipLow.includes("ems"))
    return buildResult(COURIER_OPTIONS[5], "shipping_method");

  return buildResult(COURIER_OPTIONS[6], "shipping_method");
}
