import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { schedulePost } from "@/lib/queue/scheduler";
import { logger } from "@/lib/logger";
import type { WeeklyPlan } from "@/lib/agents/types";

const bodySchema = z.object({
  /**
   * When true, the approved plan's posts are converted to rows in `posts`
   * and scheduled via BullMQ. When false, status just flips to 'approved'
   * and the user can publish later from the publishing UI.
   */
  schedule: z.boolean().default(true),
});

/**
 * PUT /api/agent/plans/[id]/approve
 *
 * Only owner/admin/editor (enforced by RLS on UPDATE) can approve. Once
 * approved, posts are created in status='scheduled' and BullMQ delayed jobs
 * are queued. Returns the created post IDs for the UI to navigate to.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: planRow, error: fetchErr } = await supabase
    .from("agent_plans")
    .select("id, org_id, status, plan")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!planRow) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }
  if (planRow.status === "published" || planRow.status === "discarded") {
    return NextResponse.json(
      { error: `Plan is ${planRow.status}; cannot approve` },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const plan = planRow.plan as WeeklyPlan;

  // Resolve platform names → social_profile IDs (required for posts.platforms).
  const { data: profiles } = await supabase
    .from("social_profiles")
    .select("id, platform")
    .eq("org_id", planRow.org_id)
    .eq("is_active", true);

  const profileIdsByPlatform = new Map<string, string[]>();
  for (const p of profiles ?? []) {
    const list = profileIdsByPlatform.get(p.platform) ?? [];
    list.push(p.id);
    profileIdsByPlatform.set(p.platform, list);
  }

  const createdPostIds: string[] = [];

  if (parsed.data.schedule) {
    for (const draft of plan.posts) {
      const platformIds = draft.platforms.flatMap(
        (name) => profileIdsByPlatform.get(name) ?? [],
      );
      if (platformIds.length === 0) continue;

      const scheduledAt = new Date(draft.suggestedAt);
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
        // Skip drafts whose suggestedAt is invalid or in the past.
        continue;
      }

      const hashtagsSuffix = draft.hashtags?.length
        ? "\n\n" + draft.hashtags.join(" ")
        : "";

      const { data: inserted, error: insertErr } = await supabase
        .from("posts")
        .insert({
          org_id: planRow.org_id,
          created_by: user.id,
          content: draft.caption + hashtagsSuffix,
          platforms: platformIds,
          status: "scheduled",
          scheduled_at: scheduledAt.toISOString(),
          ai_generated: true,
          festival_context: draft.festivalId ?? null,
        })
        .select("id")
        .single();

      if (insertErr || !inserted) {
        logger.error(
          "plan-approve: post insert failed",
          insertErr ?? undefined,
        );
        continue;
      }

      try {
        const jobId = await schedulePost({
          postId: inserted.id,
          orgId: planRow.org_id,
          scheduledAt,
        });
        await supabase
          .from("posts")
          .update({ queue_job_id: jobId, status: "queued" })
          .eq("id", inserted.id);
      } catch (err) {
        logger.warn("plan-approve: schedulePost failed", {
          postId: inserted.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      createdPostIds.push(inserted.id);
    }
  }

  const { error: updErr } = await supabase
    .from("agent_plans")
    .update({
      status: parsed.data.schedule ? "approved" : "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      published_post_ids: createdPostIds,
    })
    .eq("id", id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    createdPostIds,
    scheduled: parsed.data.schedule,
  });
}
