import { NextRequest, NextResponse } from "next/server";
import { processScheduledPosts } from "@/lib/scheduler";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/publish
 * Vercel Cron job handler for publishing scheduled posts
 * Protected by CRON_SECRET environment variable
 */
export async function GET(request: NextRequest) {
  // Verify CRON_SECRET for security
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
    const result = await processScheduledPosts();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error("Cron publish job failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron job failed" },
      { status: 500 },
    );
  }
}
