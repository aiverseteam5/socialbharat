import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Job } from "bullmq";
import type { BroadcastJobData } from "@/lib/queue/queues";

/**
 * V3 Phase 4E — broadcast worker tests.
 *
 * `handleBroadcastJob` is exercised directly. Supabase, encryption, the
 * WhatsApp connector, and the broadcast queue are all mocked so the test
 * doesn't need Redis or Postgres.
 */

// ── Supabase mock — table-by-table builder ──────────────────────────────────

interface RecipientRow {
  id: string;
  campaign_id?: string;
  contact_id: string;
  status: string;
}

interface CampaignRow {
  id: string;
  template_id: string;
  template_variables?: Record<string, string> | null;
  status: string;
  total_recipients?: number;
  sent_count?: number;
  failed_count?: number;
}

interface ContactRow {
  id: string;
  platform_user_id: string;
  opted_out_at: string | null;
}

interface TemplateRow {
  name: string;
  language: string;
  variable_count: number;
}

interface ProfileRow {
  access_token_encrypted: string;
  metadata: { phone_number_id?: string };
}

interface DBState {
  recipients: Record<string, RecipientRow>;
  recipientUpdates: Array<{ id: string; patch: Record<string, unknown> }>;
  pendingForFanOut: Array<{ id: string }>;
  campaign: CampaignRow | null;
  campaignUpdates: Array<Record<string, unknown>>;
  contact: ContactRow | null;
  template: TemplateRow | null;
  profile: ProfileRow | null;
  // count() result for terminal recipients (used by completion check)
  terminalCount: number;
}

const db: DBState = {
  recipients: {},
  recipientUpdates: [],
  pendingForFanOut: [],
  campaign: null,
  campaignUpdates: [],
  contact: null,
  template: null,
  profile: null,
  terminalCount: 0,
};

function reset() {
  db.recipients = {};
  db.recipientUpdates = [];
  db.pendingForFanOut = [];
  db.campaign = null;
  db.campaignUpdates = [];
  db.contact = null;
  db.template = null;
  db.profile = null;
  db.terminalCount = 0;
}

// Reused builders so chained calls return predictable shapes.
function recipientsTable() {
  return {
    select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
      // Variant A: head/count (used by checkCampaignCompletion)
      if (opts?.head) {
        return {
          eq: () => ({
            in: () =>
              Promise.resolve({
                count: db.terminalCount,
                error: null,
              }),
          }),
        };
      }
      // Variant B: range query (used by fan-out paging) — needs eq().eq().order().range()
      // Variant C: maybeSingle (used by send-one to load recipient)
      return {
        eq: (_c: string, v: string) => ({
          // For send-one path: .eq("id", recipientId).maybeSingle()
          maybeSingle: () => {
            const row = db.recipients[v] ?? null;
            return Promise.resolve({ data: row, error: null });
          },
          // For fan-out path: .eq("campaign_id", id).eq("status", "pending").order().range()
          eq: () => ({
            order: () => ({
              range: (start: number, end: number) => {
                const slice = db.pendingForFanOut.slice(start, end + 1);
                return Promise.resolve({ data: slice, error: null });
              },
            }),
          }),
        }),
      };
    },
    update: (patch: Record<string, unknown>) => ({
      eq: (_c: string, id: string) => {
        db.recipientUpdates.push({ id, patch });
        if (db.recipients[id]) {
          db.recipients[id] = {
            ...db.recipients[id]!,
            ...(patch as Partial<RecipientRow>),
          };
        }
        return Promise.resolve({ data: null, error: null });
      },
    }),
  };
}

function campaignsTable() {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: db.campaign, error: null }),
      }),
    }),
    update: (patch: Record<string, unknown>) => {
      db.campaignUpdates.push(patch);
      // First chained .eq("id", ...) — second optional .eq("status", ...) — sometimes followed by select().maybeSingle()
      const finalize = () => Promise.resolve({ data: null, error: null });
      const eq2 = {
        eq: () => finalize(),
        in: () => ({
          select: () => ({
            maybeSingle: () => {
              if (db.campaign && Object.hasOwn(patch, "status")) {
                db.campaign.status = patch.status as string;
              }
              return Promise.resolve({
                data: db.campaign
                  ? { id: db.campaign.id, status: db.campaign.status }
                  : null,
                error: null,
              });
            },
          }),
        }),
      };
      // Apply patch to in-memory campaign so subsequent reads see it
      if (db.campaign) {
        db.campaign = { ...db.campaign, ...(patch as Partial<CampaignRow>) };
      }
      return {
        eq: () => eq2,
      };
    },
  };
}

function contactsTable() {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: db.contact, error: null }),
      }),
    }),
  };
}

function templatesTable() {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: db.template, error: null }),
      }),
    }),
  };
}

