import { NextRequest, NextResponse } from "next/server";
import { metricsQueue } from "@/lib/queue/queues";
import { logger } from "@/lib/logger";

/**
 * POST /api/cron/collect-metrics
 *
 * V3 Phase 3B — enqueues a `collect-all` job on metricsQueue.
 * The metrics worker runs the daily sweep via collectMetricsForAllOrgs().
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
    const job = await metricsQueue().add(
      "collect-all",
      { kind: "collect-all" },
      {
        jobId: `cron-metrics-${Math.floor(Date.now() / 3_600_000)}`,
      },
    );
    return NextResponse.json({ success: true, jobId: job.id });
  } catch (error) {
    logger.error("Cron collect-metrics enqueue failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron job failed" },
      { status: 500 },
    );
  }
}

export const POST = run;
export const GET = run;
