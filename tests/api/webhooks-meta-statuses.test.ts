import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const applyStatusMock = vi.fn();
const processIncomingMock = vi.fn();
const resolveProfileMock = vi.fn();

vi.mock("@/lib/inbox/message-processor", () => ({
  applyMessageStatusUpdate: applyStatusMock,
  processIncomingMessage: processIncomingMock,
  resolveProfileByPlatformId: resolveProfileMock,
}));

const APP_SECRET = "test-meta-app-secret";

function sign(body: string, secret: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

function buildStatusPayload(status: string, id: string, ts: number) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-1",
        time: 0,
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                phone_number_id: "PN-1",
                display_phone_number: "+1234",
              },
              statuses: [
                {
                  id,
                  status,
                  recipient_id: "9198765xxxxx",
                  timestamp: String(ts),
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe("POST /api/webhooks/meta — WhatsApp status receipts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.META_APP_SECRET = APP_SECRET;
  });

  it("calls applyMessageStatusUpdate with the parsed status", async () => {
    const payload = buildStatusPayload("delivered", "wamid.ABC", 1_700_000_000);
    const body = JSON.stringify(payload);
    const sig = sign(body, APP_SECRET);

    const { POST } = await import("@/app/api/webhooks/meta/route");
    const req = new Request("http://localhost/api/webhooks/meta", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": sig,
      },
      body,
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);

    expect(applyStatusMock).toHaveBeenCalledTimes(1);
    expect(applyStatusMock).toHaveBeenCalledWith({
      platformMessageId: "wamid.ABC",
      status: "delivered",
      timestamp: new Date(1_700_000_000 * 1000),
    });
  });

  it("rejects payloads with invalid signature", async () => {
    const payload = buildStatusPayload("read", "wamid.X", 1_700_000_001);
    const body = JSON.stringify(payload);

    const { POST } = await import("@/app/api/webhooks/meta/route");
    const req = new Request("http://localhost/api/webhooks/meta", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": "sha256=deadbeef",
      },
      body,
    });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
    expect(applyStatusMock).not.toHaveBeenCalled();
  });

  it("ignores status values outside the known enum", async () => {
    const payload = buildStatusPayload(
      "weird_status",
      "wamid.Y",
      1_700_000_002,
    );
    const body = JSON.stringify(payload);
    const sig = sign(body, APP_SECRET);

    const { POST } = await import("@/app/api/webhooks/meta/route");
    const req = new Request("http://localhost/api/webhooks/meta", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": sig,
      },
      body,
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(applyStatusMock).not.toHaveBeenCalled();
  });
});
