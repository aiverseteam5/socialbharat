import { createClient } from "@/lib/supabase/server";
import { createPostSchema } from "@/types/schemas";
import { checkNumericLimit } from "@/lib/plan-limits";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/posts
 * Create a new post
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createPostSchema.parse(body);

    // Get user's organization
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

    // Plan gate: monthly post cap + scheduled-post cap.
    const isScheduled = Boolean(parsed.scheduled_at);
    const monthly = await checkNumericLimit(orgId, "max_posts_per_month");
    if (!monthly.allowed) {
      return NextResponse.json(
        {
          error: "Monthly post limit reached for your plan",
          code: "PLAN_LIMIT_EXCEEDED",
          limit: { current: monthly.current, max: monthly.max },
        },
        { status: 403 },
      );
    }
    if (isScheduled) {
      const scheduled = await checkNumericLimit(orgId, "max_scheduled_posts");
      if (!scheduled.allowed) {
        return NextResponse.json(
          {
            error: "Scheduled post limit reached for your plan",
            code: "PLAN_LIMIT_EXCEEDED",
            limit: { current: scheduled.current, max: scheduled.max },
          },
          { status: 403 },
        );
      }
    }

    // Create post
    const { data: post, error } = await supabase
      .from("posts")
      .insert({
        org_id: orgId,
        content: parsed.content,
        content_json: parsed.content_json,
        media_urls: parsed.media_urls,
        platforms: parsed.platforms,
        status: parsed.status,
        scheduled_at: parsed.scheduled_at
          ? new Date(parsed.scheduled_at)
          : null,
        campaign_id: parsed.campaign_id,
        tags: parsed.tags,
        language: parsed.language,
        festival_context: parsed.festival_context,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create post",
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/posts
 * List posts for current organization with filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
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
    const searchParams = request.nextUrl.searchParams;

    // Parse filters
    const status = searchParams.get("status");
    const campaignId = searchParams.get("campaign_id");
    const platform = searchParams.get("platform");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    // Parse pagination
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;

    let query = supabase
      .from("posts")
      .select("*", { count: "exact" })
      .eq("org_id", orgId);

    if (status) {
      query = query.eq("status", status);
    }

    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }

    if (platform) {
      query = query.contains("platforms", [platform]);
    }

    if (startDate) {
      query = query.gte("created_at", startDate);
    }

    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: posts, error, count } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      posts: posts || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch posts",
      },
      { status: 500 },
    );
  }
}
