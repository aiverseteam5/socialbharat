import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addConversationTagsSchema } from "@/types/schemas";
import { logger } from "@/lib/logger";

/**
 * POST /api/inbox/conversations/[id]/tags
 * Merge tags into the conversation's tag array (deduplicated).
 */
export async function POST(
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
    const parsed = addConversationTagsSchema.parse(body);

    const { data: existing, error: fetchErr } = await supabase
      .from("conversations")
      .select("id, tags")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    const currentTags: string[] = Array.isArray(existing.tags)
      ? existing.tags
      : [];
    const merged = Array.from(new Set([...currentTags, ...parsed.tags]));

    const { data, error } = await supabase
      .from("conversations")
      .update({ tags: merged, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ conversation: data });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    logger.error("POST /api/inbox/conversations/[id]/tags failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to add tags",
      },
      { status: 500 },
    );
  }
}
