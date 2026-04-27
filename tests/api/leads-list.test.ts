import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

interface ListState {
  leadRows: Array<Record<string, unknown>>;
  contactRows: Array<{ id: string }>; // matches for q
  convRows: Array<{
    id: string;
    contact_id: string;
    last_message_at: string | null;
  }>;
  msgRows: Array<{
    conversation_id: string;
    content: string | null;
    created_at: string;
  }>;
  // Captured query params for assertions
  leadsEqCalls: Array<{ col: string; val: unknown }>;
  leadsOrCalls: string[];
  leadsGteCalls: Array<{ col: string; val: unknown }>;
  leadsLteCalls: Array<{ col: string; val: unknown }>;
  contactsOrCalls: string[];
  unauthenticated?: boolean;
}

function buildSupabaseMock(state: ListState) {
  const leadsBuilder = {
    select: () => leadsBuilder,
    order: () => leadsBuilder,
    limit: () => leadsBuilder,
    eq: (col: string, val: unknown) => {
      state.leadsEqCalls.push({ col, val });
      return leadsBuilder;
    },
    gte: (col: string, val: unknown) => {
      state.leadsGteCalls.push({ col, val });
      return leadsBuilder;
    },
    lte: (col: string, val: unknown) => {
      state.leadsLteCalls.push({ col, val });
      return leadsBuilder;
    },
    or: (expr: string) => {
      state.leadsOrCalls.push(expr);
      return leadsBuilder;
    },
    then: (
      onFulfilled?: (v: { data: unknown[]; error: unknown }) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) =>
      Promise.resolve({ data: state.leadRows, error: null }).then(
        onFulfilled,
        onRejected,
      ),
  };

  const contactsSearchBuilder = {
    select: () => contactsSearchBuilder,
    or: (expr: string) => {
      state.contactsOrCalls.push(expr);
      return Promise.resolve({ data: state.contactRows, error: null });
    },
  };

  const convBuilder = {
    select: () => convBuilder,
    in: () => convBuilder,
    order: () => Promise.resolve({ data: state.convRows, error: null }),
  };

  const msgBuilder = {
    select: () => msgBuilder,
    in: () => msgBuilder,
    order: () => Promise.resolve({ data: state.msgRows, error: null }),
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: state.unauthenticated ? null : { id: "user-1" } },
      }),
    },
    from: (table: string) => {
      if (table === "leads") return leadsBuilder;
      if (table === "contacts") return contactsSearchBuilder;
      if (table === "conversations") return convBuilder;
      if (table === "messages") return msgBuilder;
      throw new Error(`Unexpected table ${table}`);
    },
  };
}

function blankState(overrides: Partial<ListState> = {}): ListState {
  return {
    leadRows: [],
    contactRows: [],
    convRows: [],
    msgRows: [],
    leadsEqCalls: [],
    leadsOrCalls: [],
    leadsGteCalls: [],
    leadsLteCalls: [],
    contactsOrCalls: [],
    ...overrides,
  };
}

const sampleLead = (
  id: string,
  status: string,
  contactId = `contact-${id}`,
) => ({
  id,
  org_id: "org-1",
  contact_id: contactId,
  name: `Lead ${id}`,
  status,
  notes: null,
  created_at: "2026-04-01T00:00:00Z",
  updated_at: "2026-04-15T00:00:00Z",
  contact: {
    id: contactId,
    display_name: `Contact ${id}`,
    platform_user_id: "919876500000",
  },
});

async function callGet(
  url: string,
  mock: ReturnType<typeof buildSupabaseMock>,
) {
  const { createClient } = await import("@/lib/supabase/server");
  vi.mocked(createClient).mockResolvedValue(mock as never);
  const { GET } = await import("@/app/api/leads/list/route");
  return GET(new Request(url) as never);
}

