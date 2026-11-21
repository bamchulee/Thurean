"use client";

// ส่วน "ที่อยู่จัดส่ง" ตอนสั่งซื้อ (แบบแอปช้อปปิ้ง)
//   มีที่อยู่ที่บันทึกไว้ → การ์ดที่อยู่ + ปุ่ม "เปลี่ยน"
//   ยังไม่มี / กดเปลี่ยน → ฟอร์มเต็มพร้อมปักหมุด
// สั่งสำเร็จแล้วบันทึกที่อยู่ใหม่เป็นที่อยู่หลักให้ (ครั้งหน้าไม่ต้องกรอกอีก)
import { useState } from "react";
import { MapPin } from "lucide-react";
import type { SafeUser } from "../../types/durian";
import { AddressForm } from "./AddressForm";
import { EMPTY_ADDRESS, addressErrors, formatThaiAddress, inThailand, type AddressValue } from "../../lib/thai-address";

export interface DeliveryPayload {
  customerName: string;
  phone: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

function nameOf(u: SafeUser | null | undefined, fallback?: string): string {
  if (!u) return fallback || "";
  const full = `${u.firstName || ""} ${u.lastName || ""}`.trim();
  if (full && full !== "ลูกค้า LINE") return full;
  if (u.displayName && !u.displayName.startsWith("line_")) return u.displayName;
  return fallback || "";
}

const savedAddressOf = (u: SafeUser | null | undefined) => {
  const a = (u?.address || "").trim();
  const p = (u?.postalCode || "").trim();
  return p && !a.includes(p) ? `${a} ${p}`.trim() : a;
};

/** สถานะที่อยู่จัดส่งของหน้าสั่งซื้อ */
export function useDeliveryAddress(user: SafeUser | null | undefined, fallbackName?: string) {
  const saved = savedAddressOf(user);
  const [editing, setEditing] = useState(false);
  const [addr, setAddr] = useState<AddressValue>(EMPTY_ADDRESS);
  const [saveAsDefault, setSaveAsDefault] = useState(true);
  const useSaved = Boolean(saved) && !editing;
  // ฟอร์มใหม่: ใส่ชื่อ/เบอร์จากบัญชีไว้ให้ก่อน
  const form: AddressValue = {
    ...addr,
    name: addr.name || nameOf(user, fallbackName),
    phone: addr.phone || user?.phone || "",
    lat: addr.lat ?? (inThailand(user?.latitude, user?.longitude) ? user?.latitude : undefined),
    lng: addr.lng ?? (inThailand(user?.latitude, user?.longitude) ? user?.longitude : undefined),
  };

  /** ข้อมูลส่งไปสร้างออเดอร์ หรือรายการช่องที่ยังขาด */
  const resolve = (): { ok: true; data: DeliveryPayload } | { ok: false; error: string } => {
    if (useSaved) {
      const name = nameOf(user, fallbackName);
      const phone = user?.phone || "";
      if (!name || phone.replace(/\D/g, "").length < 9) {
        return { ok: false, error: "ที่อยู่ที่บันทึกไว้ยังไม่มีชื่อหรือเบอร์ — กด \"เปลี่ยน\" เพื่อกรอกให้ครบ" };
      }
      return {
        ok: true,
        data: {
          customerName: name,
          phone,
          address: saved,
          ...(inThailand(user?.latitude, user?.longitude) ? { latitude: user?.latitude, longitude: user?.longitude } : {}),
        },
      };
    }
    const missing = addressErrors(form);
    if (missing.length) return { ok: false, error: `กรอกให้ครบ: ${missing.join(", ")}` };
    return {
      ok: true,
      data: {
        customerName: form.name.trim(),
        phone: form.phone.trim(),
        address: formatThaiAddress(form),
        ...(inThailand(form.lat, form.lng) ? { latitude: form.lat, longitude: form.lng } : {}),
      },
    };
  };

  /** ข้อมูลไปบันทึกเป็นที่อยู่หลักของบัญชี (เฉพาะตอนกรอกใหม่และติ๊กไว้) */
  const profilePatch = (): Partial<SafeUser> | null => {
    if (useSaved || !saveAsDefault) return null;
    return {
      address: formatThaiAddress({ ...form, postalCode: "" }),
      postalCode: form.postalCode.trim(),
      phone: form.phone.trim(),
      ...(inThailand(form.lat, form.lng) ? { latitude: form.lat, longitude: form.lng } : {}),
    };
  };

  return { saved, useSaved, editing, setEditing, form, setAddr, saveAsDefault, setSaveAsDefault, resolve, profilePatch, user, fallbackName };
}

export function DeliveryAddressSection({ state, canSave }: { state: ReturnType<typeof useDeliveryAddress>; canSave: boolean }) {
  const s = state;
  if (s.useSaved) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-3">
        <div className="flex items-start gap-2.5">
          <MapPin className="w-5 h-5 text-[#D9480F] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-stone-500">ที่อยู่จัดส่ง</p>
            <p className="text-sm font-semibold text-stone-900">
              {nameOf(s.user, s.fallbackName) || "ยังไม่มีชื่อ"} <span className="font-normal text-stone-500">| {s.user?.phone || "ยังไม่มีเบอร์"}</span>
            </p>
            <p className="text-sm text-stone-700 leading-snug break-words">{s.saved}</p>
            {inThailand(s.user?.latitude, s.user?.longitude) && <p className="mt-0.5 text-[11px] text-emerald-700">📌 มีหมุดแผนที่</p>}
          </div>
          <button type="button" onClick={() => s.setEditing(true)} className="shrink-0 text-xs font-bold text-[#D9480F] px-2 py-1 rounded-md hover:bg-orange-50">
            เปลี่ยน
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-stone-700">ที่อยู่จัดส่ง</p>
        {s.saved && (
          <button type="button" onClick={() => s.setEditing(false)} className="text-xs font-bold text-[#1B4D31] underline">
            ใช้ที่อยู่เดิม
          </button>
        )}
      </div>
      <AddressForm value={s.form} onChange={s.setAddr} />
      {canSave && (
        <label className="flex items-center gap-2 text-xs text-stone-700">
          <input type="checkbox" checked={s.saveAsDefault} onChange={(e) => s.setSaveAsDefault(e.target.checked)} className="accent-[#1B4D31]" />
          บันทึกเป็นที่อยู่หลัก (ครั้งหน้าไม่ต้องกรอกใหม่)
        </label>
      )}
    </div>
  );
}
