import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createListeningQuerySchema } from "@/types/schemas";
import { logger } from "@/lib/logger";
import { ZodError, z } from "zod";

const idSchema = z.object({ id: z.string().uuid() });

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

    const { error } = await supabase
      .from("listening_queries")
      .update({ is_active: false })
      .eq("id", queryId)
      .eq("org_id", orgMember.org_id);

    if (error) {
      return NextResponse.json(
        { error: "Query not found or deactivation failed" },
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
