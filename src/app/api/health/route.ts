import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
// No caching — always reflects live status
export const dynamic = "force-dynamic";

async function checkDatabase(): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("plan_limits")
      .select("plan")
      .limit(1);
    return !error;
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    const res = await fetch(`${env.UPSTASH_REDIS_REST_URL}/ping`, {
      headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { result?: string };
    return body.result === "PONG";
  } catch {
    return false;
  }
}

export async function GET() {
  const [db, redis] = await Promise.all([checkDatabase(), checkRedis()]);

  const status = db && redis ? "ok" : "degraded";

  if (status === "degraded") {
    logger.warn("Health check degraded", { db, redis });
  }

  return NextResponse.json(
    { status, db, redis, timestamp: new Date().toISOString() },
    { status: status === "ok" ? 200 : 503 },
  );
}
