import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createWhatsappTemplateSchema,
  updateWhatsappTemplateSchema,
  countTemplateVariables,
} from "@/types/schemas";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("whatsapp template schemas", () => {
  describe("createWhatsappTemplateSchema", () => {
    it("accepts a well-formed template", () => {
      const out = createWhatsappTemplateSchema.parse({
        name: "order_confirmation",
        language: "en",
        category: "UTILITY",
        body: "Hi {{1}}, your order {{2}} is confirmed.",
      });
      expect(out.name).toBe("order_confirmation");
      expect(out.status).toBe("approved");
    });

    it("rejects uppercase or spaces in name", () => {
      expect(() =>
        createWhatsappTemplateSchema.parse({
          name: "Order Confirmation",
          language: "en",
          category: "UTILITY",
          body: "Hi.",
        }),
      ).toThrow();
    });

    it("accepts language with region (en_US)", () => {
      expect(
        createWhatsappTemplateSchema.parse({
          name: "x",
          language: "en_US",
          category: "MARKETING",
          body: "Hi.",
        }),
      ).toBeTruthy();
    });

    it("rejects an unknown category", () => {
      expect(() =>
        createWhatsappTemplateSchema.parse({
          name: "x",
          language: "en",
          category: "PROMO",
          body: "Hi.",
        }),
      ).toThrow();
    });

    it("rejects a body over 1024 chars", () => {
      expect(() =>
        createWhatsappTemplateSchema.parse({
          name: "x",
          language: "en",
          category: "UTILITY",
          body: "a".repeat(1025),
        }),
      ).toThrow();
    });
  });

  describe("updateWhatsappTemplateSchema", () => {
    it("accepts a partial patch", () => {
      expect(updateWhatsappTemplateSchema.parse({ status: "paused" })).toEqual({
        status: "paused",
      });
    });
  });

  describe("countTemplateVariables", () => {
    it("returns 0 for body with no placeholders", () => {
      expect(countTemplateVariables("hello world")).toBe(0);
    });

    it("returns highest index seen", () => {
      expect(countTemplateVariables("Hi {{1}}, code {{3}}")).toBe(3);
    });

    it("ignores whitespace inside braces", () => {
      expect(countTemplateVariables("Hi {{ 2 }}")).toBe(2);
    });
  });
});

