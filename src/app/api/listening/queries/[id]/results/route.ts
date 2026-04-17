import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { z, ZodError } from "zod";

const idSchema = z.object({ id: z.string().uuid() });

const resultsQuerySchema = z.object({
  platform: z.string().optional(),
  sentiment: z.enum(["positive", "negative", "neutral", "mixed"]).optional(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(
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

    // Confirm query belongs to this org
    const { data: query } = await supabase
      .from("listening_queries")
      .select("id")
      .eq("id", queryId)
      .eq("org_id", orgMember.org_id)
      .single();

    if (!query) {
      return NextResponse.json({ error: "Query not found" }, { status: 404 });
    }

    const sp = request.nextUrl.searchParams;
    const filters = resultsQuerySchema.parse({
      platform: sp.get("platform") ?? undefined,
      sentiment: sp.get("sentiment") ?? undefined,
      start_date: sp.get("start_date") ?? undefined,
      end_date: sp.get("end_date") ?? undefined,
      page: sp.get("page") ?? 1,
      page_size: sp.get("page_size") ?? 20,
    });

    const from = (filters.page - 1) * filters.page_size;
    const to = from + filters.page_size - 1;

    let q = supabase
      .from("listening_mentions")
      .select("*", { count: "exact" })
      .eq("query_id", queryId)
      .order("posted_at", { ascending: false })
      .range(from, to);

    if (filters.platform) q = q.eq("platform", filters.platform);
    if (filters.sentiment) q = q.eq("sentiment_label", filters.sentiment);
    if (filters.start_date)
      q = q.gte("posted_at", `${filters.start_date}T00:00:00Z`);
    if (filters.end_date)
      q = q.lte("posted_at", `${filters.end_date}T23:59:59Z`);

    const { data: mentions, count, error } = await q;

    if (error) throw error;

    return NextResponse.json({
      mentions,
      pagination: {
        page: filters.page,
        page_size: filters.page_size,
        total: count ?? 0,
        total_pages: Math.ceil((count ?? 0) / filters.page_size),
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 },
      );
    }
    logger.error("GET /api/listening/queries/[id]/results failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
