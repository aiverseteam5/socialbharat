import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * POST /api/inbox/conversations/[id]/auto-reply
 *   Pauses auto-reply on this conversation by stamping
 *   `auto_reply_paused_at = NOW()`. Idempotent — repeat calls just refresh
 *   the timestamp.
 *
 * DELETE /api/inbox/conversations/[id]/auto-reply
 *   Resumes auto-reply by clearing the timestamp. RLS scopes both writes
 *   to the caller's org.
 */
export async function POST(
  _request: NextRequest,
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

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("conversations")
      .update({ auto_reply_paused_at: now, updated_at: now })
      .eq("id", id)
      .select("id, auto_reply_paused_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ conversation: data });
  } catch (error) {
    logger.error("POST /api/inbox/conversations/[id]/auto-reply failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to pause auto-reply",
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
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("conversations")
      .update({ auto_reply_paused_at: null, updated_at: now })
      .eq("id", id)
      .select("id, auto_reply_paused_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ conversation: data });
  } catch (error) {
    logger.error(
      "DELETE /api/inbox/conversations/[id]/auto-reply failed",
      error,
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to resume auto-reply",
      },
      { status: 500 },
    );
  }
}
