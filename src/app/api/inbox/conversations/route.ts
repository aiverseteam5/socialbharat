import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listConversationsSchema } from "@/types/schemas";
import { logger } from "@/lib/logger";

/**
 * GET /api/inbox/conversations
 * List conversations for the current org with filters and cursor pagination.
 * Filters: platform, status, assigned_to, search (contact display_name).
 * Pagination: cursor is last_message_at timestamp; limit default 20.
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

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = listConversationsSchema.parse(params);

    const { data: orgMember } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (!orgMember) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 403 },
      );
    }

    let query = supabase
      .from("conversations")
      .select(
        `
        id, platform, type, status, assigned_to, tags,
        sentiment_score, language_detected, last_message_at, created_at,
        auto_reply_paused_at,
        contact:contacts!contact_id (id, display_name, avatar_url, platform_user_id),
        latest_message:messages!conversation_id (id, content, sender_type, created_at)
        `,
      )
      .eq("org_id", orgMember.org_id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(parsed.limit);

    if (parsed.platform) query = query.eq("platform", parsed.platform);
    if (parsed.status) query = query.eq("status", parsed.status);
    if (parsed.assigned_to) query = query.eq("assigned_to", parsed.assigned_to);
    if (parsed.cursor) query = query.lt("last_message_at", parsed.cursor);

    const { data, error } = await query;
    if (error) throw error;

    let conversations = data ?? [];

    // Search is applied after join since PostgREST can't filter on joined-table
    // fields with `.ilike` cleanly. For Phase 3 MVP this client-side filter is
    // fine — result sets are bounded by `limit`.
    if (parsed.search) {
      const needle = parsed.search.toLowerCase();
      conversations = conversations.filter((c) => {
        const contact = Array.isArray(c.contact) ? c.contact[0] : c.contact;
        return contact?.display_name?.toLowerCase().includes(needle);
      });
    }

    const nextCursor =
      conversations.length === parsed.limit
        ? (conversations[conversations.length - 1]?.last_message_at ?? null)
        : null;

    return NextResponse.json({ conversations, next_cursor: nextCursor });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid query parameters" },
        { status: 400 },
      );
    }
    logger.error("GET /api/inbox/conversations failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to list conversations",
      },
      { status: 500 },
    );
  }
}
