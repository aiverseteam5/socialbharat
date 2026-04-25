import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { agentQueue } from "@/lib/queue/queues";
import { logger } from "@/lib/logger";

const bodySchema = z.object({
  kind: z.enum(["weekly_content", "inbox_replies"]),
});

/**
 * POST /api/agent/run
 *
 * Enqueues one agent job for the caller's org. Used by /ai-agent "Run now"
 * buttons. Plan gate: free plans cannot use agent features.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!member) {
    return NextResponse.json(
      { error: "No organization found" },
      { status: 403 },
    );
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("plan")
    .eq("id", member.org_id)
    .single();
  if (!org || org.plan === "free") {
    return NextResponse.json(
      { error: "Upgrade to access AI agent features" },
      { status: 403 },
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

  try {
    const job = await agentQueue().add(
      parsed.data.kind,
      {
        kind: parsed.data.kind,
        orgId: member.org_id,
        triggeredBy: "manual",
      },
      {
        jobId: `agent-${parsed.data.kind}-${member.org_id}-${Date.now()}`,
      },
    );
    return NextResponse.json({ success: true, jobId: job.id });
  } catch (error) {
    logger.error("agent-run enqueue failed", error, { orgId: member.org_id });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to enqueue" },
      { status: 500 },
    );
  }
}
