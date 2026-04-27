import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLeadSchema, updateLeadSchema } from "@/types/schemas";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("lead schemas", () => {
  describe("createLeadSchema", () => {
    it("accepts a contact_id only", () => {
      const out = createLeadSchema.parse({ contact_id: VALID_UUID });
      expect(out.contact_id).toBe(VALID_UUID);
    });

    it("rejects a non-uuid contact_id", () => {
      expect(() =>
        createLeadSchema.parse({ contact_id: "not-a-uuid" }),
      ).toThrow();
    });

    it("rejects an unknown status", () => {
      expect(() =>
        createLeadSchema.parse({ contact_id: VALID_UUID, status: "Maybe" }),
      ).toThrow();
    });

    it("accepts the 5 lead statuses", () => {
      for (const s of ["New", "Interested", "Hot", "Paid", "Lost"] as const) {
        expect(
          createLeadSchema.parse({ contact_id: VALID_UUID, status: s }),
        ).toBeTruthy();
      }
    });
  });

  describe("updateLeadSchema", () => {
    it("accepts a partial patch", () => {
      expect(updateLeadSchema.parse({ status: "Hot" })).toEqual({
        status: "Hot",
      });
      expect(updateLeadSchema.parse({ name: "Acme" })).toEqual({
        name: "Acme",
      });
    });

    it("rejects oversized notes", () => {
      const big = "a".repeat(5001);
      expect(() => updateLeadSchema.parse({ notes: big })).toThrow();
    });

    it("permits explicit nulls for clearable fields", () => {
      expect(updateLeadSchema.parse({ name: null })).toEqual({ name: null });
      expect(updateLeadSchema.parse({ notes: null })).toEqual({ notes: null });
    });
  });
});

interface ChainState {
  upsertCalls: Array<Record<string, unknown>>;
  upsertResult: { data: unknown; error: unknown };
  contactRow: { id: string; org_id: string } | null;
}

function buildSupabaseMock(state: ChainState) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
    },
    from: (table: string) => {
      if (table === "org_members") {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({
                single: () =>
                  Promise.resolve({ data: { org_id: "org-1" }, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "contacts") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: state.contactRow, error: null }),
            }),
          }),
        };
      }
      if (table === "leads") {
        return {
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

describe("POST /api/leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts on (org_id, contact_id) and returns the lead", async () => {
    const state: ChainState = {
      upsertCalls: [],
      upsertResult: {
        data: { id: "lead-1", org_id: "org-1", contact_id: VALID_UUID },
        error: null,
      },
      contactRow: { id: VALID_UUID, org_id: "org-1" },
    };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { POST } = await import("@/app/api/leads/route");
    const req = new Request("http://localhost/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contact_id: VALID_UUID, name: "Acme Co" }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { lead: { id: string } };
    expect(body.lead.id).toBe("lead-1");
    expect(state.upsertCalls).toHaveLength(1);
    expect(state.upsertCalls[0]).toMatchObject({
      org_id: "org-1",
      contact_id: VALID_UUID,
      name: "Acme Co",
      status: "New",
    });
  });

  it("rejects a contact owned by a different org", async () => {
    const state: ChainState = {
      upsertCalls: [],
      upsertResult: { data: null, error: null },
      contactRow: { id: VALID_UUID, org_id: "other-org" },
    };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { POST } = await import("@/app/api/leads/route");
    const req = new Request("http://localhost/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contact_id: VALID_UUID }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(404);
    expect(state.upsertCalls).toHaveLength(0);
  });

  it("400s on invalid payload", async () => {
    const state: ChainState = {
      upsertCalls: [],
      upsertResult: { data: null, error: null },
      contactRow: null,
    };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { POST } = await import("@/app/api/leads/route");
    const req = new Request("http://localhost/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contact_id: "not-a-uuid" }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });
});
