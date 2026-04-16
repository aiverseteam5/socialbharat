import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateConversationSchema } from "@/types/schemas";
import { logger } from "@/lib/logger";

/**
 * GET /api/inbox/conversations/[id]
 * Conversation detail + messages (oldest first) + contact profile.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: conversation, error } = await supabase
      .from("conversations")
      .select(
        `
        *,
        contact:contacts!contact_id (
          id, display_name, avatar_url, platform_user_id, platform,
          metadata, created_at
        )
        `,
      )
      .eq("id", id)
      .single();

    if (error || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    const { data: messages, error: msgErr } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (msgErr) throw msgErr;

    return NextResponse.json({ conversation, messages: messages ?? [] });
  } catch (error) {
    logger.error("GET /api/inbox/conversations/[id] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch conversation",
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/inbox/conversations/[id]
 * Update conversation fields (status, assigned_to, tags, sentiment, language).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateConversationSchema.parse(body);

    const { data, error } = await supabase
      .from("conversations")
      .update({ ...parsed, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Conversation not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ conversation: data });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    logger.error("PUT /api/inbox/conversations/[id] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update conversation",
      },
      { status: 500 },
    );
  }
}
