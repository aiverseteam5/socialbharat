import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveDateRange } from "@/lib/analytics-range";
import { analyticsPostsQuerySchema } from "@/types/schemas";
import { logger } from "@/lib/logger";

interface PostMetricsJoinRow {
  post_id: string;
  social_profile_id: string | null;
  platform_post_id: string | null;
  impressions: number;
  reach: number;
  engagements: number;
  clicks: number;
  shares: number;
  comments: number;
  likes: number;
  fetched_at: string;
  posts: {
    id: string;
    content: string;
    published_at: string | null;
    org_id: string;
  } | null;
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
    const queryParsed = analyticsPostsQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!queryParsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters" },
        { status: 400 },
      );
    }
    const { page, limit } = queryParsed.data;
    const range = resolveDateRange(
      queryParsed.data.start_date,
      queryParsed.data.end_date,
    );
    const offset = (page - 1) * limit;

    const {
      data: rows,
      error,
      count,
    } = await supabase
      .from("post_metrics")
      .select(
        `post_id, social_profile_id, platform_post_id, impressions, reach,
         engagements, clicks, shares, comments, likes, fetched_at,
         posts:posts!inner(id, content, published_at, org_id)`,
        { count: "exact" },
      )
      .eq("posts.org_id", orgId)
      .gte("fetched_at", `${range.start}T00:00:00.000Z`)
      .lte("fetched_at", `${range.end}T23:59:59.999Z`)
      .order("engagements", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const items = ((rows ?? []) as unknown as PostMetricsJoinRow[])
      .filter((row) => row.posts !== null)
      .map((row) => ({
        post_id: row.post_id,
        social_profile_id: row.social_profile_id,
        platform_post_id: row.platform_post_id,
        content: row.posts?.content ?? "",
        published_at: row.posts?.published_at ?? null,
        impressions: row.impressions,
        reach: row.reach,
        engagements: row.engagements,
        clicks: row.clicks,
        shares: row.shares,
        comments: row.comments,
        likes: row.likes,
        fetched_at: row.fetched_at,
      }));

    return NextResponse.json({
      range,
      items,
      pagination: {
        page,
        limit,
        total: count ?? items.length,
        pages: Math.ceil((count ?? items.length) / limit),
      },
    });
  } catch (error) {
    logger.error("GET /api/analytics/posts failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load post analytics",
      },
      { status: 500 },
    );
  }
}
