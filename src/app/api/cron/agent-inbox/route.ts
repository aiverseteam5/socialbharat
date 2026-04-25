import { NextRequest, NextResponse } from "next/server";
import { agentQueue } from "@/lib/queue/queues";
import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

/**
 * POST /api/cron/agent-inbox
 *
 * V3 Phase 4A — daily inbox classification fan-out. Cron fires 09:00 IST.
 * Enqueues one agent job per opted-in org; the worker runs
 * orchestrator.runInboxCycle which batch-classifies up to 10 conversations.
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
        "inbox_replies",
        { kind: "inbox_replies", orgId: org.id, triggeredBy: "cron" },
        { jobId: `agent-inbox-${org.id}-${bucket}` },
      );
      enqueued++;
    }

    return NextResponse.json({ success: true, enqueued });
  } catch (error) {
    logger.error("Cron agent-inbox enqueue failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron job failed" },
      { status: 500 },
    );
  }
}

export const POST = run;
export const GET = run;
