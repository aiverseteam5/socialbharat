import { createClient } from "@/lib/supabase/server";
import { updatePostSchema } from "@/types/schemas";
import {
  cancelScheduledPost,
  schedulePost,
  SchedulerValidationError,
} from "@/lib/queue/scheduler";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const rescheduleSchema = z.object({
  scheduled_at: z.string().datetime({ message: "Valid ISO datetime required" }),
});

/**
 * GET /api/posts/[id]
 * Get post details
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

    const postId = id;

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

    // Fetch post
    const { data: post, error } = await supabase
      .from("posts")
      .select("*")
      .eq("id", postId)
      .eq("org_id", orgId)
      .single();

    if (error) {
      throw error;
    }

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch post",
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/posts/[id]
 * Update post (only if draft or rejected)
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

    const postId = id;
    const body = await request.json();
    const parsed = updatePostSchema.parse(body);

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

    // Check if post exists and is editable
    const { data: existingPost } = await supabase
      .from("posts")
      .select("status")
      .eq("id", postId)
      .eq("org_id", orgId)
      .single();

    if (!existingPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (existingPost.status !== "draft" && existingPost.status !== "rejected") {
      return NextResponse.json(
        { error: "Can only update draft or rejected posts" },
        { status: 400 },
      );
    }

    // Update post
    const { data: post, error } = await supabase
      .from("posts")
      .update({
        content: parsed.content,
        content_json: parsed.content_json,
        media_urls: parsed.media_urls,
        platforms: parsed.platforms,
        scheduled_at: parsed.scheduled_at
          ? new Date(parsed.scheduled_at)
          : null,
        campaign_id: parsed.campaign_id,
        tags: parsed.tags,
        language: parsed.language,
        festival_context: parsed.festival_context,
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
        error: error instanceof Error ? error.message : "Failed to update post",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/posts/[id]
 * Delete post
 */
export async function DELETE(
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

    // Verify post belongs to org
    const { data: existingPost } = await supabase
      .from("posts")
      .select("id, queue_job_id")
      .eq("id", postId)
      .eq("org_id", orgId)
      .single();

    if (!existingPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Drop any pending BullMQ delayed job before deleting the row.
    if (existingPost.queue_job_id) {
      await cancelScheduledPost(existingPost.queue_job_id);
    }

    // Delete post
    const { error } = await supabase.from("posts").delete().eq("id", postId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete post",
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/posts/[id]
 * Reschedule a post (drag-and-drop calendar). Updates scheduled_at for draft or scheduled posts.
 */
export async function PATCH(
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
    const parsed = rescheduleSchema.parse(body);

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

    const { data: existingPost } = await supabase
      .from("posts")
      .select("status, queue_job_id")
      .eq("id", id)
      .eq("org_id", orgMember.org_id)
      .single();

    if (!existingPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (
      existingPost.status === "published" ||
      existingPost.status === "failed"
    ) {
      return NextResponse.json(
        { error: "Cannot reschedule published or failed posts" },
        { status: 400 },
      );
    }

    const newScheduledAt = new Date(parsed.scheduled_at);

    // Cancel any existing delayed job, then re-enqueue with the new delay.
    if (existingPost.queue_job_id) {
      await cancelScheduledPost(existingPost.queue_job_id);
    }

    let queueJobId: string | null = null;
    try {
      queueJobId = await schedulePost({
        postId: id,
        orgId: orgMember.org_id,
        scheduledAt: newScheduledAt,
      });
    } catch (err) {
      if (err instanceof SchedulerValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      logger.error("reschedule: enqueue failed, falling back to DB", err);
    }

    const { data: post, error } = await supabase
      .from("posts")
      .update({
        scheduled_at: newScheduledAt,
        status: "scheduled",
        queue_job_id: queueJobId,
        updated_at: new Date(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

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
          error instanceof Error ? error.message : "Failed to reschedule post",
      },
      { status: 500 },
    );
  }
}
