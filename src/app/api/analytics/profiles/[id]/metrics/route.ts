import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveDateRange } from "@/lib/analytics-range";
import { analyticsQuerySchema } from "@/types/schemas";
import { logger } from "@/lib/logger";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      return NextResponse.json(
        { error: "Invalid profile id" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // RLS restricts profile_metrics to profiles the user can see via org
    // membership. We still fetch the profile to return its metadata alongside
    // the time series.
    const { data: profile, error: profileError } = await supabase
      .from("social_profiles")
      .select("id, platform, profile_name, org_id")
      .eq("id", id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

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

    const { data: metricsRows, error } = await supabase
      .from("profile_metrics")
      .select(
        "metric_date, followers_count, impressions, reach, engagements, engagement_rate, clicks, shares, comments, likes",
      )
      .eq("social_profile_id", id)
      .gte("metric_date", range.start)
      .lte("metric_date", range.end)
      .order("metric_date", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      profile: {
        id: profile.id,
        platform: profile.platform,
        profile_name: profile.profile_name,
      },
      range,
      series: metricsRows ?? [],
    });
  } catch (error) {
    logger.error("GET /api/analytics/profiles/[id]/metrics failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load profile metrics",
      },
      { status: 500 },
    );
  }
}
