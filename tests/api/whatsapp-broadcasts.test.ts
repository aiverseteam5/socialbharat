import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/queue/queues", () => ({
  broadcastQueue: vi.fn(() => ({ add: vi.fn().mockResolvedValue(undefined) })),
}));

const VALID_TEMPLATE_ID = "11111111-1111-1111-1111-111111111111";
const VALID_CAMPAIGN_ID = "22222222-2222-2222-2222-222222222222";

interface State {
  user: { id: string } | null;
  orgRow: { org_id: string } | null;
  template: {
    id: string;
    body: string;
    variable_count: number;
    status: string;
  } | null;
  contacts: Array<{ id: string; created_at?: string }>;
  leadContactIds: string[];
  tagContactIds: string[];
  campaignInsertResult: { data: unknown; error: unknown };
  campaignSelect: {
    data: { id: string; status: string } | null;
    error: unknown;
  };
  campaignDetail: { data: unknown; error: unknown };
  recipientsList: {
    data: Array<Record<string, unknown>>;
    error: unknown;
  };
  recipientsCountByStatus: Record<string, number>;
  recipientsInsertCalls: Array<unknown[]>;
  recipientsInsertError: unknown;
  cancelUpdate: {
    data: { id: string; status: string } | null;
    error: unknown;
  };
  campaignUpdates: Array<Record<string, unknown>>;
  recipientUpdateCalls: Array<{
    patch: Record<string, unknown>;
    eqs: Array<{ col: string; val: unknown }>;
  }>;
}

