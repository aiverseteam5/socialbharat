import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const APP_SECRET = "test-meta-app-secret";

function base64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeSignedRequest(
  payload: Record<string, unknown>,
  secret: string,
): string {
  const encodedPayload = base64Url(Buffer.from(JSON.stringify(payload)));
  const signature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest();
  return `${base64Url(signature)}.${encodedPayload}`;
}

function formReq(body: Record<string, string>): Request {
  const form = new URLSearchParams(body);
  return new Request("http://localhost/api/auth/data-deletion", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
}

function jsonReq(body: unknown): Request {
  return new Request("http://localhost/api/auth/data-deletion", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/data-deletion", () => {
  const originalSecret = process.env.META_APP_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.META_APP_SECRET = APP_SECRET;
  });

  afterEach(() => {
    process.env.META_APP_SECRET = originalSecret;
  });

  it("returns 503 when META_APP_SECRET is not configured", async () => {
    delete process.env.META_APP_SECRET;
    const { POST } = await import("@/app/api/auth/data-deletion/route");
    const signed = makeSignedRequest(
      { algorithm: "HMAC-SHA256", user_id: "fb-1" },
      APP_SECRET,
    );
    const res = await POST(formReq({ signed_request: signed }) as never);
    expect(res.status).toBe(503);
  });

  it("returns 400 when signed_request is missing", async () => {
    const { POST } = await import("@/app/api/auth/data-deletion/route");
    const res = await POST(formReq({}) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("missing_signed_request");
  });

  it("returns 400 when signature is invalid", async () => {
    const { POST } = await import("@/app/api/auth/data-deletion/route");
    const signed = makeSignedRequest(
      { algorithm: "HMAC-SHA256", user_id: "fb-1" },
      "wrong-secret",
    );
    const res = await POST(formReq({ signed_request: signed }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_signed_request");
  });

  it("returns 400 when signed_request format is malformed", async () => {
    const { POST } = await import("@/app/api/auth/data-deletion/route");
    const res = await POST(
      formReq({ signed_request: "not-a-valid-request" }) as never,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when algorithm is not HMAC-SHA256", async () => {
    const { POST } = await import("@/app/api/auth/data-deletion/route");
    const signed = makeSignedRequest(
      { algorithm: "MD5", user_id: "fb-1" },
      APP_SECRET,
    );
    const res = await POST(formReq({ signed_request: signed }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when payload has no user_id", async () => {
    const { POST } = await import("@/app/api/auth/data-deletion/route");
    const signed = makeSignedRequest({ algorithm: "HMAC-SHA256" }, APP_SECRET);
    const res = await POST(formReq({ signed_request: signed }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 200 with confirmation when signature is valid (form body)", async () => {
    const { POST } = await import("@/app/api/auth/data-deletion/route");
    const signed = makeSignedRequest(
      {
        algorithm: "HMAC-SHA256",
        user_id: "fb-abc-123",
        issued_at: 1714000000,
      },
      APP_SECRET,
    );
    const res = await POST(formReq({ signed_request: signed }) as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      url: string;
      confirmation_code: string;
    };
    expect(body.confirmation_code).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(body.url).toContain("/data-deletion?code=");
    expect(body.url).toContain(body.confirmation_code);
  });

  it("returns 200 with confirmation when signature is valid (JSON body)", async () => {
    const { POST } = await import("@/app/api/auth/data-deletion/route");
    const signed = makeSignedRequest(
      { algorithm: "HMAC-SHA256", user_id: "fb-json" },
      APP_SECRET,
    );
    const res = await POST(jsonReq({ signed_request: signed }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.confirmation_code).toBeTruthy();
  });

  it("logs the deletion request with the Facebook user_id", async () => {
    const { logger } = await import("@/lib/logger");
    const { POST } = await import("@/app/api/auth/data-deletion/route");
    const signed = makeSignedRequest(
      { algorithm: "HMAC-SHA256", user_id: "fb-logged-user" },
      APP_SECRET,
    );
    await POST(formReq({ signed_request: signed }) as never);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("data deletion"),
      expect.objectContaining({ fb_user_id: "fb-logged-user" }),
    );
  });
});
