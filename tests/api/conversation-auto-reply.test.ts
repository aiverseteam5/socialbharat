import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

interface State {
  user: { id: string } | null;
  updateCalls: Array<Record<string, unknown>>;
  updateResult: {
    data: { id: string; auto_reply_paused_at: string | null } | null;
    error: { message?: string } | null;
  };
}

function defaultState(): State {
  return {
    user: { id: "user-1" },
    updateCalls: [],
    updateResult: {
      data: { id: "conv-1", auto_reply_paused_at: null },
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
      if (table !== "conversations") {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        update: (patch: Record<string, unknown>) => {
          state.updateCalls.push(patch);
          return {
            eq: () => ({
              select: () => ({
                maybeSingle: () => Promise.resolve(state.updateResult),
              }),
            }),
          };
        },
      };
    },
  };
}

const params = Promise.resolve({ id: "conv-1" });

describe("POST /api/inbox/conversations/[id]/auto-reply (pause)", () => {
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

    const { POST } =
      await import("@/app/api/inbox/conversations/[id]/auto-reply/route");
    const res = await POST(new Request("http://x") as never, { params });
    expect(res.status).toBe(401);
  });

  it("stamps auto_reply_paused_at with the current time", async () => {
    const state = defaultState();
    state.updateResult = {
      data: { id: "conv-1", auto_reply_paused_at: "2026-04-28T12:00:00Z" },
      error: null,
    };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { POST } =
      await import("@/app/api/inbox/conversations/[id]/auto-reply/route");
    const res = await POST(new Request("http://x") as never, { params });
    expect(res.status).toBe(200);
    expect(state.updateCalls).toHaveLength(1);
    const patch = state.updateCalls[0]!;
    expect(typeof patch.auto_reply_paused_at).toBe("string");
    expect(typeof patch.updated_at).toBe("string");
  });

  it("404s when no row is matched (RLS or missing id)", async () => {
    const state = defaultState();
    state.updateResult = { data: null, error: null };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { POST } =
      await import("@/app/api/inbox/conversations/[id]/auto-reply/route");
    const res = await POST(new Request("http://x") as never, { params });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/inbox/conversations/[id]/auto-reply (resume)", () => {
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

    const { DELETE } =
      await import("@/app/api/inbox/conversations/[id]/auto-reply/route");
    const res = await DELETE(new Request("http://x") as never, { params });
    expect(res.status).toBe(401);
  });

  it("clears auto_reply_paused_at to null", async () => {
    const state = defaultState();
    state.updateResult = {
      data: { id: "conv-1", auto_reply_paused_at: null },
      error: null,
    };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { DELETE } =
      await import("@/app/api/inbox/conversations/[id]/auto-reply/route");
    const res = await DELETE(new Request("http://x") as never, { params });
    expect(res.status).toBe(200);
    expect(state.updateCalls).toHaveLength(1);
    expect(state.updateCalls[0]).toMatchObject({
      auto_reply_paused_at: null,
    });
  });

  it("404s when no row is matched", async () => {
    const state = defaultState();
    state.updateResult = { data: null, error: null };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { DELETE } =
      await import("@/app/api/inbox/conversations/[id]/auto-reply/route");
    const res = await DELETE(new Request("http://x") as never, { params });
    expect(res.status).toBe(404);
  });
});
