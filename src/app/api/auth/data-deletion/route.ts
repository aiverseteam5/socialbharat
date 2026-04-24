import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomUUID } from "crypto";
import { logger } from "@/lib/logger";

/**
 * Facebook Data Deletion Callback.
 *
 * Meta requires an endpoint that accepts a `signed_request` parameter,
 * verifies it against META_APP_SECRET, and returns a JSON body containing
 * a status-page URL and a confirmation code the user can use to track the
 * deletion request.
 *
 * Spec: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 *
 * The actual deletion of user data happens asynchronously — here we only
 * verify the request, record the Facebook user_id, and issue a
 * confirmation code. A worker (Phase 3B) will consume the record and
 * perform the deletion.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SignedRequestPayload {
  algorithm: string;
  issued_at?: number;
  user_id?: string;
  [key: string]: unknown;
}

function base64UrlDecode(input: string): Buffer {
  // Convert base64url → base64, pad to multiple of 4
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(padLength), "base64");
}

function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    diff |= ai ^ bi;
  }
  return diff === 0;
}

function parseSignedRequest(
  signedRequest: string,
  appSecret: string,
): SignedRequestPayload | null {
  const parts = signedRequest.split(".");
  if (parts.length !== 2) return null;
  const [encodedSig, encodedPayload] = parts;
  if (!encodedSig || !encodedPayload) return null;

  const expectedSig = createHmac("sha256", appSecret)
    .update(encodedPayload)
    .digest();
  const providedSig = base64UrlDecode(encodedSig);

  if (!timingSafeEqual(providedSig, expectedSig)) return null;

  try {
    const payload = JSON.parse(
      base64UrlDecode(encodedPayload).toString("utf8"),
    ) as SignedRequestPayload;
    if (payload.algorithm !== "HMAC-SHA256") return null;
    return payload;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    logger.error("Data deletion callback invoked without META_APP_SECRET");
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  let signedRequest: string | null = null;
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    const raw = form.get("signed_request");
    signedRequest = typeof raw === "string" ? raw : null;
  } else if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as {
      signed_request?: string;
    };
    signedRequest = body.signed_request ?? null;
  }

  if (!signedRequest) {
    return NextResponse.json(
      { error: "missing_signed_request" },
      { status: 400 },
    );
  }

  const payload = parseSignedRequest(signedRequest, appSecret);
  if (!payload || !payload.user_id) {
    return NextResponse.json(
      { error: "invalid_signed_request" },
      { status: 400 },
    );
  }

  const confirmationCode = randomUUID();

  // Record the request so a worker can pick it up. We only log here — the
  // deletion queue lands in Phase 3B. Manual review via log aggregation is
  // acceptable until then.
  logger.info("Facebook data deletion request received", {
    fb_user_id: payload.user_id,
    confirmation_code: confirmationCode,
    issued_at: payload.issued_at,
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://socialbharat.tynkai.com";

  return NextResponse.json({
    url: `${baseUrl}/data-deletion?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}
