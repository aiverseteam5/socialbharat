import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Orchestrator tests — runWeeklyCycle happy path with Supabase + sub-agents
 * mocked. The goal is to verify:
 *   1. platform names are derived from social_profiles
 *   2. research + content are invoked with the assembled system prompt
 *   3. agent_plans row is inserted with status='pending_review' under default
 *      AGENT_HUMAN_APPROVAL=true
 */

// ── Supabase mock (service role) ──────────────────────────────────────────
const insertedPlans: Array<Record<string, unknown>> = [];

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === "organizations") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: "org-1",
                    industry: "fashion",
                    preferred_language: "en",
                    timezone: "Asia/Kolkata",
                  },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "brand_voices") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "social_profiles") {
        return {
          select: () => ({
            eq: () => ({
              eq: () =>
                Promise.resolve({
                  data: [
                    { platform: "instagram" },
                    { platform: "facebook" },
                    { platform: "instagram" }, // dupe — should dedupe
                  ],
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "agent_plans") {
        return {
          insert: (values: Record<string, unknown>) => {
            insertedPlans.push(values);
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: "plan-1" },
                    error: null,
                  }),
              }),
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

// ── Sub-agent mocks ──────────────────────────────────────────────────────
const runResearchMock = vi.fn();
vi.mock("@/lib/agents/research-agent", () => ({
  runResearch: (args: unknown) => runResearchMock(args),
}));

const createWeeklyPlanMock = vi.fn();
vi.mock("@/lib/agents/content-agent", () => ({
  createWeeklyPlan: (args: unknown) => createWeeklyPlanMock(args),
}));

// Import AFTER mocks so the orchestrator picks them up.
import { runWeeklyCycle } from "@/lib/agents/orchestrator";

describe("runWeeklyCycle", () => {
  beforeEach(() => {
    insertedPlans.length = 0;
    runResearchMock.mockReset();
    createWeeklyPlanMock.mockReset();

    runResearchMock.mockResolvedValue({
      festivals: [],
      trends: {
        summary: "",
        topics: [],
        generatedAt: new Date().toISOString(),
      },
    });
    createWeeklyPlanMock.mockResolvedValue({
      theme: "Week of craft",
      summary: "Lead with artisan stories.",
      posts: [
        {
          platforms: ["instagram"],
          caption: "hi",
          hashtags: ["#craft"],
          suggestedAt: "2026-05-01T10:00:00+05:30",
        },
      ],
    });
  });

  it("inserts one agent_plans row with status=pending_review and dedupes platforms", async () => {
    const result = await runWeeklyCycle("org-1");

    expect(result.kind).toBe("weekly_content");
    expect(result.createdIds).toEqual(["plan-1"]);

    expect(insertedPlans).toHaveLength(1);
    const inserted = insertedPlans[0]!;
    expect(inserted.org_id).toBe("org-1");
    expect(inserted.status).toBe("pending_review");
    expect(inserted.kind).toBe("weekly_content");

    // platforms passed to content-agent should be deduped.
    const contentArgs = createWeeklyPlanMock.mock.calls[0]![0] as {
      platforms: string[];
    };
    expect(contentArgs.platforms.sort()).toEqual(["facebook", "instagram"]);
  });

  it("passes the assembled system prompt (default, no brand voice) to research", async () => {
    await runWeeklyCycle("org-1");
    const researchArgs = runResearchMock.mock.calls[0]![0] as {
      systemPrompt: string;
      industry: string;
    };
    expect(researchArgs.systemPrompt).toContain("SocialBharat");
    expect(researchArgs.industry).toBe("fashion");
  });
});