function profilesTable() {
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          limit: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: db.profile, error: null }),
          }),
        }),
      }),
    }),
  };
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      switch (table) {
        case "whatsapp_broadcast_recipients":
          return recipientsTable();
        case "whatsapp_campaigns":
          return campaignsTable();
        case "contacts":
          return contactsTable();
        case "whatsapp_templates":
          return templatesTable();
        case "social_profiles":
          return profilesTable();
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    },
  }),
}));

vi.mock("@/lib/encryption", () => ({
  decrypt: (s: string) => `decrypted:${s}`,
}));

const sendTemplateMock = vi.fn();
vi.mock("@/lib/platforms/whatsapp", () => ({
  WhatsAppConnector: class {
    sendTemplate = sendTemplateMock;
  },
}));

// Capture queued send-one jobs so we can assert fan-out behavior.
const addBulkMock = vi.fn();
vi.mock("@/lib/queue/queues", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/queue/queues")>(
      "@/lib/queue/queues",
    );
  return {
    ...actual,
    broadcastQueue: () => ({ addBulk: addBulkMock }),
  };
});

import { handleBroadcastJob } from "@/lib/queue/workers/broadcast-worker";

function makeJob(data: BroadcastJobData): Job<BroadcastJobData> {
  return { id: "j1", data } as unknown as Job<BroadcastJobData>;
}

describe("broadcast-worker — fan-out", () => {
  beforeEach(() => {
    reset();
    addBulkMock.mockReset();
    addBulkMock.mockResolvedValue([]);
  });

  it("transitions a scheduled campaign to running and enqueues one send-one per recipient", async () => {
    db.campaign = {
      id: "camp-1",
      template_id: "tpl-1",
      status: "scheduled",
      total_recipients: 3,
    };
    db.pendingForFanOut = [{ id: "r-1" }, { id: "r-2" }, { id: "r-3" }];

    await handleBroadcastJob(
      makeJob({ kind: "fan-out", campaignId: "camp-1", orgId: "org-1" }),
    );

    expect(addBulkMock).toHaveBeenCalledTimes(1);
    const queued = addBulkMock.mock.calls[0]![0] as Array<{
      data: BroadcastJobData;
    }>;
    expect(queued).toHaveLength(3);
    expect(queued.map((j) => j.data.recipientId)).toEqual([
      "r-1",
      "r-2",
      "r-3",
    ]);
    expect(queued.every((j) => j.data.kind === "send-one")).toBe(true);

    // Campaign was patched to running.
    const runningPatch = db.campaignUpdates.find((u) => u.status === "running");
    expect(runningPatch).toBeTruthy();
  });

  it("skips fan-out when the campaign is cancelled", async () => {
    db.campaign = null; // .update().in([scheduled,draft,running]) won't match
    db.pendingForFanOut = [{ id: "r-1" }];

    await handleBroadcastJob(
      makeJob({ kind: "fan-out", campaignId: "camp-1", orgId: "org-1" }),
    );

    expect(addBulkMock).not.toHaveBeenCalled();
  });
});

