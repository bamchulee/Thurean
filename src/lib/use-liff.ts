"use client";

import { useEffect, useState } from "react";

interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

declare global {
  interface Window {
    liff?: {
      init: (opts: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      isInClient: () => boolean;
      login: (opts?: { redirectUri?: string }) => void;
      logout: () => void;
      getProfile: () => Promise<LiffProfile>;
    };
  }
}

export function useLiff(liffId?: string) {
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [inLineApp, setInLineApp] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const resolvedId = liffId || process.env.NEXT_PUBLIC_LINE_LIFF_ID || "";
    if (!resolvedId || typeof window === "undefined") return;

    let cancelled = false;

    const initLiff = async () => {
      try {
        if (!window.liff) return;
        await window.liff.init({ liffId: resolvedId });
        if (cancelled) return;
        setIsReady(true);
        setInLineApp(window.liff.isInClient());
        if (window.liff.isLoggedIn()) {
          const p = await window.liff.getProfile();
          if (!cancelled) setProfile(p);
        }
      } catch {
        // Ignore LIFF init error outside LINE client or invalid liffId
      }
    };

    if (window.liff) {
      initLiff();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    script.async = true;
    script.onload = () => initLiff();
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [liffId]);

  const login = () => {
    if (typeof window !== "undefined" && window.liff) {
      if (!window.liff.isLoggedIn()) {
        window.liff.login();
      }
    }
  };

  return { profile, inLineApp, isReady, login };
}
