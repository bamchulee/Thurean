// เรียก LINE Messaging API: push / reply / loading / ลิงก์แชท

export async function pushLineMessage(
  toUserId: string,
  messages: unknown[],
  channelAccessToken?: string
): Promise<{ sent: boolean; reason?: string }> {
  if (!channelAccessToken || !toUserId) {
    return { sent: false, reason: "Missing LINE token or target userId" };
  }

  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: toUserId,
        messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { sent: false, reason: `LINE API ${res.status}: ${errText}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: String(err) };
  }
}

export async function replyLineMessage(
  replyToken: string,
  messages: unknown[],
  channelAccessToken?: string,
  fallbackUserId?: string
): Promise<boolean> {
  if (!channelAccessToken) return false;
  let replySuccess = false;
  if (replyToken) {
    try {
      const res = await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${channelAccessToken}`,
        },
        body: JSON.stringify({ replyToken, messages }),
      });
      if (res.ok) {
        replySuccess = true;
      } else {
        const errText = await res.text();
        console.warn("[LINE Reply Error]", res.status, errText);
      }
    } catch (err) {
      console.warn("[LINE Reply Network Error]", err);
    }
  }

  // If reply failed (e.g. 400 Invalid reply token / timeout) and we have fallbackUserId: push instead!
  if (!replySuccess && fallbackUserId) {
    console.log(`[LINE Reply Fallback] Pushing directly to user ${fallbackUserId}`);
    const pushRes = await pushLineMessage(fallbackUserId, messages, channelAccessToken);
    return pushRes.sent;
  }

  return replySuccess;
}

/** แสดงสถานะ "กำลังพิมพ์..." (Loading Animation จุดสามจุดขยับได้) ให้ลูกค้าเห็นในหน้าแชททันที */
export async function showLineLoadingAnimation(
  chatId: string,
  channelAccessToken?: string,
  loadingSeconds = 15
): Promise<void> {
  if (!channelAccessToken || !chatId) return;
  try {
    const res = await fetch("https://api.line.me/v2/bot/chat/loading/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({ chatId, loadingSeconds }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn("[LINE Loading Error]", res.status, err);
    }
  } catch (err) {
    console.warn("[LINE Loading Exception]", err);
  }
}

// รหัสบัญชี OA (bot userId) สำหรับทำลิงก์ห้องแชทใน LINE OA Manager — ดึงครั้งเดียวต่อ instance
let botUserIdCache: string | undefined;

/** ลิงก์เปิดห้องแชทกับลูกค้าคนนี้ใน LINE OA Manager (chat.line.biz) */
export async function getLineChatUrl(lineUserId?: string, channelAccessToken?: string): Promise<string | undefined> {
  if (!lineUserId) return undefined;
  if (!botUserIdCache && channelAccessToken) {
    try {
      const res = await fetch("https://api.line.me/v2/bot/info", {
        headers: { Authorization: `Bearer ${channelAccessToken}` },
      });
      if (res.ok) botUserIdCache = ((await res.json()) as { userId?: string }).userId;
    } catch {
      // ไม่ได้ก็ใช้หน้ารวมแชทแทน
    }
  }
  return botUserIdCache ? `https://chat.line.biz/${botUserIdCache}/chat/${lineUserId}` : "https://chat.line.biz/";
}
