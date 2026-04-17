import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkPlanLimit } from "@/lib/plan-limits";
import { logger } from "@/lib/logger";
import { z, ZodError } from "zod";

const trendsQuerySchema = z.object({
  query_id: z.string().uuid().optional(),
  days: z.coerce.number().int().min(1).max(90).default(30),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: orgMember } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (!orgMember) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 400 },
      );
    }

    const allowed = await checkPlanLimit(orgMember.org_id, "social_listening");
    if (!allowed) {
      return NextResponse.json(
        {
          error: "Social listening is not available on your plan",
          code: "PLAN_LIMIT_EXCEEDED",
        },
        { status: 403 },
      );
    }

    const sp = request.nextUrl.searchParams;
    const filters = trendsQuerySchema.parse({
      query_id: sp.get("query_id") ?? undefined,
      days: sp.get("days") ?? 30,
    });

    const since = new Date();
    since.setDate(since.getDate() - filters.days);
    const sinceISO = since.toISOString();

    // Get all query IDs for this org (or filter to specific query)
    let queryIds: string[] = [];
    if (filters.query_id) {
      const { data: q } = await supabase
        .from("listening_queries")
        .select("id")
        .eq("id", filters.query_id)
        .eq("org_id", orgMember.org_id)
        .single();
      if (!q)
        return NextResponse.json({ error: "Query not found" }, { status: 404 });
      queryIds = [filters.query_id];
    } else {
      const { data: queries } = await supabase
        .from("listening_queries")
        .select("id")
        .eq("org_id", orgMember.org_id)
        .eq("is_active", true);
      queryIds = (queries ?? []).map((q) => q.id);
    }

    if (queryIds.length === 0) {
      return NextResponse.json({
        time_series: [],
        top_keywords: [],
        sentiment_distribution: {
          positive: 0,
          negative: 0,
          neutral: 0,
          mixed: 0,
        },
        total_mentions: 0,
      });
    }

    const { data: mentions, error } = await supabase
      .from("listening_mentions")
      .select("posted_at, sentiment_label, content, platform")
      .in("query_id", queryIds)
      .gte("posted_at", sinceISO)
      .order("posted_at", { ascending: true });

    if (error) throw error;

    // Build daily time series
    const dayMap = new Map<
      string,
      {
        date: string;
        count: number;
        positive: number;
        negative: number;
        neutral: number;
        mixed: number;
      }
    >();
    for (const mention of mentions ?? []) {
      if (!mention.posted_at) continue;
      const day = mention.posted_at.slice(0, 10);
      if (!dayMap.has(day)) {
        dayMap.set(day, {
          date: day,
          count: 0,
          positive: 0,
          negative: 0,
          neutral: 0,
          mixed: 0,
        });
      }
      const entry = dayMap.get(day)!;
      entry.count++;
      if (mention.sentiment_label === "positive") entry.positive++;
      else if (mention.sentiment_label === "negative") entry.negative++;
      else if (mention.sentiment_label === "mixed") entry.mixed++;
      else entry.neutral++;
    }

    const time_series = Array.from(dayMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    // Detect volume spikes: days with 3x the rolling average
    const avgVolume =
      time_series.length > 0
        ? time_series.reduce((s, d) => s + d.count, 0) / time_series.length
        : 0;
    const spikes = time_series
      .filter((d) => avgVolume > 0 && d.count >= avgVolume * 3)
      .map((d) => d.date);

    // Sentiment totals
    const sentiment_distribution = {
      positive: 0,
      negative: 0,
      neutral: 0,
      mixed: 0,
    };
    for (const m of mentions ?? []) {
      if (m.sentiment_label === "positive") sentiment_distribution.positive++;
      else if (m.sentiment_label === "negative")
        sentiment_distribution.negative++;
      else if (m.sentiment_label === "mixed") sentiment_distribution.mixed++;
      else sentiment_distribution.neutral++;
    }

    // Simple keyword frequency from mention content
    const wordFreq = new Map<string, number>();
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "is",
      "are",
      "was",
      "were",
      "and",
      "or",
      "in",
      "on",
      "at",
      "to",
      "of",
      "for",
      "with",
      "this",
      "that",
      "it",
      "i",
      "you",
      "we",
      "they",
      "he",
      "she",
      "be",
      "been",
      "have",
      "has",
      "do",
      "did",
      "not",
      "but",
      "so",
    ]);
    for (const m of mentions ?? []) {
      if (!m.content) continue;
      const words = m.content
        .toLowerCase()
        .replace(/[^a-z0-9\u0900-\u097f\s]/g, "")
        .split(/\s+/);
      for (const word of words) {
        if (word.length < 3 || stopWords.has(word)) continue;
        wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
      }
    }
    const top_keywords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([keyword, count]) => ({ keyword, count }));

    return NextResponse.json({
      time_series,
      top_keywords,
      sentiment_distribution,
      total_mentions: (mentions ?? []).length,
      spikes,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 },
      );
    }
    logger.error("GET /api/listening/trends failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
