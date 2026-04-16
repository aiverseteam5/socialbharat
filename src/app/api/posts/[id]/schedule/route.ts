import { createClient } from "@/lib/supabase/server";
import { schedulePostSchema } from "@/types/schemas";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/posts/[id]/schedule
 * Schedule a post for future publishing
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

    const postId = id;
    const body = await request.json();
    const parsed = schedulePostSchema.parse(body);

    // Validate scheduled_at is in the future
    const scheduledAt = new Date(parsed.scheduled_at);
    const now = new Date();

    if (scheduledAt <= now) {
      return NextResponse.json(
        { error: "Scheduled time must be in the future" },
        { status: 400 },
      );
    }

    // Get user's organization
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

    const orgId = orgMember.org_id;

    // Verify post exists and belongs to org
    const { data: existingPost } = await supabase
      .from("posts")
      .select("id, status")
      .eq("id", postId)
      .eq("org_id", orgId)
      .single();

    if (!existingPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Only draft or pending_approval posts can be scheduled
    if (
      existingPost.status !== "draft" &&
      existingPost.status !== "pending_approval"
    ) {
      return NextResponse.json(
        { error: "Can only schedule draft or pending_approval posts" },
        { status: 400 },
      );
    }

    // Update post with scheduled time
    const { data: post, error } = await supabase
      .from("posts")
      .update({
        status: "scheduled",
        scheduled_at: scheduledAt,
        updated_at: new Date(),
      })
      .eq("id", postId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to schedule post",
      },
      { status: 500 },
    );
  }
}