interface ChainState {
  insertCalls: Array<Record<string, unknown>>;
  updateCalls: Array<Record<string, unknown>>;
  deleteCalled: boolean;
  insertResult: { data: unknown; error: { code?: string } | null };
  updateResult: { data: unknown; error: { code?: string } | null };
  deleteResult: { data: unknown; error: { code?: string } | null };
  selectResult: { data: unknown; error: unknown };
  orgRow: { org_id: string } | null;
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
                  Promise.resolve({ data: state.orgRow, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "whatsapp_templates") {
        return {
          select: () => ({
            order: () => Promise.resolve(state.selectResult),
          }),
          insert: (payload: Record<string, unknown>) => {
            state.insertCalls.push(payload);
            return {
              select: () => ({
                single: () => Promise.resolve(state.insertResult),
              }),
            };
          },
          update: (payload: Record<string, unknown>) => {
            state.updateCalls.push(payload);
            return {
              eq: () => ({
                select: () => ({
                  maybeSingle: () => Promise.resolve(state.updateResult),
                }),
              }),
            };
          },
          delete: () => {
            state.deleteCalled = true;
            return {
              eq: () => ({
                select: () => ({
                  maybeSingle: () => Promise.resolve(state.deleteResult),
                }),
              }),
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
}

function defaultState(): ChainState {
  return {
    insertCalls: [],
    updateCalls: [],
    deleteCalled: false,
    insertResult: { data: null, error: null },
    updateResult: { data: null, error: null },
    deleteResult: { data: null, error: null },
    selectResult: { data: [], error: null },
    orgRow: { org_id: "org-1" },
  };
}

describe("GET /api/whatsapp/templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the org's templates", async () => {
    const state = defaultState();
    state.selectResult = {
      data: [{ id: "tpl-1", name: "x" }],
      error: null,
    };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { GET } = await import("@/app/api/whatsapp/templates/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { templates: Array<{ id: string }> };
    expect(body.templates).toHaveLength(1);
    expect(body.templates[0]?.id).toBe("tpl-1");
  });
});

describe("POST /api/whatsapp/templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("derives variable_count and inserts", async () => {
    const state = defaultState();
    state.insertResult = {
      data: {
        id: "tpl-1",
        org_id: "org-1",
        name: "order_confirmation",
        variable_count: 2,
      },
      error: null,
    };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { POST } = await import("@/app/api/whatsapp/templates/route");
    const req = new Request("http://localhost/api/whatsapp/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "order_confirmation",
        language: "en",
        category: "UTILITY",
        body: "Hi {{1}}, order {{2}} is confirmed.",
      }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(state.insertCalls).toHaveLength(1);
    expect(state.insertCalls[0]).toMatchObject({
      org_id: "org-1",
      variable_count: 2,
      status: "approved",
    });
  });

  it("400s on invalid payload", async () => {
    const state = defaultState();
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { POST } = await import("@/app/api/whatsapp/templates/route");
    const req = new Request("http://localhost/api/whatsapp/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Bad Name",
        language: "en",
        category: "UTILITY",
        body: "Hi.",
      }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    expect(state.insertCalls).toHaveLength(0);
  });

  it("returns 409 on unique-violation", async () => {
    const state = defaultState();
    state.insertResult = { data: null, error: { code: "23505" } };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { POST } = await import("@/app/api/whatsapp/templates/route");
    const req = new Request("http://localhost/api/whatsapp/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "order_confirmation",
        language: "en",
        category: "UTILITY",
        body: "Hi.",
      }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(409);
  });

  it("401s when unauthenticated", async () => {
    const state = defaultState();
    const mock = buildSupabaseMock(state);
    mock.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } });
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(mock as never);

    const { POST } = await import("@/app/api/whatsapp/templates/route");
    const req = new Request("http://localhost/api/whatsapp/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "x",
        language: "en",
        category: "UTILITY",
        body: "Hi.",
      }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/whatsapp/templates/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-derives variable_count when body changes", async () => {
    const state = defaultState();
    state.updateResult = {
      data: { id: "tpl-1", body: "Hi {{1}}, code {{2}}, ref {{3}}" },
      error: null,
    };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { PATCH } = await import("@/app/api/whatsapp/templates/[id]/route");
    const req = new Request("http://localhost/api/whatsapp/templates/tpl-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "Hi {{1}}, code {{2}}, ref {{3}}" }),
    });
    const res = await PATCH(req as never, {
      params: Promise.resolve({ id: "tpl-1" }),
    });
    expect(res.status).toBe(200);
    expect(state.updateCalls).toHaveLength(1);
    expect(state.updateCalls[0]).toMatchObject({ variable_count: 3 });
  });

  it("returns 404 when template doesn't exist", async () => {
    const state = defaultState();
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { PATCH } = await import("@/app/api/whatsapp/templates/[id]/route");
    const req = new Request("http://localhost/api/whatsapp/templates/missing", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "paused" }),
    });
    const res = await PATCH(req as never, {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/whatsapp/templates/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 204 on success", async () => {
    const state = defaultState();
    state.deleteResult = { data: { id: "tpl-1" }, error: null };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { DELETE } = await import("@/app/api/whatsapp/templates/[id]/route");
    const res = await DELETE(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "tpl-1" }),
    });
    expect(res.status).toBe(204);
    expect(state.deleteCalled).toBe(true);
  });

  it("returns 409 when template has dependent campaigns", async () => {
    const state = defaultState();
    state.deleteResult = { data: null, error: { code: "23503" } };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { DELETE } = await import("@/app/api/whatsapp/templates/[id]/route");
    const res = await DELETE(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "tpl-1" }),
    });
    expect(res.status).toBe(409);
  });

  it("returns 404 when not found", async () => {
    const state = defaultState();
    state.deleteResult = { data: null, error: null };
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildSupabaseMock(state) as never,
    );

    const { DELETE } = await import("@/app/api/whatsapp/templates/[id]/route");
    const res = await DELETE(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "tpl-1" }),
    });
    expect(res.status).toBe(404);
  });
});
