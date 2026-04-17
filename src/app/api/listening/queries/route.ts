import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkPlanLimit } from "@/lib/plan-limits";
import { createListeningQuerySchema } from "@/types/schemas";
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

    if (!["owner", "admin"].includes(orgMember.role)) {
      return NextResponse.json(
        { error: "Only owners and admins can create listening queries" },
        { status: 403 },
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

    const body = await request.json();
    const parsed = createListeningQuerySchema.parse(body);

    const { data: query, error } = await supabase
      .from("listening_queries")
      .insert({
        org_id: orgMember.org_id,
        created_by: user.id,
        name: parsed.name,
        keywords: parsed.keywords,
        excluded_keywords: parsed.excluded_keywords,
        platforms: parsed.platforms,
        languages: parsed.languages,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ query }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 },
      );
    }
    logger.error("POST /api/listening/queries failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
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

    const { data: queries, error } = await supabase
      .from("listening_queries")
      .select("*")
      .eq("org_id", orgMember.org_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ queries });
  } catch (error) {
    logger.error("GET /api/listening/queries failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
