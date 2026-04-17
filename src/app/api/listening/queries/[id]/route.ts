import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkPlanLimit } from "@/lib/plan-limits";
import { createListeningQuerySchema } from "@/types/schemas";
import { logger } from "@/lib/logger";
import { ZodError, z } from "zod";

const idSchema = z.object({ id: z.string().uuid() });

const PLAN_DENIED = NextResponse.json(
  {
    error: "Social listening is not available on your plan",
    code: "PLAN_LIMIT_EXCEEDED",
  },
  { status: 403 },
);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { id: queryId } = idSchema.parse({ id });

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

    if (!(await checkPlanLimit(orgMember.org_id, "social_listening")))
      return PLAN_DENIED;

    const { data: query, error } = await supabase
      .from("listening_queries")
      .select("*")
      .eq("id", queryId)
      .eq("org_id", orgMember.org_id)
      .single();

    if (error || !query) {
      return NextResponse.json({ error: "Query not found" }, { status: 404 });
    }

    return NextResponse.json({ query });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid query ID" }, { status: 400 });
    }
    logger.error("GET /api/listening/queries/[id] failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { id: queryId } = idSchema.parse({ id });

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
        { error: "Only owners and admins can update listening queries" },
        { status: 403 },
      );
    }

    if (!(await checkPlanLimit(orgMember.org_id, "social_listening")))
      return PLAN_DENIED;

    const body = await request.json();
    const parsed = createListeningQuerySchema.partial().parse(body);

    const { data: query, error } = await supabase
      .from("listening_queries")
      .update(parsed)
      .eq("id", queryId)
      .eq("org_id", orgMember.org_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Query not found or update failed" },
        { status: 404 },
      );
    }

    return NextResponse.json({ query });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 },
      );
    }
    logger.error("PUT /api/listening/queries/[id] failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { id: queryId } = idSchema.parse({ id });

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
        { error: "Only owners and admins can delete listening queries" },
        { status: 403 },
      );
    }

    if (!(await checkPlanLimit(orgMember.org_id, "social_listening")))
      return PLAN_DENIED;

    // Use .select() to confirm a row was actually matched and updated (W-2)
    const { data: updated, error } = await supabase
      .from("listening_queries")
      .update({ is_active: false })
      .eq("id", queryId)
      .eq("org_id", orgMember.org_id)
      .select("id");

    if (error) {
      logger.error("DELETE /api/listening/queries/[id] db error", error);
      return NextResponse.json(
        { error: "Deactivation failed" },
        { status: 500 },
      );
    }

    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: "Query not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid query ID" }, { status: 400 });
    }
    logger.error("DELETE /api/listening/queries/[id] failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
