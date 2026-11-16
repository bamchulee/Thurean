import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAllDatabase, getRuntimeConfig, upsertLineUser } from "../../../lib/sheets-db";
import { buildMainQuickReply, pushLineMessage } from "../../../lib/line-notify";
import { verifyAddressLink } from "../../../lib/booking-draft";
import { bookingReviewMessages } from "../../../lib/line-booking";
import { clearLineSession } from "../../../lib/line-sessions";

export const dynamic = "force-dynamic";

// ฟอร์มที่อยู่เปิดจากลิงก์ที่บอท LINE เซ็นชื่อไว้เท่านั้น (booking-draft.ts → buildAddressLinkQuery)
// ไม่รับ ?userId= ตรง ๆ อีกแล้ว: ใครรู้ LINE ID ก็จะอ่าน/แก้ที่อยู่คนอื่นได้
const LINK_ERROR = "ลิงก์หมดอายุหรือไม่ถูกต้อง — กดปุ่ม \"กรอกที่อยู่\" จากแชท LINE อีกครั้งครับ";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const link = verifyAddressLink({
      u: searchParams.get("u"),
      d: searchParams.get("d"),
      e: searchParams.get("e"),
      sig: searchParams.get("sig"),
    });
    if (!link) return NextResponse.json({ ok: false, error: LINK_ERROR }, { status: 403 });

    const { data } = await getAllDatabase();
    const matched = (data.users || []).find((u) => u.lineUserId === link.lineUserId);
    const product = link.draft ? data.products.find((p) => p.id === link.draft?.productId) : undefined;

    return NextResponse.json({
      ok: true,
      user: matched
        ? {
            customerName:
              `${matched.firstName || ""} ${matched.lastName || ""}`.trim() || matched.displayName || "",
            phone: matched.phone || "",
            address: matched.address || "",
            mapsUrl: matched.mapsUrl || "",
            latitude: matched.latitude,
            longitude: matched.longitude,
          }
        : null,
      booking: product && link.draft ? { productName: product.name, qty: link.draft.qty } : null,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const link = verifyAddressLink({ u: body.u, d: body.d, e: body.e, sig: body.sig });
    if (!link) return NextResponse.json({ ok: false, error: LINK_ERROR }, { status: 403 });

    const trimmedName = String(body.customerName || "").trim();
    const cleanPhone = String(body.phone || "").replace(/[^\d]/g, "");
    if (!trimmedName || cleanPhone.length < 9 || cleanPhone.length > 10) {
      return NextResponse.json(
        { ok: false, error: "กรุณาระบุชื่อและเบอร์โทรศัพท์ 9-10 หลักให้ครบถ้วน" },
        { status: 400 }
      );
    }

    // ประกอบที่อยู่
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    let fullAddress = str(body.address);
    if (str(body.houseNo) && (str(body.subdistrict) || str(body.district) || str(body.province) || str(body.postalCode))) {
      fullAddress = [
        str(body.houseNo),
        str(body.subdistrict) ? `ต.${str(body.subdistrict)}` : "",
        str(body.district) ? `อ.${str(body.district)}` : "",
        str(body.province) ? `จ.${str(body.province)}` : "",
        str(body.postalCode),
      ]
        .filter(Boolean)
        .join(" ");
    }

    const lat = typeof body.latitude === "number" ? body.latitude : body.latitude ? parseFloat(body.latitude) : undefined;
    const lng = typeof body.longitude === "number" ? body.longitude : body.longitude ? parseFloat(body.longitude) : undefined;
    let mapsUrl = str(body.mapsUrl);
    if (mapsUrl && !/^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(mapsUrl)) {
      mapsUrl = "";
    }
    if (!mapsUrl && lat && lng) mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    if (mapsUrl && !fullAddress.includes(mapsUrl)) fullAddress += `\n📍 หมุดแผนที่: ${mapsUrl}`;

    if (fullAddress.replace(/\s/g, "").length < 8) {
      return NextResponse.json({ ok: false, error: "กรุณาระบุที่อยู่จัดส่งให้ชัดเจน" }, { status: 400 });
    }

    const user = await upsertLineUser({
      lineUserId: link.lineUserId,
      customerName: trimmedName,
      phone: cleanPhone,
      address: fullAddress.slice(0, 500),
      mapsUrl: mapsUrl || undefined,
      latitude: lat,
      longitude: lng,
      source: "web-form",
      notes: mapsUrl ? "กรอกผ่านฟอร์มพร้อมปักหมุด Google Maps" : "กรอกผ่านฟอร์มที่อยู่ออนไลน์",
    });

    // มีร่างการจองติดลิงก์มา → ส่งการ์ดยืนยันการจองเข้าแชททันที (ลูกค้ากดยืนยันต่อได้เลย ไม่ต้องเริ่มใหม่)
    const cfg = getRuntimeConfig();
    let sentReview = false;
    if (link.draft) {
      const { data } = await getAllDatabase();
      const product = data.products.find((p) => p.id === link.draft?.productId);
      if (product?.isAvailable) {
        clearLineSession(link.lineUserId);
        const res = await pushLineMessage(
          link.lineUserId,
          [
            { type: "text", text: "📍 บันทึกที่อยู่แล้วครับ ตรวจสอบแล้วกดยืนยันการจองได้เลย" },
            ...bookingReviewMessages(
              link.draft,
              product,
              { name: trimmedName, phone: cleanPhone, address: user.address || fullAddress },
              cfg.publicBaseUrl || "",
              link.lineUserId
            ),
          ],
          cfg.lineChannelAccessToken
        );
        sentReview = res.sent;
      }
    }
    if (!sentReview) {
      await pushLineMessage(
        link.lineUserId,
        [
          {
            type: "text",
            text: `🍈 บันทึกที่อยู่จัดส่งแล้วครับ\n👤 ${trimmedName}\n📞 ${cleanPhone}\n📍 ${fullAddress}\n\nกด "สั่งซื้อทุเรียน" เพื่อจองได้เลยครับ`,
            quickReply: buildMainQuickReply(),
          },
        ],
        cfg.lineChannelAccessToken
      );
    }

    return NextResponse.json({
      ok: true,
      customerName: trimmedName,
      phone: cleanPhone,
      address: fullAddress,
      mapsUrl,
      advancedOrder: sentReview,
    });
  } catch (err) {
    console.error("[API Address Error]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
