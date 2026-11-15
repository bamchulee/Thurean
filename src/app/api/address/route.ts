import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getAllDatabase,
  getRuntimeConfig,
  upsertLineUser,
} from "../../../lib/sheets-db";
import {
  buildMainQuickReply,
  buildPromptPayQrPaymentFlex,
  pushLineMessage,
} from "../../../lib/line-notify";
import {
  getLineSession,
  setLineSession,
} from "../../../lib/line-sessions";
import { shopInfo } from "../../../data/mock";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "";

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });
    }

    const { data } = await getAllDatabase();
    const users = Array.isArray(data?.users) ? data.users : [];
    const matched = users.find(
      (u) => u.lineUserId === userId || u.id === userId || (u as any).userId === userId
    );

    const session = getLineSession(userId);

    const fullName = matched
      ? (`${matched.firstName || ""} ${matched.lastName || ""}`.trim() || matched.displayName || matched.username || "")
      : "";

    return NextResponse.json({
      ok: true,
      user: matched
        ? {
            customerName: fullName,
            phone: matched.phone || "",
            address: matched.address || "",
          }
        : null,
      session: session?.flow === "order" ? {
        variety: session.productName,
        qty: session.qty,
        price: session.price,
        shippingMethod: session.shippingMethod,
      } : null,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      lineUserId,
      customerName,
      phone,
      address,
      houseNo,
      subdistrict,
      district,
      province,
      postalCode,
    } = body;

    const trimmedName = (customerName || "").trim();
    const cleanPhone = (phone || "").replace(/[^\d]/g, "").trim();

    if (!trimmedName || !cleanPhone) {
      return NextResponse.json(
        { ok: false, error: "กรุณาระบุชื่อและเบอร์โทรศัพท์ 10 หลักให้ครบถ้วน" },
        { status: 400 }
      );
    }

    // ประกอบที่อยู่
    let fullAddress = (address || "").trim();
    if (houseNo && (subdistrict || district || province || postalCode)) {
      const parts = [
        houseNo.trim(),
        subdistrict ? `ต.${subdistrict.trim()}` : "",
        district ? `อ.${district.trim()}` : "",
        province ? `จ.${province.trim()}` : "",
        postalCode ? postalCode.trim() : "",
      ].filter(Boolean);
      fullAddress = parts.join(" ");
    }

    if (!fullAddress) {
      return NextResponse.json(
        { ok: false, error: "กรุณาระบุที่อยู่จัดส่งให้ชัดเจน" },
        { status: 400 }
      );
    }

    // 1. บันทึกลงตาราง Users ใน Google Sheets
    await upsertLineUser({
      lineUserId: lineUserId || undefined,
      customerName: trimmedName,
      phone: cleanPhone,
      address: fullAddress,
      source: "web-form",
      notes: "กรอกผ่านฟอร์มที่อยู่ออนไลน์",
    });

    const cfg = getRuntimeConfig();
    const token =
      cfg.lineChannelAccessToken ||
      process.env.LINE_CHANNEL_ACCESS_TOKEN ||
      "PdFpuOJEzMXiSaUJDIssLxWbbXYtaUE0/e6/1IVXsGDWtu+MpuSsxtx+p2JAZYnh5L68apEKj1Pr8ceQ3UCv9nONR954SD4V8acz6dNxKoghEA0GKanpmzY+p+bM82oxNGaC2Z+LqK1HBSa+Rt/GPgdB04t89/1O/w1cDnyilFU=";

    // 2. ตรวจสอบว่ามี Order Session ค้างอยู่หรือไม่
    let advancedOrder = false;
    if (lineUserId && token) {
      const session = getLineSession(lineUserId);

      if (session?.flow === "order" && session.step === "enter_contact") {
        const qty = session.qty || 1;
        const totalPrice = (session.price || 0) * qty;
        const shipOpt =
          shopInfo.shippingMethods.find(
            (s) => s.name.toLowerCase() === (session.shippingMethod || "").toLowerCase()
          ) || shopInfo.shippingMethods[0];
        const shippingCost = shipOpt.price;
        const grandTotal = totalPrice + shippingCost;

        setLineSession(lineUserId, {
          ...session,
          step: "await_slip",
          customerName: trimmedName,
          phone: cleanPhone,
          address: fullAddress,
          grandTotal,
          updatedAt: Date.now(),
        });

        // ส่ง QR PromptPay เข้าแชท LINE ทันที
        await pushLineMessage(
          lineUserId,
          buildPromptPayQrPaymentFlex({
            grandTotal,
            totalPrice,
            shippingCost,
            shippingMethod: session.shippingMethod || shipOpt.name,
            productName: session.productName || "ทุเรียนวินคิน",
            qty,
            customerName: trimmedName,
            phone: cleanPhone,
            ripenessPref: session.ripenessPref || "ปกติ (พร้อมทาน)",
          }),
          token
        );
        advancedOrder = true;
      } else {
        // แจ้งยืนยันที่อยู่เข้าแชทปกติ
        await pushLineMessage(
          lineUserId,
          [
            {
              type: "text",
              text: `🍈 บันทึกข้อมูลที่อยู่จัดส่งของคุณเรียบร้อยแล้วครับ!\n\n👤 ชื่อผู้รับ: ${trimmedName}\n📞 เบอร์โทร: ${cleanPhone}\n📍 ที่อยู่: ${fullAddress}\n\nระบบบันทึกข้อมูลเพื่อใช้สั่งซื้อทุเรียนตัดสดในรอบนี้และรอบถัดไปเรียบร้อยครับ ✨`,
              quickReply: buildMainQuickReply(),
            },
          ],
          token
        );
      }
    }

    return NextResponse.json({
      ok: true,
      customerName: trimmedName,
      phone: cleanPhone,
      address: fullAddress,
      advancedOrder,
    });
  } catch (err: any) {
    console.error("[API Address Error]", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
