"use client";

// สถานะสมาชิกฝั่งหน้าเว็บ: เข้าสู่ระบบด้วย LINE / Google / Facebook (ไม่มีรหัสผ่าน)
// การเข้า/เชื่อมบัญชีเป็นการเปลี่ยนหน้าไป /api/auth/<provider>/login แล้วกลับมาหน้าเดิม
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { SafeUser } from "../types/durian";

export type AuthProviderName = "line" | "google" | "facebook";

export interface LineLoginPayload {
  /** access token จาก liff.getAccessToken() — เซิร์ฟเวอร์ใช้ยืนยันตัวตนกับ LINE */
  accessToken: string;
}

interface AuthContextType {
  user: SafeUser | null;
  loading: boolean;
  /** ช่องทางที่ร้านตั้งค่าไว้แล้ว (ปุ่มที่ยังไม่พร้อมจะไม่แสดง) */
  providers: Record<AuthProviderName, boolean>;
  isAuthModalOpen: boolean;
  /** ลิงก์เริ่มล็อกอิน/เชื่อมบัญชี — กลับมาที่ next (ค่าเริ่มต้นคือหน้าปัจจุบัน) */
  authUrl: (provider: AuthProviderName, mode?: "login" | "link", next?: string) => string;
  loginWithLine: (payload: LineLoginPayload) => Promise<{ ok: boolean; error?: string; user?: SafeUser }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<SafeUser>) => Promise<{ ok: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
  /** พารามิเตอร์เดิมไม่ใช้แล้ว (เหลือไว้ให้ปุ่มเก่าเรียกได้) */
  openAuthModal: (mode?: string) => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const USER_STORAGE_KEY = "winkin_durian_user_v1";
const NO_PROVIDERS = { line: false, google: false, facebook: false };

function currentPath(): string {
  if (typeof window === "undefined") return "/";
  const url = new URL(window.location.href);
  for (const k of ["login", "linked", "auth_error", "auth_message", "line_friend"]) url.searchParams.delete(k);
  return url.pathname + url.search;
}

async function loadMe(): Promise<{ user: SafeUser | null; providers?: Record<AuthProviderName, boolean> }> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const json = (await res.json()) as { ok: boolean; user?: SafeUser; providers?: Record<AuthProviderName, boolean> };
    return { user: json.ok && json.user ? json.user : null, providers: json.providers };
  } catch {
    return { user: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<Record<AuthProviderName, boolean>>(NO_PROVIDERS);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const applyUser = useCallback((next: SafeUser | null) => {
    setUser(next);
    try {
      if (next) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      // private mode / storage blocked
    }
  }, []);

  const fetchMe = useCallback(async () => {
    const me = await loadMe();
    if (me.providers) setProviders(me.providers);
    return me.user;
  }, []);

  useEffect(() => {
    let cancelled = false;
    // แสดงชื่อจาก cache ก่อน (หลัง render แรก กัน hydration mismatch) แล้วค่อยยืนยันกับเซิร์ฟเวอร์
    queueMicrotask(() => {
      try {
        const cached = localStorage.getItem(USER_STORAGE_KEY);
        const parsed = cached ? (JSON.parse(cached) as SafeUser) : null;
        if (parsed?.id && !cancelled) setUser(parsed);
      } catch {
        // ignore
      }
    });
    loadMe().then((me) => {
      if (cancelled) return;
      if (me.providers) setProviders(me.providers);
      applyUser(me.user);
      setLoading(false);
      // กลับมาจากหน้าล็อกอิน/เชื่อมบัญชีที่ผิดพลาด → เปิดหน้าต่างบัญชีให้เห็นข้อความ
      const params = new URLSearchParams(window.location.search);
      if (params.get("auth_error") || params.get("linked") || params.get("line_friend") === "0") setIsAuthModalOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, [applyUser]);

  const refreshUser = useCallback(async () => applyUser(await fetchMe()), [fetchMe, applyUser]);

  const authUrl = useCallback(
    (provider: AuthProviderName, mode: "login" | "link" = "login", next?: string) =>
      `/api/auth/${provider}/login?mode=${mode}&next=${encodeURIComponent(next || currentPath())}`,
    []
  );

  const loginWithLine = useCallback(
    async (payload: LineLoginPayload) => {
      try {
        const res = await fetch("/api/auth/line", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || !json.ok || !json.user) {
          return { ok: false, error: json.error || "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ" };
        }
        applyUser(json.user);
        setIsAuthModalOpen(false);
        return { ok: true, user: json.user as SafeUser };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    },
    [applyUser]
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    applyUser(null);
  }, [applyUser]);

  const updateProfile = useCallback(
    async (data: Partial<SafeUser>) => {
      try {
        const res = await fetch("/api/auth/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok || !json.ok || !json.user) {
          return { ok: false, error: json.error || "อัปเดตข้อมูลไม่สำเร็จ" };
        }
        applyUser(json.user);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    },
    [applyUser]
  );

  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        providers,
        isAuthModalOpen,
        authUrl,
        loginWithLine,
        logout,
        updateProfile,
        refreshUser,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
