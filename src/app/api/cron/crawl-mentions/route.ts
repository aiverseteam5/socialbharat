import { NextRequest, NextResponse } from "next/server";
import { crawlAllActiveQueries } from "@/lib/listening/crawler";
import { checkAlertThresholds } from "@/lib/listening/alerts";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/crawl-mentions
 * Vercel Cron handler — runs every 15 minutes for pro+ orgs.
 * Protected by CRON_SECRET.
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
    const crawlResult = await crawlAllActiveQueries();

    // After crawl, check alert thresholds across all active queries
    await checkAlertThresholds();

    logger.info(
      "crawl-mentions cron completed",
      crawlResult as unknown as Record<string, unknown>,
    );

    return NextResponse.json({
      success: true,
      queried: crawlResult.queried,
      mentionsSaved: crawlResult.mentionsSaved,
      errors: crawlResult.errors,
    });
  } catch (error) {
    logger.error("crawl-mentions cron failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron job failed" },
      { status: 500 },
    );
  }
}
