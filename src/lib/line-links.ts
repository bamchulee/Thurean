// ============================================================
// LINE Direct Deep-Link Helpers (No QR-code redirect page)
// ============================================================

export function normalizeLineOaId(lineId: string): string {
  const trimmed = lineId.trim();
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Mobile browsers (iOS / Android) support Universal Link `oaMessage`
 * which opens the LINE app directly into the chat room with optional pre-filled text.
 */
export function buildMobileLineChatUrl(lineId: string, prefillText?: string): string {
  const encodedId = encodeURIComponent(normalizeLineOaId(lineId));
  if (prefillText && prefillText.trim()) {
    return `https://line.me/R/oaMessage/${encodedId}/?${encodeURIComponent(prefillText.trim())}`;
  }
  return `https://line.me/R/oaMessage/${encodedId}/`;
}

/**
 * Desktop browsers (Windows / macOS) show a QR-code webpage when opening `https://line.me/R/ti/p/...`.
 * Using the `line://` custom protocol invokes the installed LINE Desktop app directly instead.
 */
export function buildDesktopLineProtocolUrl(lineId: string): string {
  const id = normalizeLineOaId(lineId);
  return `line://ti/p/${id}`;
}
