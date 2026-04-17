import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/razorpay", () => ({
  verifyWebhookSignature: (secret: string, body: string, sig: string) => {
    const hmac = createHmac("sha256", secret).update(body).digest("hex");
    return hmac === sig;
  },
  createOrder: vi.fn(),
  cancelSubscription: vi.fn(),
}));

vi.mock("@/lib/invoice", () => ({
  generateInvoice: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function buildRequest(body: string, signature: string): Request {
  return new Request("http://localhost/api/billing/webhook/razorpay", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": signature,
    },
    body,
  });
}

describe("POST /api/billing/webhook/razorpay", () => {
  const originalSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";
  });

  afterEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = originalSecret;
  });

  it("returns 400 when signature header is missing", async () => {
    const { POST } = await import("@/app/api/billing/webhook/razorpay/route");
    const req = new Request("http://localhost/api/billing/webhook/razorpay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "payment.captured" }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when signature is invalid", async () => {
    const { POST } = await import("@/app/api/billing/webhook/razorpay/route");
    const body = JSON.stringify({ event: "payment.captured" });
    const res = await POST(buildRequest(body, "deadbeef") as never);
    expect(res.status).toBe(400);
  });

  it("returns 200 with duplicate=true when event_id already recorded", async () => {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "row-1" }, error: null });
    const eq2 = vi.fn(() => ({ maybeSingle }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const from = vi.fn(() => ({ select }));
    vi.mocked(createServiceClient).mockReturnValue({
      from,
    } as unknown as ReturnType<typeof createServiceClient>);

    const { POST } = await import("@/app/api/billing/webhook/razorpay/route");
    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_dup",
            amount: 100000,
            currency: "INR",
            notes: { org_id: "org-1", plan: "pro" },
          },
        },
      },
    };
    const body = JSON.stringify(payload);
    const sig = sign(body, "test_webhook_secret");
    const res = await POST(buildRequest(body, sig) as never);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { duplicate?: boolean };
    expect(json.duplicate).toBe(true);
  });

  it("returns 500 when handler throws (event_id not inserted)", async () => {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq2 = vi.fn(() => ({ maybeSingle }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));

    // organizations.update().eq() — simulate DB error
    const orgUpdateEq = vi
      .fn()
      .mockResolvedValue({ error: { message: "boom" } });
    const update = vi.fn(() => ({ eq: orgUpdateEq }));
    const insert = vi.fn();

    const from = vi.fn((table: string) => {
      if (table === "webhook_events") {
        return { select, insert };
      }
      return { update };
    });
    vi.mocked(createServiceClient).mockReturnValue({
      from,
    } as unknown as ReturnType<typeof createServiceClient>);

    const { POST } = await import("@/app/api/billing/webhook/razorpay/route");
    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_err",
            amount: 100000,
            currency: "INR",
            notes: {
              org_id: "org-1",
              plan: "pro",
              billing_cycle: "monthly",
              base_amount: "100000",
            },
          },
        },
      },
    };
    const body = JSON.stringify(payload);
    const sig = sign(body, "test_webhook_secret");
    const res = await POST(buildRequest(body, sig) as never);
    expect(res.status).toBe(500);
    expect(insert).not.toHaveBeenCalled();
  });
});
