"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { SafeUser } from "../types/durian";

interface RegisterPayload {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  postalCode: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: SafeUser | null;
  loading: boolean;
  isAuthModalOpen: boolean;
  authModalMode: "login" | "register";
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (payload: RegisterPayload) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<SafeUser>) => Promise<{ ok: boolean; error?: string }>;
  openAuthModal: (mode?: "login" | "register") => void;
  closeAuthModal: () => void;
  setAuthModalMode: (mode: "login" | "register") => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const USER_STORAGE_KEY = "winkin_durian_user_v1";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register">("login");

  // Load from local cache first for instant UI response
  useEffect(() => {
    try {
      const cached = localStorage.getItem(USER_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id) setUser(parsed);
      }
    } catch {
      // Ignore
    }

    // Verify session with server
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && json.user) {
          setUser(json.user);
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(json.user));
        } else {
          // session expired or not logged in
          setUser(null);
          localStorage.removeItem(USER_STORAGE_KEY);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok || !json.user) {
        return { ok: false, error: json.error || "เข้าสู่ระบบไม่สำเร็จ" };
      }
      setUser(json.user);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(json.user));
      setIsAuthModalOpen(false);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok || !json.user) {
        return { ok: false, error: json.error || "สมัครสมาชิกไม่สำเร็จ" };
      }
      setUser(json.user);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(json.user));
      setIsAuthModalOpen(false);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
  }, []);

  const updateProfile = useCallback(async (data: Partial<SafeUser>) => {
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
      setUser(json.user);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(json.user));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }, []);

  const openAuthModal = useCallback((mode: "login" | "register" = "login") => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthModalOpen,
        authModalMode,
        login,
        register,
        logout,
        updateProfile,
        openAuthModal,
        closeAuthModal,
        setAuthModalMode,
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
