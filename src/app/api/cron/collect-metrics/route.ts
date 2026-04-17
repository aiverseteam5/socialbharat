import { NextRequest, NextResponse } from "next/server";
import { collectMetricsForAllOrgs } from "@/lib/metrics-collector";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/collect-metrics
 * Vercel Cron handler — collects yesterday's metrics for every active
 * social profile across all orgs. Protected by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
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
    const now = new Date();
    const result = await collectMetricsForAllOrgs(now);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logger.error("collect-metrics cron failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Cron job failed",
      },
      { status: 500 },
    );
  }
}
