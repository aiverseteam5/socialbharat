import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

interface DeleteState {
  deleteCalls: Array<{ id: string }>;
  // Result of .delete().eq("id", id).select("id").maybeSingle()
  deleteResult: { data: { id: string } | null; error: unknown };
  unauthenticated?: boolean;
}

function buildSupabaseMock(state: DeleteState) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: state.unauthenticated ? null : { id: "user-1" } },
      }),
    },
    from: (table: string) => {
      if (table !== "leads") {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        delete: () => ({
          eq: (_col: string, id: string) => {
            state.deleteCalls.push({ id });
            return {
              select: () => ({
                maybeSingle: () => Promise.resolve(state.deleteResult),
              }),
            };
          },
        }),
      };
    },
  };
}

async function callDelete(
  id: string,
  mock: ReturnType<typeof buildSupabaseMock>,
) {
  const { createClient } = await import("@/lib/supabase/server");
  vi.mocked(createClient).mockResolvedValue(mock as never);
  const { DELETE } = await import("@/app/api/leads/[id]/route");
  return DELETE(
    new Request(`http://localhost/api/leads/${id}`, {
      method: "DELETE",
    }) as never,
    {
      params: Promise.resolve({ id }),
    },
  );
}

describe("DELETE /api/leads/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 204 when the lead exists in the caller's org", async () => {
    const state: DeleteState = {
      deleteCalls: [],
      deleteResult: { data: { id: "lead-1" }, error: null },
    };
    const res = await callDelete("lead-1", buildSupabaseMock(state));
    expect(res.status).toBe(204);
    expect(state.deleteCalls).toEqual([{ id: "lead-1" }]);
  });

  it("returns 404 when RLS hides the row (cross-org)", async () => {
    const state: DeleteState = {
      deleteCalls: [],
      // RLS makes the row invisible — delete returns nothing.
      deleteResult: { data: null, error: null },
    };
    const res = await callDelete("foreign-lead", buildSupabaseMock(state));
    expect(res.status).toBe(404);
  });

  it("returns 404 when the id does not exist", async () => {
    const state: DeleteState = {
      deleteCalls: [],
      deleteResult: { data: null, error: null },
    };
    const res = await callDelete("missing", buildSupabaseMock(state));
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    const state: DeleteState = {
      deleteCalls: [],
      deleteResult: { data: null, error: null },
      unauthenticated: true,
    };
    const res = await callDelete("lead-1", buildSupabaseMock(state));
    expect(res.status).toBe(401);
    expect(state.deleteCalls).toHaveLength(0);
  });

  it("returns 500 when the database errors", async () => {
    const state: DeleteState = {
      deleteCalls: [],
      deleteResult: { data: null, error: new Error("db down") },
    };
    const res = await callDelete("lead-1", buildSupabaseMock(state));
    expect(res.status).toBe(500);
  });
});
