import { NextRequest, NextResponse } from "next/server";
import { triggerScheduledPostSweep } from "@/lib/queue/scheduler";
import { logger } from "@/lib/logger";

/**
 * POST /api/cron/publish
 *
 * V3 Phase 3B — VPS crontab runs this every minute. Instead of running
 * `processScheduledPosts()` synchronously inside the request (as in V2),
 * we enqueue a BullMQ sweep job and return 200 immediately. The publish
 * worker picks up the sweep + any per-post delayed jobs.
 *
 * Protected by CRON_SECRET (Bearer). GET is kept as an alias for tooling
 * that can't POST (curl on old boxes, GitHub Actions step).
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
    const jobId = await triggerScheduledPostSweep();
    return NextResponse.json({ success: true, jobId });
  } catch (error) {
    logger.error("Cron publish enqueue failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron job failed" },
      { status: 500 },
    );
  }
}

export const POST = run;
export const GET = run;
