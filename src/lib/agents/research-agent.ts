/**
 * Research sub-agent.
 *
 * Two deterministic helpers + one Claude-backed synthesis:
 *
 * 1. getUpcomingFestivals — queries indian_festivals for rows in the next N
 *    days. No LLM call; just DB.
 *
 * 2. getTrendingTopics — asks Claude for a short trend report tailored to the
 *    org's industry + language. Cached 4h in Redis (shared BullMQ connection)
 *    so multiple agent runs in the same day don't re-bill.
 *
 * 3. runResearch — composes the two into a `ResearchBundle` that the content
 *    agent consumes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRedisConnection } from "@/lib/queue/connection";
import {
  getAnthropicClient,
  ANTHROPIC_MODEL,
  extractText,
  parseJsonFromResponse,
} from "./anthropic-client";
import type { FestivalHint, TrendReport } from "./types";
import { logger } from "@/lib/logger";

const TREND_CACHE_TTL_SECONDS = 4 * 60 * 60; // 4h

export async function getUpcomingFestivals(
  supabase: SupabaseClient,
  params: { days: number; regions?: string[] },
): Promise<FestivalHint[]> {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + params.days);

  const { data, error } = await supabase
    .from("indian_festivals")
    .select(
      "id, name, name_hi, festival_date, regions, suggested_hashtags, content_ideas",
    )
    .gte("festival_date", today.toISOString().slice(0, 10))
    .lte("festival_date", end.toISOString().slice(0, 10))
    .order("festival_date", { ascending: true })
    .limit(10);

  if (error) {
    logger.warn("research-agent: festivals query failed", {
      error: error.message,
    });
    return [];
  }

  const regions = params.regions;
  return (data ?? [])
    .filter((row) => {
      if (!regions || regions.length === 0) return true;
      const festivalRegions: string[] = row.regions ?? [];
      if (festivalRegions.includes("ALL")) return true;
      return festivalRegions.some((r) => regions.includes(r));
    })
    .map((row) => ({
      id: row.id,
      name: row.name,
      nameHi: row.name_hi ?? null,
      date: row.festival_date,
      regions: row.regions ?? [],
      suggestedHashtags: row.suggested_hashtags ?? [],
      contentIdeas: row.content_ideas ?? [],
    }));
}

function trendCacheKey(params: {
  industry: string;
  language: string;
  audience: string;
}): string {
  const slug = [params.industry, params.language, params.audience]
    .map((s) =>
      s
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-"),
    )
    .join(":");
  return `agent:trends:${slug}`;
}

export async function getTrendingTopics(params: {
  industry: string;
  language: string;
  audience: string;
  systemPrompt: string;
}): Promise<TrendReport> {
  const cacheKey = trendCacheKey(params);
  const redis = getRedisConnection();

  const cached = await redis.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as TrendReport;
    } catch {
      // fall through to regenerate
    }
  }

  const userPrompt = [
    `Generate a short social-media trend report for an Indian ${params.industry} brand.`,
    `Target audience: ${params.audience || "general Indian audience"}.`,
    `Primary language: ${params.language || "en"}.`,
    "",
    "Return ONLY JSON matching this shape:",
    "{",
    '  "summary": "one paragraph, max 400 chars",',
    '  "topics": [',
    '    { "topic": "...", "why": "...", "suggestedAngle": "..." }',
    "  ]",
    "}",
    "",
    "Return between 3 and 5 topics. No prose outside the JSON.",
  ].join("\n");

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1024,
    system: params.systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = extractText(response.content);
  const parsed = parseJsonFromResponse<Omit<TrendReport, "generatedAt">>(text);
  const report: TrendReport = {
    summary: parsed.summary ?? "",
    topics: parsed.topics ?? [],
    generatedAt: new Date().toISOString(),
  };

  await redis.set(
    cacheKey,
    JSON.stringify(report),
    "EX",
    TREND_CACHE_TTL_SECONDS,
  );
  return report;
}

export interface ResearchBundle {
  festivals: FestivalHint[];
  trends: TrendReport;
}

export async function runResearch(params: {
  supabase: SupabaseClient;
  industry: string;
  language: string;
  audience: string;
  regions?: string[];
  systemPrompt: string;
  days?: number;
}): Promise<ResearchBundle> {
  const [festivals, trends] = await Promise.all([
    getUpcomingFestivals(params.supabase, {
      days: params.days ?? 14,
      regions: params.regions,
    }),
    getTrendingTopics({
      industry: params.industry,
      language: params.language,
      audience: params.audience,
      systemPrompt: params.systemPrompt,
    }),
  ]);
  return { festivals, trends };
}
