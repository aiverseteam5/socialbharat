import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateConversationStatusSchema } from "@/types/schemas";
import { logger } from "@/lib/logger";

/**
 * PUT /api/inbox/conversations/[id]/status
 * Update conversation status (open / closed / snoozed).
 * 'assigned' is reserved for the assign endpoint.
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
    const parsed = updateConversationStatusSchema.parse(body);

    const { data, error } = await supabase
      .from("conversations")
      .update({
        status: parsed.status,
        updated_at: new Date().toISOString(),
      })
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
    logger.error("PUT /api/inbox/conversations/[id]/status failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update status",
      },
      { status: 500 },
    );
  }
}
