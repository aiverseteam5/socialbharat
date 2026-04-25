import { NextRequest, NextResponse } from "next/server";
import { tokenRefreshQueue } from "@/lib/queue/queues";
import { logger } from "@/lib/logger";

/**
 * POST /api/cron/token-refresh
 *
 * V3 Phase 3B — runs daily via VPS crontab. Enqueues a `refresh-all` job on
 * tokenRefreshQueue. The worker scans social_profiles whose tokens expire
 * within 48h and refreshes each one.
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
    const job = await tokenRefreshQueue().add(
      "refresh-all",
      { kind: "refresh-all" },
      {
        jobId: `cron-token-refresh-${Math.floor(Date.now() / 86_400_000)}`,
      },
    );
    return NextResponse.json({ success: true, jobId: job.id });
  } catch (error) {
    logger.error("Cron token-refresh enqueue failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron job failed" },
      { status: 500 },
    );
  }
}

export const POST = run;
export const GET = run;
