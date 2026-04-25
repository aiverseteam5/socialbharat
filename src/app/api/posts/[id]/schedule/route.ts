import { createClient } from "@/lib/supabase/server";
import { schedulePostSchema } from "@/types/schemas";
import {
  schedulePost,
  cancelScheduledPost,
  SchedulerValidationError,
} from "@/lib/queue/scheduler";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/posts/[id]/schedule
 *
 * V3 Phase 3B — enqueues the post onto BullMQ with a delay and persists the
 * returned job id on posts.queue_job_id so it can be cancelled/rescheduled.
 * If the queue enqueue fails we still persist scheduled_at so the cron sweep
 * (`/api/cron/publish`) can pick the post up as a safety net.
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

    const scheduledAt = new Date(parsed.scheduled_at);
    const now = new Date();

    if (scheduledAt <= now) {
      return NextResponse.json(
        { error: "Scheduled time must be in the future" },
        { status: 400 },
      );
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

    const orgId = orgMember.org_id;

    const { data: existingPost } = await supabase
      .from("posts")
      .select("id, status, queue_job_id")
      .eq("id", postId)
      .eq("org_id", orgId)
      .single();

    if (!existingPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (
      existingPost.status !== "draft" &&
      existingPost.status !== "pending_approval" &&
      existingPost.status !== "scheduled"
    ) {
      return NextResponse.json(
        {
          error: "Can only schedule draft, pending_approval or scheduled posts",
        },
        { status: 400 },
      );
    }

    // Rescheduling — drop previous delayed job first.
    if (existingPost.queue_job_id) {
      await cancelScheduledPost(existingPost.queue_job_id);
    }

    let queueJobId: string | null = null;
    try {
      queueJobId = await schedulePost({ postId, orgId, scheduledAt });
    } catch (err) {
      if (err instanceof SchedulerValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      // Queue unavailable — continue with DB-only state; cron sweep will
      // pick it up from scheduled_at.
      logger.error("schedule: enqueue failed, falling back to DB", err);
    }

    const { data: post, error } = await supabase
      .from("posts")
      .update({
        status: "scheduled",
        scheduled_at: scheduledAt,
        queue_job_id: queueJobId,
        updated_at: new Date(),
      })
      .eq("id", postId)
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
          error instanceof Error ? error.message : "Failed to schedule post",
      },
      { status: 500 },
    );
  }
}
