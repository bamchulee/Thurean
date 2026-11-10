"use client";

import { useEffect, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import { shopInfo } from "../data/mock";
import {
  buildDesktopLineProtocolUrl,
  buildMobileLineChatUrl,
  isMobileBrowser,
  normalizeLineOaId,
} from "../lib/line-links";

interface LineDirectLinkProps {
  children: ReactNode;
  className?: string;
  prefillText?: string;
  ariaLabel?: string;
  onAfterClick?: () => void;
}

/**
 * Opens LINE directly on both Mobile (oaMessage chat) and Desktop (`line://` app protocol),
 * avoiding the `https://line.me/R/ti/p/...` QR code webpage.
 * Shows a clean non-QR ID-copy fallback toast via portal only if LINE Desktop is not installed.
 */
export function LineDirectLink({
  children,
  className,
  prefillText,
  ariaLabel,
  onAfterClick,
}: LineDirectLinkProps) {
  const lineId = normalizeLineOaId(shopInfo.lineOA);
  const desktopProtocolUrl = buildDesktopLineProtocolUrl(lineId);
  const mobileChatUrl = buildMobileLineChatUrl(lineId, prefillText);

  const [resolvedHref, setResolvedHref] = useState<string>(desktopProtocolUrl);
  const [showNoAppNotice, setShowNoAppNotice] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    setResolvedHref(isMobileBrowser() ? mobileChatUrl : desktopProtocolUrl);
  }, [desktopProtocolUrl, mobileChatUrl]);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onAfterClick?.();

    if (isMobileBrowser()) {
      // Navigate directly via Universal Link so iOS/Android jumps straight into LINE chat
      e.preventDefault();
      window.location.href = mobileChatUrl;
      return;
    }

    // Desktop: invoke `line://` directly to skip line.me QR landing page
    e.preventDefault();

    if (prefillText && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(prefillText).catch(() => {});
    }

    let appOpened = false;
    let timerId = 0;

    const cleanup = () => {
      window.removeEventListener("blur", markOpened);
      document.removeEventListener("visibilitychange", markOpened);
      if (timerId) window.clearTimeout(timerId);
    };

    const markOpened = () => {
      appOpened = true;
      cleanup();
    };

    window.addEventListener("blur", markOpened, { once: true });
    document.addEventListener("visibilitychange", markOpened, { once: true });

    window.location.href = desktopProtocolUrl;

    timerId = window.setTimeout(() => {
      const stillFocused = !appOpened && document.hasFocus();
      cleanup();
      if (stillFocused) {
        setShowNoAppNotice(true);
      }
    }, 1200);
  };

  const handleCopyId = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(lineId).then(() => {
        setCopiedId(true);
        window.setTimeout(() => setCopiedId(false), 2000);
      });
    }
  };

  return (
    <>
      <a
        href={resolvedHref}
        onClick={handleClick}
        className={className}
        aria-label={ariaLabel}
      >
        {children}
      </a>

      {showNoAppNotice &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-md bg-stone-900 text-white rounded-2xl p-4 shadow-2xl border border-emerald-500/40"
            role="status"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-left space-y-1">
                <p className="text-xs font-bold text-emerald-400">
                  เปิดแอป LINE บนคอมไม่สำเร็จ (อาจยังไม่ได้ติดตั้ง LINE PC)
                </p>
                <p className="text-xs text-stone-200 leading-relaxed">
                  เปิดแอป LINE บนมือถือ แล้วค้นหาไอดี{" "}
                  <strong className="font-mono text-amber-300">{lineId}</strong>{" "}
                  เพื่อทักแชทได้เลย{prefillText ? " (คัดลอกข้อความให้อัตโนมัติแล้ว)" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNoAppNotice(false)}
                className="text-stone-400 hover:text-white p-1 shrink-0"
                aria-label="ปิดการแจ้งเตือน"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={handleCopyId}
                className="flex-1 bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-bold py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5"
              >
                {copiedId ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>คัดลอก {lineId} แล้ว</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>คัดลอกไอดี {lineId}</span>
                  </>
                )}
              </button>
              <a
                href={desktopProtocolUrl}
                onClick={() => setShowNoAppNotice(false)}
                className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold py-2 px-3 rounded-xl transition inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>ลองเปิด LINE อีกครั้ง</span>
              </a>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
