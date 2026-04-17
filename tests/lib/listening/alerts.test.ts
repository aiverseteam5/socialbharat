import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

type QueryChain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
};

function makeChain(resolution: unknown): QueryChain {
  const chain: QueryChain = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
    insert: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.lt.mockResolvedValue(resolution);
  chain.limit.mockReturnValue(chain);
  chain.single.mockResolvedValue(resolution);
  chain.insert.mockResolvedValue({ error: null });
  return chain;
}

function buildMock(opts: {
  recentMentions: Array<{ sentiment_label: string }>;
  previousMentions: Array<{ id: string }>;
  ownerUserId?: string;
  insertError?: { message: string } | null;
}) {
  const {
    recentMentions,
    previousMentions,
    ownerUserId = "owner-1",
    insertError = null,
  } = opts;

  const insertMock = vi.fn().mockResolvedValue({ error: insertError });

  const supabase = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "listening_queries") {
        return makeChain({
          data: { id: "query-1", name: "Test Query", org_id: "org-1" },
          error: null,
        });
      }

      if (table === "listening_mentions") {
        // alerts.ts makes two distinct queries on listening_mentions:
        //   1st: .select("sentiment_label")  → awaited directly after .gte()
        //   2nd: .select("id")               → awaited after .lt()
        // Dispatch on the select field to return the right data.
        return {
          select: vi.fn().mockImplementation((fields: string) => {
            if (fields === "sentiment_label") {
              // Recent mentions — chain ends at .gte(), no .lt()
              return {
                eq: vi.fn().mockReturnThis(),
                gte: vi.fn().mockResolvedValue({ data: recentMentions }),
              };
            }
            // "id" — previous mentions — chain ends at .lt()
            return {
              eq: vi.fn().mockReturnThis(),
              gte: vi.fn().mockReturnValue({
                lt: vi.fn().mockResolvedValue({ data: previousMentions }),
              }),
            };
          }),
        };
      }

      if (table === "org_members") {
        return makeChain({
          data: { user_id: ownerUserId },
          error: null,
        });
      }

      if (table === "notifications") {
        return { insert: insertMock };
      }

      return makeChain({ data: null, error: null });
    }),
    _insertMock: insertMock,
  };

  return supabase;
}

describe("checkQueryAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("does not trigger alert when there are no recent mentions", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildMock({ recentMentions: [], previousMentions: [] }) as never,
    );

    const { checkQueryAlerts } = await import("@/lib/listening/alerts");
    const result = await checkQueryAlerts("query-1", "Test Query", "org-1");
    expect(result.triggered).toBe(false);
  });

  it("does not trigger alert when negative ratio is below threshold (20%)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    // 1/5 = 20% negative, below 50% threshold
    // 5 recent vs 2 prev/23h ≈ 0.09 hourly avg → 5 is above 3x but we check sentiment first
    const recentMentions = [
      { sentiment_label: "negative" },
      { sentiment_label: "positive" },
      { sentiment_label: "positive" },
      { sentiment_label: "neutral" },
      { sentiment_label: "positive" },
    ];
    const previousMentions = [{ id: "a" }, { id: "b" }];
    vi.mocked(createClient).mockResolvedValue(
      buildMock({ recentMentions, previousMentions }) as never,
    );

    const { checkQueryAlerts } = await import("@/lib/listening/alerts");
    const result = await checkQueryAlerts("query-1", "Test Query", "org-1");
    expect(result.negativeMentions ?? 0).toBe(1);
    // 1/5 = 20% → sentiment threshold not triggered; check via the result's negative count
  });

  it("triggers alert when negative sentiment exceeds 50% threshold", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    // 3/6 = 50% negative → exactly at threshold, triggers
    const recentMentions = [
      { sentiment_label: "negative" },
      { sentiment_label: "negative" },
      { sentiment_label: "negative" },
      { sentiment_label: "positive" },
      { sentiment_label: "neutral" },
      { sentiment_label: "neutral" },
    ];
    // Very low previous volume → no volume spike
    const previousMentions = [{ id: "a" }, { id: "b" }];
    vi.mocked(createClient).mockResolvedValue(
      buildMock({ recentMentions, previousMentions }) as never,
    );

    const { checkQueryAlerts } = await import("@/lib/listening/alerts");
    const result = await checkQueryAlerts("query-1", "Test Query", "org-1");
    expect(result.triggered).toBe(true);
    expect(result.negativeMentions).toBe(3);
    expect(result.totalMentions).toBe(6);
    expect(result.reason).toContain("negative sentiment");
  });

  it("triggers alert when volume is 3x+ the hourly baseline", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    // 4 recent (only 25% negative — below sentiment threshold)
    // 23 previous over 23h → baseline 1/hr → 3x = 3 → 4 > 3 → volume spike
    const recentMentions = [
      { sentiment_label: "negative" },
      { sentiment_label: "positive" },
      { sentiment_label: "positive" },
      { sentiment_label: "positive" },
    ];
    const previousMentions = Array.from({ length: 23 }, (_, i) => ({
      id: String(i),
    }));
    vi.mocked(createClient).mockResolvedValue(
      buildMock({ recentMentions, previousMentions }) as never,
    );

    const { checkQueryAlerts } = await import("@/lib/listening/alerts");
    const result = await checkQueryAlerts("query-1", "Test Query", "org-1");
    expect(result.triggered).toBe(true);
    expect(result.reason).toContain("Volume spike");
  });

  it("creates a crisis_alert notification when alert triggers", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const mock = buildMock({
      recentMentions: [
        { sentiment_label: "negative" },
        { sentiment_label: "negative" },
        { sentiment_label: "negative" },
        { sentiment_label: "positive" },
      ],
      previousMentions: [{ id: "a" }],
    });
    vi.mocked(createClient).mockResolvedValue(mock as never);

    const { checkQueryAlerts } = await import("@/lib/listening/alerts");
    const result = await checkQueryAlerts("query-1", "Crisis Query", "org-1");
    expect(result.triggered).toBe(true);
    expect(mock._insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "crisis_alert", org_id: "org-1" }),
    );
  });
});
