import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assignConversationSchema } from "@/types/schemas";
import { logger } from "@/lib/logger";

/**
 * PUT /api/inbox/conversations/[id]/assign
 * Assign a conversation to a team member and bump status to 'assigned'.
 * Creates an in-app notification for the assignee.
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
    const parsed = assignConversationSchema.parse(body);

    const { data: conversation, error: convErr } = await supabase
      .from("conversations")
      .update({
        assigned_to: parsed.assigned_to,
        status: "assigned",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, org_id, platform")
      .single();

    if (convErr || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    // Notification — best-effort; do not fail the assignment if this errors.
    const { error: notifErr } = await supabase.from("notifications").insert({
      user_id: parsed.assigned_to,
      org_id: conversation.org_id,
      type: "conversation_assigned",
      title: "New conversation assigned",
      body: `A ${conversation.platform} conversation was assigned to you`,
      link: `/dashboard/inbox/${conversation.id}`,
    });
    if (notifErr) {
      logger.warn("Failed to create assignment notification", {
        error: notifErr.message,
      });
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    logger.error("PUT /api/inbox/conversations/[id]/assign failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to assign conversation",
      },
      { status: 500 },
    );
  }
}
