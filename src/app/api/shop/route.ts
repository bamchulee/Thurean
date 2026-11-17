import { NextResponse } from "next/server";
import { getAllDatabase, getRuntimeConfig, getBankAccount } from "../../../lib/sheets-db";
import { shopInfo } from "../../../data/shop";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, source, warning } = await getAllDatabase();
    const cfg = getRuntimeConfig();

    // กรองแสดงเฉพาะข้อมูลที่เปิดใช้งาน (isActive !== 0 && isActive !== false)
    const activeProducts = (data.products || []).filter(
      (p) => p.isActive !== 0 && (p.isActive as any) !== "0" && p.isActive !== false
    );
    const activeRounds = (data.rounds || []).filter(
      (r) => r.isActive !== 0 && (r.isActive as any) !== "0" && r.isActive !== false
    );
    const activeRound =
      activeRounds.find((r) => r.status === "open") || activeRounds[0] || null;
    const activePromotions = (data.promotions || []).filter(
      (pr) => pr.isActive !== false && (pr.isActive as any) !== 0 && (pr.isActive as any) !== "0"
    );

    const res = NextResponse.json({
      bankAccount: getBankAccount(),
      ok: true,
      source,
      warning,
      products: activeProducts,
      currentRound: activeRound,
      promotions: activePromotions,
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
    // ข้อมูลหน้าร้านเป็นข้อมูลสาธารณะ: ให้ CDN ของ Vercel เก็บไว้ 15 วิ แล้วตอบของเดิมระหว่างดึงใหม่
    // (ลูกค้าไม่ต้องรอฟังก์ชันตื่น/รอชีต — ปัญหาเปิดหน้าแรกช้า 8 วินาที)
    if (source === "google-sheets") {
      res.headers.set("Cache-Control", "public, s-maxage=15, stale-while-revalidate=600");
    }
    return res;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
