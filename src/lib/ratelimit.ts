import { logger } from "./logger";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  reset: number;
  limit: number;
}

/**
 * Fixed-window rate limiter keyed on an identifier + hour bucket.
 * Uses Upstash Redis REST API directly. Fails open (and logs) when Upstash
 * isn't configured so local dev keeps working; production environments must
 * set UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.
 *
 * @param key - unique identifier (e.g. `ai:${userId}`)
 * @param limit - max requests per hour
 */
export async function hourlyRateLimit(
  key: string,
  limit: number,
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / 3600);
  const reset = (bucket + 1) * 3600;

  if (!url || !token) {
    logger.warn("Upstash not configured; rate limit skipped", { key });
    return { ok: true, remaining: -1, reset, limit };
  }

  const redisKey = `ratelimit:${key}:${bucket}`;

  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, "3600", "NX"],
      ]),
    });
    if (!res.ok) {
      logger.error("Upstash rate limit request failed", undefined, {
        status: res.status,
      });
      return { ok: true, remaining: -1, reset, limit };
    }
    const data = (await res.json()) as Array<{
      result?: number;
      error?: string;
    }>;
    const count = typeof data[0]?.result === "number" ? data[0]!.result! : 0;
    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      reset,
      limit,
    };
  } catch (err) {
    logger.error("Upstash rate limit threw", err, { key });
    return { ok: true, remaining: -1, reset, limit };
  }
}

/**
 * Convenience wrapper: AI endpoints share a common 20/hour per-user budget.
 */
export async function checkAiRateLimit(
  userId: string,
  limit = 20,
): Promise<RateLimitResult> {
  return hourlyRateLimit(`ai:${userId}`, limit);
}

/**
 * Fixed-window rate limiter with a configurable window in seconds.
 * Used for short-window limits (e.g. OTP: 5 per 10 minutes).
 */
export async function windowRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds);
  const reset = (bucket + 1) * windowSeconds;

  if (!url || !token) {
    logger.warn("Upstash not configured; rate limit skipped", { key });
    return { ok: true, remaining: -1, reset, limit };
  }

  const redisKey = `ratelimit:${key}:${bucket}`;

  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, String(windowSeconds), "NX"],
      ]),
    });
    if (!res.ok) {
      logger.error("Upstash rate limit request failed", undefined, {
        status: res.status,
      });
      return { ok: true, remaining: -1, reset, limit };
    }
    const data = (await res.json()) as Array<{
      result?: number;
      error?: string;
    }>;
    const count = typeof data[0]?.result === "number" ? data[0]!.result! : 0;
    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      reset,
      limit,
    };
  } catch (err) {
    logger.error("Upstash rate limit threw", err, { key });
    return { ok: true, remaining: -1, reset, limit };
  }
}

/** OTP send: 5 per phone per 10 minutes */
export async function checkOtpSendRateLimit(
  phone: string,
): Promise<RateLimitResult> {
  return windowRateLimit(`otp:send:${phone}`, 5, 600);
}

/** OTP verify: 10 per phone per 10 minutes */
export async function checkOtpVerifyRateLimit(
  phone: string,
): Promise<RateLimitResult> {
  return windowRateLimit(`otp:verify:${phone}`, 10, 600);
}

/** Connector OAuth initiation: 10 per user per hour */
export async function checkConnectorAuthRateLimit(
  userId: string,
  provider: string,
): Promise<RateLimitResult> {
  return hourlyRateLimit(`connector:${provider}:${userId}`, 10);
}
