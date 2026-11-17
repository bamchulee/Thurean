import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import QRCode from "qrcode";
import { getBankAccount, loadAppSettings } from "../../../lib/sheets-db";
import { generatePromptPayPayload } from "../../../lib/promptpay";

export const dynamic = "force-dynamic";

/**
 * Renders a scannable Thai PromptPay QR Code as PNG image for LINE Flex messages & receipts.
 * Example: GET /api/promptpay-qr?amount=1010
 */
export async function GET(req: NextRequest) {
  try {
    const rawAmount = req.nextUrl.searchParams.get("amount");
    const parsedAmount = rawAmount ? Number(rawAmount) : undefined;
    const validAmount =
      parsedAmount && Number.isFinite(parsedAmount) && parsedAmount > 0
        ? Math.round(parsedAmount * 100) / 100
        : undefined;

    await loadAppSettings();
    const payload = generatePromptPayPayload(
      getBankAccount().promptPay,
      validAmount
    );

    const pngBuffer = await QRCode.toBuffer(payload, {
      type: "png",
      width: 600,
      margin: 2,
      color: {
        dark: "#1B4D31",
        light: "#FFFFFF",
      },
    });

    return new NextResponse(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
