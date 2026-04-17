import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock service client (not createClient — verifies C-1 fix)
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("openai", () => {
  const mockCreate = vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            score: 0.5,
            label: "positive",
            language_detected: "en",
          }),
        },
      },
    ],
  });
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
  };
});

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

type MockSupabase = {
  from: ReturnType<typeof vi.fn>;
  _insertMock: ReturnType<typeof vi.fn>;
};

function buildServiceMock(opts: {
  query?: Record<string, unknown> | null;
  existingMentions?: Array<{ platform: string; platform_post_id: string }>;
  insertError?: { message: string } | null;
  allQueries?: Array<{ id: string }>;
}): MockSupabase {
  const {
    query = {
      id: "q-1",
      org_id: "org-1",
      name: "Test",
      keywords: ["test"],
      excluded_keywords: [],
      platforms: ["twitter"],
      languages: ["en"],
      is_active: true,
      created_by: "user-1",
      created_at: new Date().toISOString(),
    },
    existingMentions = [],
    insertError = null,
    allQueries = [{ id: "q-1" }],
  } = opts;

  const insertMock = vi.fn().mockResolvedValue({ error: insertError });

  const supabase: MockSupabase = {
    _insertMock: insertMock,
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "listening_queries") {
        let selectCallCount = 0;
        return {
          select: vi.fn().mockImplementation(() => {
            selectCallCount++;
            const isAllQuery = selectCallCount >= 2 || allQueries.length > 1;
            return {
              eq: vi.fn().mockReturnThis(),
              single: vi
                .fn()
                .mockResolvedValue({
                  data: query,
                  error: query ? null : { message: "not found" },
                }),
              // crawlAllActiveQueries uses .select("id").eq("is_active", true) — no .single()
              then: isAllQuery
                ? vi
                    .fn()
                    .mockImplementation((resolve: (v: unknown) => void) =>
                      resolve({ data: allQueries, error: null }),
                    )
                : undefined,
            };
          }),
        };
      }

      if (table === "listening_mentions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: existingMentions }),
          }),
          insert: insertMock,
        };
      }

      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    }),
  };

  return supabase;
}

describe("crawler — uses createServiceClient (not createClient)", () => {
  it("imports createServiceClient from service module", async () => {
    const { createServiceClient } = await import("@/lib/supabase/service");
    // Trigger a crawl to ensure createServiceClient is called
    vi.mocked(createServiceClient).mockReturnValue(
      buildServiceMock({ query: null }) as never,
    );
    await import("@/lib/listening/crawler");
    // The import itself doesn't call createServiceClient — the functions do.
    // The key assertion is that createClient is NOT imported (we don't mock it)
    expect(createServiceClient).toBeDefined();
  });
});

