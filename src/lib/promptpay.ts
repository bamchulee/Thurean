// ============================================================
// Thai PromptPay EMVCo QR Payload Builder (CRC16-CCITT)
// ============================================================

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function formatTarget(target: string): { subTag: string; value: string } {
  const digits = target.replace(/[^0-9]/g, "");
  // Mobile number (10 digits starting with 0) -> 0066 + 9 digits
  if (digits.length === 10 && digits.startsWith("0")) {
    return { subTag: "01", value: `0066${digits.slice(1)}` };
  }
  // National ID / Tax ID (13 digits)
  if (digits.length === 13) {
    return { subTag: "02", value: digits };
  }
  // e-Wallet ID (15 digits)
  return { subTag: "03", value: digits };
}

export function generatePromptPayPayload(
  target: string,
  amount?: number
): string {
  const { subTag, value } = formatTarget(target);
  const merchantInfo = tlv("00", "A000000677010111") + tlv(subTag, value);

  const hasAmount = typeof amount === "number" && amount > 0;
  let payload =
    tlv("00", "01") +
    tlv("01", hasAmount ? "12" : "11") +
    tlv("29", merchantInfo) +
    tlv("53", "764");

  if (hasAmount) {
    payload += tlv("54", amount.toFixed(2));
  }

  payload += tlv("58", "TH") + "6304";
  const checksum = crc16ccitt(payload);
  return payload + checksum;
}
