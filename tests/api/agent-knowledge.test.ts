import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

interface State {
  user: { id: string } | null;
  orgRow: { org_id: string } | null;
  selectResult: {
    data: { body: string; updated_at: string; updated_by: string } | null;
    error: { message?: string } | null;
  };
  upsertCalls: Array<Record<string, unknown>>;
  upsertResult: {
    data: { body: string; updated_at: string; updated_by: string } | null;
    error: { message?: string } | null;
  };
}

function defaultState(): State {
  return {
    user: { id: "user-1" },
    orgRow: { org_id: "org-1" },
    selectResult: { data: null, error: null },
    upsertCalls: [],
    upsertResult: {
      data: {
        body: "",
        updated_at: "2026-04-28T10:00:00Z",
        updated_by: "user-1",
      },
      error: null,
    },
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
      if (table === "org_agent_knowledge") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve(state.selectResult),
            }),
          }),
          upsert: (payload: Record<string, unknown>) => {
            state.upsertCalls.push(payload);
            return {
              select: () => ({
                single: () => Promise.resolve(state.upsertResult),
              }),
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
}

describe("GET /api/agent/knowledge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401s when unauthenticated", async () => {
    const state = defaultState();
    state.user = null;
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { GET } = await import("@/app/api/agent/knowledge/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("403s when caller has no org", async () => {
    const state = defaultState();
    state.orgRow = null;
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { GET } = await import("@/app/api/agent/knowledge/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns the org's knowledge body when present", async () => {
    const state = defaultState();
    state.selectResult = {
      data: {
        body: "Open Mon-Fri 9am-6pm IST.",
        updated_at: "2026-04-28T09:00:00Z",
        updated_by: "user-1",
      },
      error: null,
    };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { GET } = await import("@/app/api/agent/knowledge/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { body: string };
    expect(body.body).toBe("Open Mon-Fri 9am-6pm IST.");
  });

  it("returns empty string + null timestamps when knowledge has not been set yet", async () => {
    const state = defaultState();
    state.selectResult = { data: null, error: null };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { GET } = await import("@/app/api/agent/knowledge/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      body: string;
      updated_at: string | null;
    };
    expect(body.body).toBe("");
    expect(body.updated_at).toBeNull();
  });
});

describe("PUT /api/agent/knowledge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeRequest(body: unknown): Request {
    return new Request("http://localhost/api/agent/knowledge", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("401s when unauthenticated", async () => {
    const state = defaultState();
    state.user = null;
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { PUT } = await import("@/app/api/agent/knowledge/route");
    const res = await PUT(makeRequest({ body: "x" }) as never);
    expect(res.status).toBe(401);
  });

  it("upserts the org's knowledge body and stamps updated_by", async () => {
    const state = defaultState();
    state.upsertResult = {
      data: {
        body: "We ship pan-India.",
        updated_at: "2026-04-28T11:00:00Z",
        updated_by: "user-1",
      },
      error: null,
    };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { PUT } = await import("@/app/api/agent/knowledge/route");
    const res = await PUT(makeRequest({ body: "We ship pan-India." }) as never);
    expect(res.status).toBe(200);
    expect(state.upsertCalls).toHaveLength(1);
    expect(state.upsertCalls[0]).toMatchObject({
      org_id: "org-1",
      body: "We ship pan-India.",
      updated_by: "user-1",
    });
  });

  it("400s when body is over the 8000-char cap", async () => {
    const state = defaultState();
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { PUT } = await import("@/app/api/agent/knowledge/route");
    const res = await PUT(makeRequest({ body: "a".repeat(8001) }) as never);
    expect(res.status).toBe(400);
    expect(state.upsertCalls).toHaveLength(0);
  });

  it("400s when body field is missing", async () => {
    const state = defaultState();
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { PUT } = await import("@/app/api/agent/knowledge/route");
    const res = await PUT(makeRequest({}) as never);
    expect(res.status).toBe(400);
    expect(state.upsertCalls).toHaveLength(0);
  });

  it("accepts an empty string (clearing the body)", async () => {
    const state = defaultState();
    state.upsertResult = {
      data: {
        body: "",
        updated_at: "2026-04-28T11:00:00Z",
        updated_by: "user-1",
      },
      error: null,
    };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { PUT } = await import("@/app/api/agent/knowledge/route");
    const res = await PUT(makeRequest({ body: "" }) as never);
    expect(res.status).toBe(200);
    expect(state.upsertCalls[0]).toMatchObject({ body: "" });
  });
});
