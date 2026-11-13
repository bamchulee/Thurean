import { NextResponse } from "next/server";
import { getAllDatabase, getRuntimeConfig } from "../../../lib/sheets-db";
import { shopInfo } from "../../../data/mock";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, source, warning } = await getAllDatabase();
    const cfg = getRuntimeConfig();
    const activeRound =
      data.rounds.find((r) => r.status === "open") || data.rounds[0] || null;

    return NextResponse.json({
      ok: true,
      source,
      warning,
      products: data.products,
      currentRound: activeRound,
      promotions: (data.promotions || []).filter((pr) => pr.isActive),
      shopInfo: {
        ...shopInfo,
        lineOA: cfg.lineOaId || shopInfo.lineOA,
      },
      hasLineLogin: Boolean(cfg.lineLoginChannelId || process.env.LINE_LOGIN_CHANNEL_ID),
      lineLiffId: cfg.lineLiffId || process.env.NEXT_PUBLIC_LINE_LIFF_ID || "",
      liveStream: {
        isLiveNow: Boolean(cfg.isLiveNow),
        platform: cfg.liveStreamPlatform || "",
        url: cfg.liveStreamUrl || "",
        note: cfg.liveStreamNote || "",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
