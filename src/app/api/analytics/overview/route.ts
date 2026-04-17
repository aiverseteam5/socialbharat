import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { previousPeriod, resolveDateRange } from "@/lib/analytics-range";
import { analyticsQuerySchema } from "@/types/schemas";
import { logger } from "@/lib/logger";

interface MetricsRow {
  social_profile_id: string;
  metric_date: string;
  followers_count: number;
  impressions: number;
  reach: number;
  engagements: number;
  engagement_rate: number;
  clicks: number;
}

interface PostMetricsRow {
  post_id: string;
  impressions: number;
  engagements: number;
  likes: number;
  comments: number;
  shares: number;
  posts: { id: string; content: string; published_at: string | null } | null;
}

function sum(rows: MetricsRow[], key: keyof MetricsRow): number {
  return rows.reduce((acc, row) => acc + Number(row[key] ?? 0), 0);
}

function latestFollowersByProfile(rows: MetricsRow[]): number {
  const byProfile = new Map<string, MetricsRow>();
  for (const row of rows) {
    const current = byProfile.get(row.social_profile_id);
    if (!current || current.metric_date < row.metric_date) {
      byProfile.set(row.social_profile_id, row);
    }
  }
  let total = 0;
  for (const row of byProfile.values()) {
    total += Number(row.followers_count ?? 0);
  }
  return total;
}

function avgEngagementRate(rows: MetricsRow[]): number {
  if (rows.length === 0) return 0;
  const totalFollowers = sum(rows, "followers_count");
  if (totalFollowers <= 0) {
    const mean =
      rows.reduce((a, r) => a + Number(r.engagement_rate ?? 0), 0) /
      rows.length;
    return Number(mean.toFixed(4));
  }
  return Number(((sum(rows, "engagements") / totalFollowers) * 100).toFixed(4));
}

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

    const orgId = orgMember.org_id;
    const queryParsed = analyticsQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!queryParsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters" },
        { status: 400 },
      );
    }
    const range = resolveDateRange(
      queryParsed.data.start_date,
      queryParsed.data.end_date,
    );

    const { data: profiles } = await supabase
      .from("social_profiles")
      .select("id, platform, profile_name")
      .eq("org_id", orgId);

    const profileIds = (profiles ?? []).map((p) => p.id);

    if (profileIds.length === 0) {
      return NextResponse.json({
        range,
        totals: {
          followers: 0,
          impressions: 0,
          reach: 0,
          engagements: 0,
          clicks: 0,
          engagement_rate: 0,
        },
        previous: {
          followers: 0,
          impressions: 0,
          reach: 0,
          engagements: 0,
          clicks: 0,
          engagement_rate: 0,
        },
        top_posts: [],
        profile_count: 0,
      });
    }

    const { data: metricsRows, error: metricsError } = await supabase
      .from("profile_metrics")
      .select(
        "social_profile_id, metric_date, followers_count, impressions, reach, engagements, engagement_rate, clicks",
      )
      .in("social_profile_id", profileIds)
      .gte("metric_date", range.start)
      .lte("metric_date", range.end);

    if (metricsError) throw metricsError;

    const prev = previousPeriod(range);
    const { data: prevRows } = await supabase
      .from("profile_metrics")
      .select(
        "social_profile_id, metric_date, followers_count, impressions, reach, engagements, engagement_rate, clicks",
      )
      .in("social_profile_id", profileIds)
      .gte("metric_date", prev.start)
      .lte("metric_date", prev.end);

    const current = (metricsRows ?? []) as MetricsRow[];
    const previous = (prevRows ?? []) as MetricsRow[];

    const totals = {
      followers: latestFollowersByProfile(current),
      impressions: sum(current, "impressions"),
      reach: sum(current, "reach"),
      engagements: sum(current, "engagements"),
      clicks: sum(current, "clicks"),
      engagement_rate: avgEngagementRate(current),
    };

    const previousTotals = {
      followers: latestFollowersByProfile(previous),
      impressions: sum(previous, "impressions"),
      reach: sum(previous, "reach"),
      engagements: sum(previous, "engagements"),
      clicks: sum(previous, "clicks"),
      engagement_rate: avgEngagementRate(previous),
    };

    const { data: postMetricsRows } = await supabase
      .from("post_metrics")
      .select(
        `post_id, impressions, engagements, likes, comments, shares,
         posts:posts!inner(id, content, published_at, org_id)`,
      )
      .eq("posts.org_id", orgId)
      .gte("fetched_at", `${range.start}T00:00:00.000Z`)
      .lte("fetched_at", `${range.end}T23:59:59.999Z`)
      .order("engagements", { ascending: false })
      .limit(5);

    const topPosts = ((postMetricsRows ?? []) as unknown as PostMetricsRow[])
      .filter((row) => row.posts !== null)
      .slice(0, 5)
      .map((row) => ({
        post_id: row.post_id,
        content: row.posts?.content ?? "",
        published_at: row.posts?.published_at ?? null,
        impressions: row.impressions,
        engagements: row.engagements,
        likes: row.likes,
        comments: row.comments,
        shares: row.shares,
      }));

    return NextResponse.json({
      range,
      totals,
      previous: previousTotals,
      top_posts: topPosts,
      profile_count: profileIds.length,
    });
  } catch (error) {
    logger.error("GET /api/analytics/overview failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load analytics",
      },
      { status: 500 },
    );
  }
}
