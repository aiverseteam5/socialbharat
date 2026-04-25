/**
 * BullMQ-backed scheduler.
 *
 * Scheduling path:
 *   - User schedules a post → `schedulePost()` adds a *delayed* job to
 *     publishQueue, returns the job id (stored in posts.queue_job_id).
 *   - The delay is computed in UTC milliseconds — IST conversion happens at
 *     the composer UI layer; callers pass an absolute JS Date.
 *   - `/api/cron/publish` (invoked every minute by VPS crontab) enqueues a
 *     lightweight "check-scheduled" job as a safety net that sweeps any
 *     posts whose scheduled_at has elapsed without a matching publish.
 *
 * Cancellation:
 *   - `cancelScheduledPost(jobId)` removes the delayed job. If the job is
 *     already active/completed we silently no-op.
 */
import { publishQueue, tokenRefreshQueue } from "./queues";
import { logger } from "../logger";

export class SchedulerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchedulerValidationError";
  }
}

/**
 * Schedule a post for future publishing.
 * Returns the BullMQ job id so callers can persist it to posts.queue_job_id.
 */
export async function schedulePost(params: {
  postId: string;
  orgId: string;
  scheduledAt: Date;
}): Promise<string> {
  const { postId, orgId, scheduledAt } = params;

  if (!(scheduledAt instanceof Date) || Number.isNaN(scheduledAt.getTime())) {
    throw new SchedulerValidationError("scheduledAt must be a valid Date");
  }

  const delay = scheduledAt.getTime() - Date.now();
  if (delay <= 0) {
    throw new SchedulerValidationError("scheduledAt must be in the future");
  }

  const job = await publishQueue().add(
    "publish",
    { postId, orgId, kind: "publish" },
    {
      delay,
      // BullMQ disallows ":" in custom ids, so hyphen-separate the prefix.
      jobId: `post-${postId}`,
    },
  );

  if (!job.id) {
    throw new Error("BullMQ did not return a job id");
  }

  logger.info("Post scheduled", {
    postId,
    orgId,
    scheduledAt: scheduledAt.toISOString(),
    delayMs: delay,
    jobId: job.id,
  });

  return job.id;
}

/**
 * Remove a scheduled publish job. Safe no-op if the job no longer exists.
 */
export async function cancelScheduledPost(jobId: string): Promise<void> {
  try {
    const job = await publishQueue().getJob(jobId);
    if (!job) return;
    await job.remove();
    logger.info("Scheduled post cancelled", { jobId });
  } catch (error) {
    logger.warn("Failed to cancel scheduled post", {
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Schedule a proactive token refresh for a profile.
 * Fires 24h before `expiresAt` so we have time to retry.
 */
export async function scheduleTokenRefresh(params: {
  profileId: string;
  orgId: string;
  expiresAt: Date;
}): Promise<string | null> {
  const { profileId, orgId, expiresAt } = params;
  const REFRESH_BUFFER_MS = 24 * 60 * 60 * 1000; // 24h
  const delay = expiresAt.getTime() - Date.now() - REFRESH_BUFFER_MS;

  if (delay <= 0) {
    // Expiring inside the buffer window → refresh immediately.
    const job = await tokenRefreshQueue().add(
      "refresh-one",
      { profileId, orgId, kind: "refresh-one" },
      { jobId: `token-${profileId}` },
    );
    return job.id ?? null;
  }

  const job = await tokenRefreshQueue().add(
    "refresh-one",
    { profileId, orgId, kind: "refresh-one" },
    { delay, jobId: `token-${profileId}` },
  );
  return job.id ?? null;
}

/**
 * Triggers a safety-net scan of scheduled posts whose time has elapsed.
 * Invoked by `/api/cron/publish` every minute.
 */
export async function triggerScheduledPostSweep(): Promise<string | null> {
  const job = await publishQueue().add(
    "check-scheduled",
    { postId: "", orgId: "", kind: "check-scheduled" },
    {
      jobId: `sweep-${Math.floor(Date.now() / 60_000)}`,
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 50 },
    },
  );
  return job.id ?? null;
}
