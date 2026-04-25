import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { WeeklyPlan } from "@/lib/agents/types";

const bodySchema = z.object({
  caption: z.string().min(1).max(5000).optional(),
  hashtags: z.array(z.string()).max(30).optional(),
  suggestedAt: z.string().optional(),
  platforms: z
    .array(
      z.enum([
        "facebook",
        "instagram",
        "twitter",
        "linkedin",
        "youtube",
        "whatsapp",
      ]),
    )
    .optional(),
});

/**
 * PUT /api/agent/plans/[id]/posts/[postId]
 *
 * Edit a single draft post inside a plan's `plan.posts[]`. `postId` here is
 * the zero-based index in plan.posts (stringified). The draft lives in JSONB
 * so we fetch, mutate, and write back in one round-trip.
 *
 * Only pending_review / approved plans can be edited; published/discarded
 * plans are frozen.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; postId: string }> },
) {
  const { id, postId } = await context.params;
  const index = Number.parseInt(postId, 10);
  if (!Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "Invalid postId" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { data: row, error: fetchErr } = await supabase
    .from("agent_plans")
    .select("id, status, plan")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }
  if (row.status === "published" || row.status === "discarded") {
    return NextResponse.json(
      { error: `Plan is ${row.status}; cannot edit` },
      { status: 409 },
    );
  }

  const plan = row.plan as WeeklyPlan;
  if (!plan?.posts || !plan.posts[index]) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  const draft = plan.posts[index];
  plan.posts[index] = {
    ...draft,
    caption: parsed.data.caption ?? draft.caption,
    hashtags: parsed.data.hashtags ?? draft.hashtags,
    suggestedAt: parsed.data.suggestedAt ?? draft.suggestedAt,
    platforms: parsed.data.platforms ?? draft.platforms,
  };

  const { error: updErr } = await supabase
    .from("agent_plans")
    .update({ plan, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, draft: plan.posts[index] });
}
