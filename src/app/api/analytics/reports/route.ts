import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveReportSchema } from "@/types/schemas";
import { checkPlanLimit } from "@/lib/plan-limits";
import { logger } from "@/lib/logger";
import { ZodError } from "zod";

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
    const parsed = saveReportSchema.parse(body);

    const { data: orgMember } = await supabase
      .from("org_members")
      .select("org_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!orgMember) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 400 },
      );
    }

    if (!["owner", "admin", "editor"].includes(orgMember.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions to save reports" },
        { status: 403 },
      );
    }

    const customReportsAllowed = await checkPlanLimit(
      orgMember.org_id,
      "custom_reports",
    );
    if (!customReportsAllowed) {
      return NextResponse.json(
        { error: "Plan limit reached", code: "PLAN_LIMIT_EXCEEDED" },
        { status: 403 },
      );
    }

    // Confirm every profile belongs to this org (defense in depth on top of
    // RLS for shared-report attack surface).
    const { data: profiles } = await supabase
      .from("social_profiles")
      .select("id")
      .eq("org_id", orgMember.org_id)
      .in("id", parsed.profile_ids);

    if (!profiles || profiles.length !== parsed.profile_ids.length) {
      return NextResponse.json(
        { error: "One or more profiles do not belong to this organization" },
        { status: 400 },
      );
    }

    const { data: report, error } = await supabase
      .from("analytics_reports")
      .insert({
        org_id: orgMember.org_id,
        created_by: user.id,
        name: parsed.name,
        profile_ids: parsed.profile_ids,
        metrics: parsed.metrics,
        start_date: parsed.start_date,
        end_date: parsed.end_date,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.errors },
        { status: 400 },
      );
    }
    logger.error("POST /api/analytics/reports failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save report",
      },
      { status: 500 },
    );
  }
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

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10)),
    );

    const { data: reports, error } = await supabase
      .from("analytics_reports")
      .select("*")
      .eq("org_id", orgMember.org_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ reports: reports ?? [] });
  } catch (error) {
    logger.error("GET /api/analytics/reports failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load reports",
      },
      { status: 500 },
    );
  }
}