describe("GET /api/leads/list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when unauthenticated", async () => {
    const state = blankState({ unauthenticated: true });
    const res = await callGet(
      "http://localhost/api/leads/list",
      buildSupabaseMock(state),
    );
    expect(res.status).toBe(401);
  });

  it("returns leads with no filters and enriches with conversation + message", async () => {
    const state = blankState({
      leadRows: [sampleLead("1", "New"), sampleLead("2", "Hot")],
      convRows: [
        {
          id: "c-1",
          contact_id: "contact-1",
          last_message_at: "2026-04-15T10:00:00Z",
        },
        {
          id: "c-2",
          contact_id: "contact-2",
          last_message_at: "2026-04-14T10:00:00Z",
        },
      ],
      msgRows: [
        {
          conversation_id: "c-1",
          content: "Hi there",
          created_at: "2026-04-15T10:00:00Z",
        },
        {
          conversation_id: "c-2",
          content: "Hello",
          created_at: "2026-04-14T10:00:00Z",
        },
      ],
    });
    const res = await callGet(
      "http://localhost/api/leads/list",
      buildSupabaseMock(state),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      leads: Array<Record<string, unknown>>;
    };
    expect(body.leads).toHaveLength(2);
    expect(body.leads[0]).toMatchObject({
      id: "1",
      latest_conversation_id: "c-1",
      last_message_preview: "Hi there",
    });
    // No status filter applied
    expect(state.leadsEqCalls).toHaveLength(0);
    // No q-search OR call
    expect(state.leadsOrCalls).toHaveLength(0);
  });

  it("applies status filter when ?status=Hot", async () => {
    const state = blankState({ leadRows: [sampleLead("1", "Hot")] });
    const res = await callGet(
      "http://localhost/api/leads/list?status=Hot",
      buildSupabaseMock(state),
    );
    expect(res.status).toBe(200);
    expect(state.leadsEqCalls).toEqual([{ col: "status", val: "Hot" }]);
  });

  it("ignores unknown status values silently", async () => {
    const state = blankState({ leadRows: [sampleLead("1", "New")] });
    const res = await callGet(
      "http://localhost/api/leads/list?status=Pending",
      buildSupabaseMock(state),
    );
    expect(res.status).toBe(200);
    // Pending isn't in the enum — filter must NOT be applied
    expect(state.leadsEqCalls).toHaveLength(0);
  });

  it("applies date range filters", async () => {
    const state = blankState({ leadRows: [] });
    await callGet(
      "http://localhost/api/leads/list?from=2026-04-01&to=2026-04-30",
      buildSupabaseMock(state),
    );
    expect(state.leadsGteCalls).toEqual([
      { col: "created_at", val: "2026-04-01" },
    ]);
    expect(state.leadsLteCalls).toEqual([
      { col: "created_at", val: "2026-04-30" },
    ]);
  });

  it("runs contacts pre-search when ?q= present and ORs lead.name with matched contact_ids", async () => {
    const state = blankState({
      leadRows: [sampleLead("1", "New")],
      contactRows: [{ id: "contact-1" }, { id: "contact-9" }],
    });
    await callGet(
      "http://localhost/api/leads/list?q=acme",
      buildSupabaseMock(state),
    );
    // Contacts pre-search uses display_name + platform_user_id ilike
    expect(state.contactsOrCalls).toHaveLength(1);
    expect(state.contactsOrCalls[0]).toContain("display_name.ilike.%acme%");
    expect(state.contactsOrCalls[0]).toContain("platform_user_id.ilike.%acme%");
    // Leads OR includes name + matched contact_ids
    expect(state.leadsOrCalls).toHaveLength(1);
    expect(state.leadsOrCalls[0]).toContain("name.ilike.%acme%");
    expect(state.leadsOrCalls[0]).toContain(
      "contact_id.in.(contact-1,contact-9)",
    );
  });

  it("strips PostgREST-reserved chars from q (no SQL/injection through .or())", async () => {
    const state = blankState({ leadRows: [], contactRows: [] });
    await callGet(
      "http://localhost/api/leads/list?q=ac,me*(",
      buildSupabaseMock(state),
    );
    // Comma, paren, asterisk, percent stripped before interpolation
    expect(state.contactsOrCalls[0]).toContain("display_name.ilike.%acme%");
    expect(state.contactsOrCalls[0]).not.toContain(",me");
    expect(state.contactsOrCalls[0]).not.toContain("(");
  });

  it("falls back to lead.name-only OR when q matches no contacts", async () => {
    const state = blankState({
      leadRows: [sampleLead("1", "New")],
      contactRows: [], // no contact matched
    });
    await callGet(
      "http://localhost/api/leads/list?q=zzzz",
      buildSupabaseMock(state),
    );
    expect(state.leadsOrCalls).toHaveLength(1);
    expect(state.leadsOrCalls[0]).toBe("name.ilike.%zzzz%");
  });

  it("returns empty leads array when no rows match", async () => {
    const state = blankState({ leadRows: [] });
    const res = await callGet(
      "http://localhost/api/leads/list",
      buildSupabaseMock(state),
    );
    const body = (await res.json()) as { leads: unknown[] };
    expect(body.leads).toEqual([]);
  });
});