function defaults(): State {
  return {
    user: { id: "user-1" },
    orgRow: { org_id: "org-1" },
    template: {
      id: VALID_TEMPLATE_ID,
      body: "Hi {{1}}, get {{2}}",
      variable_count: 2,
      status: "approved",
    },
    contacts: [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
    leadContactIds: ["c1", "c2", "c3"],
    tagContactIds: ["c1", "c2", "c3"],
    campaignInsertResult: {
      data: {
        id: VALID_CAMPAIGN_ID,
        org_id: "org-1",
        status: "running",
        total_recipients: 3,
      },
      error: null,
    },
    campaignSelect: {
      data: { id: VALID_CAMPAIGN_ID, status: "running" },
      error: null,
    },
    campaignDetail: {
      data: {
        id: VALID_CAMPAIGN_ID,
        org_id: "org-1",
        status: "running",
        total_recipients: 3,
      },
      error: null,
    },
    recipientsList: { data: [{ id: "r1" }, { id: "r2" }], error: null },
    recipientsCountByStatus: {
      pending: 0,
      sent: 2,
      delivered: 0,
      read: 0,
      failed: 0,
      skipped: 1,
    },
    recipientsInsertCalls: [],
    recipientsInsertError: null,
    cancelUpdate: {
      data: { id: VALID_CAMPAIGN_ID, status: "cancelled" },
      error: null,
    },
    campaignUpdates: [],
    recipientUpdateCalls: [],
  };
}

function buildSupabaseMock(state: State) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: state.user } }),
    },
    from: (table: string) => {
      if (table === "org_members") {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({
                single: () =>
                  Promise.resolve({ data: state.orgRow, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "whatsapp_templates") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: state.template, error: null }),
            }),
          }),
        };
      }
      if (table === "contacts") {
        const queryBuilder = {
          eq: () => queryBuilder,
          is: () => queryBuilder,
          gte: () => queryBuilder,
          lte: () => queryBuilder,
          then: (resolve: (v: { data: unknown; error: unknown }) => unknown) =>
            resolve({ data: state.contacts, error: null }),
        };
        return {
          select: () => queryBuilder,
        };
      }
      if (table === "leads") {
        const queryBuilder = {
          eq: () => queryBuilder,
          in: () => queryBuilder,
          then: (resolve: (v: { data: unknown; error: unknown }) => unknown) =>
            resolve({
              data: state.leadContactIds.map((id) => ({ contact_id: id })),
              error: null,
            }),
        };
        return {
          select: () => queryBuilder,
        };
      }
      if (table === "conversations") {
        const queryBuilder = {
          eq: () => queryBuilder,
          overlaps: () => queryBuilder,
          then: (resolve: (v: { data: unknown; error: unknown }) => unknown) =>
            resolve({
              data: state.tagContactIds.map((id) => ({ contact_id: id })),
              error: null,
            }),
        };
        return {
          select: () => queryBuilder,
        };
      }
      if (table === "whatsapp_campaigns") {
        return {
          select: () => ({
            order: () =>
              Promise.resolve({
                data: [{ id: VALID_CAMPAIGN_ID, status: "running" }],
                error: null,
              }),
            eq: () => ({
              maybeSingle: () => Promise.resolve(state.campaignDetail),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve(state.campaignInsertResult),
            }),
          }),
          update: (patch: Record<string, unknown>) => {
            state.campaignUpdates.push(patch);
            return {
              eq: () => ({
                in: () => ({
                  select: () => ({
                    maybeSingle: () => Promise.resolve(state.cancelUpdate),
                  }),
                }),
              }),
            };
          },
        };
      }
      if (table === "whatsapp_broadcast_recipients") {
        const recipientsCountChain = () => {
          const chain = {
            eq: (col: string, val: unknown) => {
              if (col === "status") {
                return Promise.resolve({
                  count: state.recipientsCountByStatus[val as string] ?? 0,
                  error: null,
                });
              }
              return chain;
            },
          };
          return chain;
        };
        return {
          select: (
            _cols: string,
            opts?: { count?: string; head?: boolean },
          ) => {
            if (opts?.count === "exact" && opts?.head) {
              return recipientsCountChain();
            }
            return {
              eq: () => ({
                order: () => ({
                  range: () => Promise.resolve(state.recipientsList),
                }),
              }),
            };
          },
          insert: (rows: unknown[]) => {
            state.recipientsInsertCalls.push(rows);
            return Promise.resolve({ error: state.recipientsInsertError });
          },
          update: (patch: Record<string, unknown>) => {
            const eqs: Array<{ col: string; val: unknown }> = [];
            const call = { patch, eqs };
            state.recipientUpdateCalls.push(call);
            const chain = {
              eq: (col: string, val: unknown) => {
                eqs.push({ col, val });
                return chain;
              },
              then: (resolve: (v: { error: unknown }) => unknown) =>
                resolve({ error: null }),
            };
            return chain;
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
}

async function loadCreate() {
  return await import("@/app/api/whatsapp/broadcasts/route");
}

async function loadDetail() {
  return await import("@/app/api/whatsapp/broadcasts/[id]/route");
}

async function loadCancel() {
  return await import("@/app/api/whatsapp/broadcasts/[id]/cancel/route");
}

describe("POST /api/whatsapp/broadcasts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("resolves segment, inserts recipients, enqueues fan-out", async () => {
    const state = defaults();
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { broadcastQueue } = await import("@/lib/queue/queues");
    const addMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(broadcastQueue).mockReturnValue({ add: addMock } as never);

    const { POST } = await loadCreate();
    const req = new Request("http://localhost/api/whatsapp/broadcasts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        template_id: VALID_TEMPLATE_ID,
        name: "Diwali sale",
        segment_filter: { lead_status: ["New"] },
        template_variables: { "1": "Diwali", "2": "20%" },
      }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);

    expect(state.recipientsInsertCalls).toHaveLength(1);
    const inserted = state.recipientsInsertCalls[0]!;
    expect(inserted).toHaveLength(3);
    expect(inserted[0]).toMatchObject({
      campaign_id: VALID_CAMPAIGN_ID,
      org_id: "org-1",
      status: "pending",
    });

    expect(addMock).toHaveBeenCalledTimes(1);
    expect(addMock).toHaveBeenCalledWith(
      "fan-out",
      expect.objectContaining({
        kind: "fan-out",
        campaignId: VALID_CAMPAIGN_ID,
        orgId: "org-1",
      }),
      expect.objectContaining({ delay: undefined }),
    );
  });

  it("excludes contacts that fail the lead_status intersection", async () => {
    const state = defaults();
    state.contacts = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];
    state.leadContactIds = ["c1"]; // only c1 matches lead_status
    state.tagContactIds = ["c1", "c2", "c3"];
    state.campaignInsertResult = {
      data: {
        id: VALID_CAMPAIGN_ID,
        org_id: "org-1",
        status: "running",
        total_recipients: 1,
      },
      error: null,
    };

    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { POST } = await loadCreate();
    const req = new Request("http://localhost/api/whatsapp/broadcasts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        template_id: VALID_TEMPLATE_ID,
        name: "x",
        segment_filter: { lead_status: ["New"], tags: ["vip"] },
        template_variables: { "1": "a", "2": "b" },
      }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(state.recipientsInsertCalls[0]).toHaveLength(1);
    expect(state.recipientsInsertCalls[0]![0]).toMatchObject({
      contact_id: "c1",
    });
  });

  it("400s when template body has more variables than payload provides", async () => {
    const state = defaults();
    // template wants 2 vars but we only send 1
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { POST } = await loadCreate();
    const req = new Request("http://localhost/api/whatsapp/broadcasts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        template_id: VALID_TEMPLATE_ID,
        name: "x",
        segment_filter: { lead_status: ["New"] },
        template_variables: { "1": "a" },
      }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    expect(state.recipientsInsertCalls).toHaveLength(0);
  });

  it("400s when template is not approved", async () => {
    const state = defaults();
    state.template = {
      id: VALID_TEMPLATE_ID,
      body: "Hi.",
      variable_count: 0,
      status: "paused",
    };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { POST } = await loadCreate();
    const req = new Request("http://localhost/api/whatsapp/broadcasts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        template_id: VALID_TEMPLATE_ID,
        name: "x",
        segment_filter: { lead_status: ["New"] },
      }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("404s when template not found", async () => {
    const state = defaults();
    state.template = null;
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { POST } = await loadCreate();
    const req = new Request("http://localhost/api/whatsapp/broadcasts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        template_id: VALID_TEMPLATE_ID,
        name: "x",
        segment_filter: { lead_status: ["New"] },
      }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(404);
  });

  it("400s when segment matches zero recipients", async () => {
    const state = defaults();
    state.contacts = [];
    state.leadContactIds = [];
    state.tagContactIds = [];
    state.template = {
      id: VALID_TEMPLATE_ID,
      body: "Hi.",
      variable_count: 0,
      status: "approved",
    };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { POST } = await loadCreate();
    const req = new Request("http://localhost/api/whatsapp/broadcasts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        template_id: VALID_TEMPLATE_ID,
        name: "x",
        segment_filter: { lead_status: ["New"] },
      }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("delays the job when scheduled_at is in the future", async () => {
    const state = defaults();
    state.template = {
      id: VALID_TEMPLATE_ID,
      body: "Hi.",
      variable_count: 0,
      status: "approved",
    };
    const future = new Date(Date.now() + 60_000).toISOString();

    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { broadcastQueue } = await import("@/lib/queue/queues");
    const addMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(broadcastQueue).mockReturnValue({ add: addMock } as never);

    const { POST } = await loadCreate();
    const req = new Request("http://localhost/api/whatsapp/broadcasts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        template_id: VALID_TEMPLATE_ID,
        name: "x",
        segment_filter: { lead_status: ["New"] },
        scheduled_at: future,
      }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);

    expect(addMock).toHaveBeenCalledTimes(1);
    const opts = addMock.mock.calls[0]![2] as { delay?: number };
    expect(opts.delay).toBeGreaterThan(0);
  });

  it("401s when unauthenticated", async () => {
    const state = defaults();
    state.user = null;
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { POST } = await loadCreate();
    const req = new Request("http://localhost/api/whatsapp/broadcasts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        template_id: VALID_TEMPLATE_ID,
        name: "x",
        segment_filter: { lead_status: ["New"] },
      }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("rejects an empty segment filter", async () => {
    const state = defaults();
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { POST } = await loadCreate();
    const req = new Request("http://localhost/api/whatsapp/broadcasts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        template_id: VALID_TEMPLATE_ID,
        name: "x",
        segment_filter: {},
      }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/whatsapp/broadcasts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns campaign + recipients + counts", async () => {
    const state = defaults();
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { GET } = await loadDetail();
    const req = new Request(
      `http://localhost/api/whatsapp/broadcasts/${VALID_CAMPAIGN_ID}`,
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ id: VALID_CAMPAIGN_ID }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      campaign: { id: string };
      recipients: Array<{ id: string }>;
      counts: Record<string, number>;
    };
    expect(body.campaign.id).toBe(VALID_CAMPAIGN_ID);
    expect(body.recipients).toHaveLength(2);
    expect(body.counts.sent).toBe(2);
    expect(body.counts.skipped).toBe(1);
  });

  it("returns 404 when campaign not found", async () => {
    const state = defaults();
    state.campaignDetail = { data: null, error: null };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { GET } = await loadDetail();
    const req = new Request(
      `http://localhost/api/whatsapp/broadcasts/${VALID_CAMPAIGN_ID}`,
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ id: VALID_CAMPAIGN_ID }),
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/whatsapp/broadcasts/[id]/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("cancels a running campaign and skips pending recipients", async () => {
    const state = defaults();
    state.campaignDetail = {
      data: { id: VALID_CAMPAIGN_ID, status: "running" },
      error: null,
    };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { POST } = await loadCancel();
    const res = await POST(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: VALID_CAMPAIGN_ID }),
    });
    expect(res.status).toBe(200);

    expect(state.campaignUpdates).toHaveLength(1);
    expect(state.campaignUpdates[0]).toMatchObject({ status: "cancelled" });

    // Recipients update was called to mark pending → skipped.
    const skipCall = state.recipientUpdateCalls.find(
      (c) => c.patch.status === "skipped",
    );
    expect(skipCall).toBeTruthy();
    expect(
      skipCall!.eqs.some((e) => e.col === "status" && e.val === "pending"),
    ).toBe(true);
  });

  it("returns 409 when campaign is already terminal", async () => {
    const state = defaults();
    state.campaignDetail = {
      data: { id: VALID_CAMPAIGN_ID, status: "completed" },
      error: null,
    };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { POST } = await loadCancel();
    const res = await POST(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: VALID_CAMPAIGN_ID }),
    });
    expect(res.status).toBe(409);
    expect(state.campaignUpdates).toHaveLength(0);
  });

  it("returns 404 when campaign does not exist", async () => {
    const state = defaults();
    state.campaignDetail = { data: null, error: null };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { POST } = await loadCancel();
    const res = await POST(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: VALID_CAMPAIGN_ID }),
    });
    expect(res.status).toBe(404);
  });
});
