import { describe, it, expect, beforeEach, vi } from "vitest";
import { createWeeklyPlan } from "@/lib/agents/content-agent";
import type { ResearchBundle } from "@/lib/agents/research-agent";

// Mock the Anthropic client — createWeeklyPlan pulls via getAnthropicClient().
const messagesCreateMock = vi.fn();
vi.mock("@/lib/agents/anthropic-client", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/agents/anthropic-client")
  >("@/lib/agents/anthropic-client");
  return {
    ...actual,
    getAnthropicClient: () => ({
      messages: { create: messagesCreateMock },
    }),
  };
});

const validPlan = {
  theme: "Festive readiness",
  summary: "Lead-up to Akshaya Tritiya with craft storytelling.",
  posts: [
    {
      platforms: ["instagram"],
      caption: "Small traditions, big impact.",
      hashtags: ["#craft", "#india"],
      suggestedAt: "2026-04-28T10:00:00+05:30",
      festivalId: null,
      rationale: "Anchor the week with a values post.",
    },
    {
      platforms: ["twitter", "linkedin"],
      caption: "Why our artisans still handloom each piece.",
      hashtags: ["#handloom", "#madeinindia"],
      suggestedAt: "2026-04-30T15:30:00+05:30",
      festivalId: null,
      rationale: "Mid-week story.",
    },
  ],
};

const research: ResearchBundle = {
  festivals: [
    {
      id: "f1",
      name: "Akshaya Tritiya",
      nameHi: "अक्षय तृतीया",
      date: "2026-05-09",
      regions: ["ALL"],
      suggestedHashtags: ["#AkshayaTritiya"],
      contentIdeas: ["Gold tradition", "Prosperity ritual"],
    },
  ],
  trends: {
    summary: "India is shifting toward conscious consumption.",
    topics: [
      {
        topic: "handmade",
        why: "rising Google trends",
        suggestedAngle: "tell maker stories",
      },
    ],
    generatedAt: new Date().toISOString(),
  },
};

describe("createWeeklyPlan", () => {
  beforeEach(() => {
    messagesCreateMock.mockReset();
  });

  it("returns the parsed plan on a valid first-pass response", async () => {
    messagesCreateMock.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify(validPlan) }],
    });

    const plan = await createWeeklyPlan({
      systemPrompt: "You are...",
      research,
      weekStart: "2026-04-27",
      weekEnd: "2026-05-03",
      platforms: ["instagram", "twitter", "linkedin"],
    });

    expect(plan.theme).toBe("Festive readiness");
    expect(plan.posts).toHaveLength(2);
    expect(messagesCreateMock).toHaveBeenCalledTimes(1);
  });

  it("retries once when first response is unparseable, then succeeds", async () => {
    messagesCreateMock
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "sorry, I can't return JSON" }],
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify(validPlan) }],
      });

    const plan = await createWeeklyPlan({
      systemPrompt: "You are...",
      research,
      weekStart: "2026-04-27",
      weekEnd: "2026-05-03",
      platforms: ["instagram"],
    });

    expect(plan.posts).toHaveLength(2);
    expect(messagesCreateMock).toHaveBeenCalledTimes(2);
  });

  it("throws when plan has no posts", async () => {
    messagesCreateMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({ theme: "x", summary: "y", posts: [] }),
        },
      ],
    });

    await expect(
      createWeeklyPlan({
        systemPrompt: "",
        research,
        weekStart: "2026-04-27",
        weekEnd: "2026-05-03",
        platforms: ["instagram"],
      }),
    ).rejects.toThrow(/missing theme or posts/);
  });

  it("throws when a post has an invalid suggestedAt", async () => {
    const bad = {
      ...validPlan,
      posts: [{ ...validPlan.posts[0], suggestedAt: "not-a-date" }],
    };
    // Both first pass and retry return the same bad plan.
    messagesCreateMock.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(bad) }],
    });

    await expect(
      createWeeklyPlan({
        systemPrompt: "",
        research,
        weekStart: "2026-04-27",
        weekEnd: "2026-05-03",
        platforms: ["instagram"],
      }),
    ).rejects.toThrow(/suggestedAt is not a valid ISO date/);
  });
});