describe("broadcast-worker — send-one", () => {
  beforeEach(() => {
    reset();
    sendTemplateMock.mockReset();
    addBulkMock.mockReset();
    addBulkMock.mockResolvedValue([]);
  });

  function seedHappyPath() {
    db.recipients["r-1"] = {
      id: "r-1",
      campaign_id: "camp-1",
      contact_id: "c-1",
      status: "pending",
    };
    db.contact = {
      id: "c-1",
      platform_user_id: "+919876543210",
      opted_out_at: null,
    };
    db.campaign = {
      id: "camp-1",
      template_id: "tpl-1",
      template_variables: { "1": "Diwali", "2": "20%" },
      status: "running",
      total_recipients: 5,
      sent_count: 0,
      failed_count: 0,
    };
    db.template = {
      name: "festival_promo",
      language: "en",
      variable_count: 2,
    };
    db.profile = {
      access_token_encrypted: "cipher",
      metadata: { phone_number_id: "phone-1" },
    };
  }

  it("sends template, writes platform_message_id, and bumps sent counter", async () => {
    seedHappyPath();
    sendTemplateMock.mockResolvedValueOnce("wamid.ABC123");

    await handleBroadcastJob(
      makeJob({
        kind: "send-one",
        campaignId: "camp-1",
        recipientId: "r-1",
        orgId: "org-1",
      }),
    );

    expect(sendTemplateMock).toHaveBeenCalledTimes(1);
    const [phone, name, lang, components] = sendTemplateMock.mock.calls[0]!;
    expect(phone).toBe("+919876543210");
    expect(name).toBe("festival_promo");
    expect(lang).toBe("en");
    // body component with two text params built in {{N}} order
    expect(components).toEqual([
      {
        type: "body",
        parameters: [
          { type: "text", text: "Diwali" },
          { type: "text", text: "20%" },
        ],
      },
    ]);

    const sentPatch = db.recipientUpdates.find((u) => u.id === "r-1");
    expect(sentPatch?.patch).toMatchObject({
      status: "sent",
      platform_message_id: "wamid.ABC123",
    });

    const sentCounterBump = db.campaignUpdates.find((u) => u.sent_count === 1);
    expect(sentCounterBump).toBeTruthy();
  });

  it("skips a recipient whose contact opted out (race-window mitigation)", async () => {
    seedHappyPath();
    db.contact!.opted_out_at = "2026-04-25T00:00:00Z";

    await handleBroadcastJob(
      makeJob({
        kind: "send-one",
        campaignId: "camp-1",
        recipientId: "r-1",
        orgId: "org-1",
      }),
    );

    expect(sendTemplateMock).not.toHaveBeenCalled();
    const skippedPatch = db.recipientUpdates.find((u) => u.id === "r-1");
    expect(skippedPatch?.patch).toEqual({ status: "skipped" });
    // No counter bump — skipped is its own terminal state.
    expect(db.campaignUpdates.some((u) => u.sent_count !== undefined)).toBe(
      false,
    );
    expect(db.campaignUpdates.some((u) => u.failed_count !== undefined)).toBe(
      false,
    );
  });

  it("skips a recipient that is no longer pending (cancellation race)", async () => {
    seedHappyPath();
    db.recipients["r-1"]!.status = "skipped";

    await handleBroadcastJob(
      makeJob({
        kind: "send-one",
        campaignId: "camp-1",
        recipientId: "r-1",
        orgId: "org-1",
      }),
    );

    expect(sendTemplateMock).not.toHaveBeenCalled();
    expect(db.recipientUpdates).toHaveLength(0);
  });

  it("fails the recipient with VARIABLE_MISMATCH when a placeholder is missing", async () => {
    seedHappyPath();
    db.campaign!.template_variables = { "1": "Diwali" }; // {{2}} missing

    await handleBroadcastJob(
      makeJob({
        kind: "send-one",
        campaignId: "camp-1",
        recipientId: "r-1",
        orgId: "org-1",
      }),
    );

    expect(sendTemplateMock).not.toHaveBeenCalled();
    const failedPatch = db.recipientUpdates.find((u) => u.id === "r-1");
    expect(failedPatch?.patch).toMatchObject({
      status: "failed",
      error_code: "VARIABLE_MISMATCH",
    });
    const failedCounterBump = db.campaignUpdates.find(
      (u) => u.failed_count === 1,
    );
    expect(failedCounterBump).toBeTruthy();
  });

  it("fails the recipient and rethrows for retry when Meta send fails", async () => {
    seedHappyPath();
    sendTemplateMock.mockRejectedValueOnce(new Error("rate limited"));

    await expect(
      handleBroadcastJob(
        makeJob({
          kind: "send-one",
          campaignId: "camp-1",
          recipientId: "r-1",
          orgId: "org-1",
        }),
      ),
    ).rejects.toThrow(/rate limited/);

    const failedPatch = db.recipientUpdates.find((u) => u.id === "r-1");
    expect(failedPatch?.patch).toMatchObject({
      status: "failed",
      error_code: "META_SEND_FAILED",
    });
  });

  it("fails the recipient when the org has no WhatsApp profile", async () => {
    seedHappyPath();
    db.profile = null;

    await handleBroadcastJob(
      makeJob({
        kind: "send-one",
        campaignId: "camp-1",
        recipientId: "r-1",
        orgId: "org-1",
      }),
    );

    expect(sendTemplateMock).not.toHaveBeenCalled();
    const failedPatch = db.recipientUpdates.find((u) => u.id === "r-1");
    expect(failedPatch?.patch).toMatchObject({
      error_code: "WHATSAPP_NOT_CONNECTED",
    });
  });

  it("flips the campaign to completed once all recipients reach a terminal state", async () => {
    seedHappyPath();
    db.campaign!.total_recipients = 1;
    db.terminalCount = 1; // checkCampaignCompletion sees 1>=1 after this send
    sendTemplateMock.mockResolvedValueOnce("wamid.OK");

    await handleBroadcastJob(
      makeJob({
        kind: "send-one",
        campaignId: "camp-1",
        recipientId: "r-1",
        orgId: "org-1",
      }),
    );

    const completedPatch = db.campaignUpdates.find(
      (u) => u.status === "completed",
    );
    expect(completedPatch).toBeTruthy();
  });
});

describe("broadcast-worker — kind dispatch", () => {
  beforeEach(() => {
    reset();
  });

  it("throws on an unknown kind", async () => {
    await expect(
      handleBroadcastJob(
        makeJob({
          kind: "weird-kind" as unknown as "fan-out",
          campaignId: "x",
          orgId: "y",
        }),
      ),
    ).rejects.toThrow(/unknown kind/);
  });

  it("send-one without recipientId throws", async () => {
    await expect(
      handleBroadcastJob(
        makeJob({ kind: "send-one", campaignId: "x", orgId: "y" }),
      ),
    ).rejects.toThrow(/missing recipientId/);
  });
});
