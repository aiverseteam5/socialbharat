import { createHmac, timingSafeEqual } from "crypto";

/**
 * Constant-time compare of two hex digest strings.
 * Returns false if lengths differ (before comparing bytes).
 */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * Verify a Razorpay webhook signature.
 * Razorpay signs the raw request body with HMAC-SHA256 using the webhook secret
 * and sends the hex digest in the `X-Razorpay-Signature` header.
 *
 * @param rawBody - The raw request body as a string (must be the exact bytes Razorpay signed)
 * @param signature - Value of the `X-Razorpay-Signature` header
 * @param secret - The webhook secret configured in Razorpay dashboard (RAZORPAY_WEBHOOK_SECRET)
 * @returns true when the signature matches
 */
export function verifyRazorpaySignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

/**
 * Verify a Meta (Facebook / Instagram / WhatsApp Cloud) webhook signature.
 * Meta signs the raw request body with HMAC-SHA256 using the app secret
 * and sends `sha256=<hex>` in the `X-Hub-Signature-256` header.
 *
 * @param rawBody - The raw request body as a string (must be the exact bytes Meta signed)
 * @param signatureHeader - Value of the `X-Hub-Signature-256` header (e.g. "sha256=abcd...")
 * @param appSecret - The Meta app secret (META_APP_SECRET or WHATSAPP app secret)
 * @returns true when the signature matches
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader || !appSecret) return false;
  const prefix = "sha256=";
  if (!signatureHeader.startsWith(prefix)) return false;
  const received = signatureHeader.slice(prefix.length);
  const expected = createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");
  return safeEqualHex(expected, received);
}
