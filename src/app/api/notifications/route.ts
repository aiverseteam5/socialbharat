import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  unread_only: z.enum(["true", "false"]).optional(),
});

/**
 * GET /api/notifications
 * Paginated list of the authenticated user's notifications, newest first.
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

    const parsed = querySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query params" },
        { status: 400 },
      );
    }

    const { limit, offset, unread_only } = parsed.data;

    let query = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (unread_only === "true") {
      query = query.eq("is_read", false);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    const unreadCount = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false)
      .then((r) => r.count ?? 0);

    return NextResponse.json({
      notifications: data ?? [],
      total: count ?? 0,
      unread_count: unreadCount,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch notifications",
      },
      { status: 500 },
    );
  }
}
