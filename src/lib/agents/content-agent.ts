/**
 * Content sub-agent.
 *
 * Given a brand-voice system prompt and a research bundle, asks Claude to
 * return a structured weekly plan (theme + 5-7 draft posts). The response is
 * expected as JSON; on parse failure we retry once with a stricter prompt.
 *
 * The returned plan is persisted by the orchestrator into agent_plans — it
 * is NOT published automatically. When AGENT_HUMAN_APPROVAL=true, users must
 * approve the plan at /ai-agent before it turns into real scheduled posts.
 */
import {
  getAnthropicClient,
  ANTHROPIC_MODEL,
  extractText,
  parseJsonFromResponse,
} from "./anthropic-client";
import type { WeeklyPlan } from "./types";
import type { ResearchBundle } from "./research-agent";
import { logger } from "@/lib/logger";

function buildUserPrompt(params: {
  research: ResearchBundle;
  weekStart: string;
  weekEnd: string;
  platforms: string[];
  postsPerWeek: number;
}): string {
  const { research, weekStart, weekEnd, platforms, postsPerWeek } = params;

  const festivalLines = research.festivals.length
    ? research.festivals
        .map(
          (f) =>
            `- ${f.name} (${f.date}) — ideas: ${f.contentIdeas.slice(0, 3).join("; ") || "general"}`,
        )
        .join("\n")
    : "- None in the upcoming window.";

  const trendLines = research.trends.topics
    .map((t) => `- ${t.topic}: ${t.suggestedAngle}`)
    .join("\n");

  return [
    `Plan social posts for the week ${weekStart} → ${weekEnd} (IST).`,
    `Platforms available: ${platforms.join(", ")}.`,
    `Generate ${postsPerWeek} posts total. Spread them across the week.`,
    "",
    "Festival context:",
    festivalLines,
    "",
    "Trend context:",
    research.trends.summary,
    "",
    "Suggested angles:",
    trendLines,
    "",
    "Return ONLY JSON matching this exact shape:",
    "{",
    '  "theme": "one-line week theme",',
    '  "summary": "why this theme, max 300 chars",',
    '  "posts": [',
    "    {",
    '      "platforms": ["instagram" | "facebook" | "twitter" | "linkedin" | "youtube" | "whatsapp"],',
    '      "caption": "the post copy",',
    '      "hashtags": ["#tag1", "#tag2"],',
    '      "suggestedAt": "2026-04-28T10:00:00+05:30",',
    '      "festivalId": "uuid-or-null",',
    '      "rationale": "one line on why this post"',
    "    }",
    "  ]",
    "}",
    "",
    "Rules:",
    "- suggestedAt MUST be a valid ISO-8601 timestamp in IST (+05:30).",
    "- Every post must select at least one platform from the available list.",
    "- No emojis in hashtags. Hashtags start with '#'.",
    "- Do NOT include prose outside the JSON.",
  ].join("\n");
}

export async function createWeeklyPlan(params: {
  systemPrompt: string;
  research: ResearchBundle;
  weekStart: string;
  weekEnd: string;
  platforms: string[];
  postsPerWeek?: number;
}): Promise<WeeklyPlan> {
  const userPrompt = buildUserPrompt({
    research: params.research,
    weekStart: params.weekStart,
    weekEnd: params.weekEnd,
    platforms: params.platforms,
    postsPerWeek: params.postsPerWeek ?? 5,
  });

  const client = getAnthropicClient();

  const firstPass = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 3000,
    system: params.systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const firstText = extractText(firstPass.content);

  try {
    return validatePlan(parseJsonFromResponse<WeeklyPlan>(firstText));
  } catch (err) {
    logger.warn("content-agent: first-pass parse failed, retrying", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const retry = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 3000,
    system: params.systemPrompt,
    messages: [
      { role: "user", content: userPrompt },
      { role: "assistant", content: firstText },
      {
        role: "user",
        content:
          "Your previous response was not parseable JSON. Return ONLY the JSON object, no prose, no code fences.",
      },
    ],
  });

  return validatePlan(
    parseJsonFromResponse<WeeklyPlan>(extractText(retry.content)),
  );
}

function validatePlan(plan: WeeklyPlan): WeeklyPlan {
  if (!plan.theme || !Array.isArray(plan.posts) || plan.posts.length === 0) {
    throw new Error("content-agent: plan missing theme or posts");
  }
  for (const post of plan.posts) {
    if (!post.platforms || post.platforms.length === 0) {
      throw new Error("content-agent: post missing platforms");
    }
    if (!post.caption || typeof post.caption !== "string") {
      throw new Error("content-agent: post missing caption");
    }
    if (!post.suggestedAt || Number.isNaN(Date.parse(post.suggestedAt))) {
      throw new Error(
        "content-agent: post suggestedAt is not a valid ISO date",
      );
    }
  }
  return plan;
}
