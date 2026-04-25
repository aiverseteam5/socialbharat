import { NextRequest, NextResponse } from "next/server";
import { agentQueue } from "@/lib/queue/queues";
import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

/**
 * POST /api/cron/agent-weekly
 *
 * V3 Phase 4A — weekly content-plan fan-out. Cron fires Monday 05:00 IST;
 * this route enqueues one agent job per opted-in org and returns immediately.
 * The agent worker then runs orchestrator.runWeeklyCycle per-org at
 * concurrency=2 so Anthropic spend stays bounded.
 *
 * Auth: Bearer CRON_SECRET, mirroring /api/cron/publish.
 */
async function run(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const { data: orgs, error } = await supabase
      .from("organizations")
      .select("id")
      .eq("opted_in_to_agent_automation", true);

    if (error) throw error;

    const bucket = Math.floor(Date.now() / 3_600_000);
    const queue = agentQueue();
    let enqueued = 0;
    for (const org of orgs ?? []) {
      await queue.add(
        "weekly_content",
        { kind: "weekly_content", orgId: org.id, triggeredBy: "cron" },
        { jobId: `agent-weekly-${org.id}-${bucket}` },
      );
      enqueued++;
    }

    return NextResponse.json({ success: true, enqueued });
  } catch (error) {
    logger.error("Cron agent-weekly enqueue failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron job failed" },
      { status: 500 },
    );
  }
}

export const POST = run;
export const GET = run;