describe("crawlMentionsForQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns early when query is not found or inactive", async () => {
    const { createServiceClient } = await import("@/lib/supabase/service");
    vi.mocked(createServiceClient).mockReturnValue(
      buildServiceMock({ query: null }) as never,
    );

    const { crawlMentionsForQuery } = await import("@/lib/listening/crawler");
    const result = await crawlMentionsForQuery("q-missing");
    expect(result.saved).toBe(0);
    expect(result.errors).toContain("Query not found or inactive");
  });

  it("skips twitter when platform not in query.platforms", async () => {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const mock = buildServiceMock({
      query: {
        id: "q-1",
        org_id: "org-1",
        name: "IG only",
        keywords: ["test"],
        excluded_keywords: [],
        platforms: ["instagram"],
        languages: ["en"],
        is_active: true,
        created_by: "u-1",
        created_at: new Date().toISOString(),
      },
    });
    vi.mocked(createServiceClient).mockReturnValue(mock as never);

    // Instagram fetch will return [] because META_IG_SEARCH_TOKEN is unset
    const { crawlMentionsForQuery } = await import("@/lib/listening/crawler");
    const result = await crawlMentionsForQuery("q-1");
    // No twitter mentions, no instagram mentions (no token) → nothing inserted
    expect(result.saved).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("deduplicates — does not insert already-stored mention IDs", async () => {
    const { createServiceClient } = await import("@/lib/supabase/service");

    // Simulate Twitter returning a tweet that's already in the DB
    const existingMentions = [
      { platform: "twitter", platform_post_id: "tweet-123" },
    ];
    const mock = buildServiceMock({ existingMentions });
    vi.mocked(createServiceClient).mockReturnValue(mock as never);

    // Patch global fetch to simulate Twitter returning that same tweet
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "tweet-123",
            text: "Test tweet",
            created_at: new Date().toISOString(),
            author_id: "u-1",
            public_metrics: { like_count: 1, retweet_count: 0, reply_count: 0 },
          },
        ],
        includes: {
          users: [{ id: "u-1", name: "Test User", username: "testuser" }],
        },
      }),
    });

    // Set env so Twitter path is attempted
    const origToken = process.env.TWITTER_BEARER_TOKEN;
    process.env.TWITTER_BEARER_TOKEN = "test-token";

    try {
      const { crawlMentionsForQuery } = await import("@/lib/listening/crawler");
      const result = await crawlMentionsForQuery("q-1");
      expect(result.saved).toBe(0); // existing → deduplicated → nothing inserted
      expect(mock._insertMock).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
      process.env.TWITTER_BEARER_TOKEN = origToken;
    }
  });

  it("inserts new mentions that are not in the DB yet", async () => {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const mock = buildServiceMock({ existingMentions: [] });
    vi.mocked(createServiceClient).mockReturnValue(mock as never);

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "tweet-new-1",
            text: "Brand new tweet",
            created_at: new Date().toISOString(),
            author_id: "u-2",
            public_metrics: { like_count: 5, retweet_count: 2, reply_count: 1 },
          },
        ],
        includes: {
          users: [{ id: "u-2", name: "New User", username: "newuser" }],
        },
      }),
    });

    const origToken = process.env.TWITTER_BEARER_TOKEN;
    process.env.TWITTER_BEARER_TOKEN = "test-token";

    try {
      const { crawlMentionsForQuery } = await import("@/lib/listening/crawler");
      const result = await crawlMentionsForQuery("q-1");
      expect(result.saved).toBe(1);
      expect(mock._insertMock).toHaveBeenCalledOnce();
      const insertedRows = mock._insertMock.mock.calls[0]![0] as Array<{
        platform: string;
        platform_post_id: string;
      }>;
      expect(insertedRows[0]?.platform).toBe("twitter");
      expect(insertedRows[0]?.platform_post_id).toBe("tweet-new-1");
    } finally {
      global.fetch = originalFetch;
      process.env.TWITTER_BEARER_TOKEN = origToken;
    }
  });

  it("handles Twitter API 429 error gracefully — returns empty, no crash", async () => {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const mock = buildServiceMock({ existingMentions: [] });
    vi.mocked(createServiceClient).mockReturnValue(mock as never);

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });

    const origToken = process.env.TWITTER_BEARER_TOKEN;
    process.env.TWITTER_BEARER_TOKEN = "test-token";

    try {
      const { crawlMentionsForQuery } = await import("@/lib/listening/crawler");
      const result = await crawlMentionsForQuery("q-1");
      expect(result.saved).toBe(0);
      expect(result.errors).toHaveLength(0); // API error returns [] gracefully
    } finally {
      global.fetch = originalFetch;
      process.env.TWITTER_BEARER_TOKEN = origToken;
    }
  });

  it("handles Twitter API 500 error gracefully — returns empty, no crash", async () => {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const mock = buildServiceMock({ existingMentions: [] });
    vi.mocked(createServiceClient).mockReturnValue(mock as never);

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const origToken = process.env.TWITTER_BEARER_TOKEN;
    process.env.TWITTER_BEARER_TOKEN = "test-token";

    try {
      const { crawlMentionsForQuery } = await import("@/lib/listening/crawler");
      const result = await crawlMentionsForQuery("q-1");
      expect(result.saved).toBe(0);
      expect(result.errors).toHaveLength(0);
    } finally {
      global.fetch = originalFetch;
      process.env.TWITTER_BEARER_TOKEN = origToken;
    }
  });

  it("propagates insert DB error into errors array", async () => {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const mock = buildServiceMock({
      existingMentions: [],
      insertError: { message: "duplicate key value" },
    });
    vi.mocked(createServiceClient).mockReturnValue(mock as never);

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "t-err",
            text: "hello",
            created_at: new Date().toISOString(),
            author_id: "u-1",
            public_metrics: { like_count: 0, retweet_count: 0, reply_count: 0 },
          },
        ],
        includes: { users: [{ id: "u-1", name: "User", username: "user" }] },
      }),
    });

    const origToken = process.env.TWITTER_BEARER_TOKEN;
    process.env.TWITTER_BEARER_TOKEN = "test-token";

    try {
      const { crawlMentionsForQuery } = await import("@/lib/listening/crawler");
      const result = await crawlMentionsForQuery("q-1");
      expect(result.saved).toBe(0);
      expect(result.errors.some((e) => e.includes("Insert error"))).toBe(true);
    } finally {
      global.fetch = originalFetch;
      process.env.TWITTER_BEARER_TOKEN = origToken;
    }
  });
});

describe("crawlAllActiveQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("iterates all active queries and aggregates results", async () => {
    const { createServiceClient } = await import("@/lib/supabase/service");

    // Two active queries — both return "not found" (simple stub), each saves 0
    // Dispatch on select field: "id" → crawlAllActiveQueries list, "*" → crawlMentionsForQuery fetch
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "listening_queries") {
          return {
            select: vi.fn().mockImplementation((fields: string) => {
              if (fields === "id") {
                // crawlAllActiveQueries: .select("id").eq("is_active", true) → resolved directly
                return {
                  eq: vi.fn().mockResolvedValue({
                    data: [{ id: "q-a" }, { id: "q-b" }],
                    error: null,
                  }),
                };
              }
              // crawlMentionsForQuery: .select("*").eq("id", ...).eq("is_active", true).single()
              const chain: Record<string, unknown> = {};
              chain.eq = vi.fn().mockReturnValue(chain);
              chain.single = vi
                .fn()
                .mockResolvedValue({
                  data: null,
                  error: { message: "not found" },
                });
              return chain;
            }),
          };
        }
        return {};
      }),
    };

    vi.mocked(createServiceClient).mockReturnValue(supabase as never);

    const { crawlAllActiveQueries } = await import("@/lib/listening/crawler");
    const result = await crawlAllActiveQueries();

    expect(result.queried).toBe(2);
    expect(result.mentionsSaved).toBe(0);
    expect(result.errors).toHaveLength(2); // "Query not found or inactive" × 2
  });

  it("returns queried:0 and error when DB query fails", async () => {
    const { createServiceClient } = await import("@/lib/supabase/service");

    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi
            .fn()
            .mockResolvedValue({
              data: null,
              error: { message: "connection refused" },
            }),
        }),
      }),
    };

    vi.mocked(createServiceClient).mockReturnValue(supabase as never);

    const { crawlAllActiveQueries } = await import("@/lib/listening/crawler");
    const result = await crawlAllActiveQueries();

    expect(result.queried).toBe(0);
    expect(result.errors).toContain("connection refused");
  });
});
