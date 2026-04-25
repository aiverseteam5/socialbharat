/**
 * Metrics worker — collects analytics from platform APIs.
 *
 * Delegates to existing `collectMetricsForAllOrgs()` for the daily sweep so
 * we don't fork analytics logic between cron and queue paths.
 */
import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../connection";
import { QUEUE_NAMES, type MetricsJobData } from "../queues";
import { collectMetricsForAllOrgs } from "@/lib/metrics-collector";
import { logger } from "@/lib/logger";

export async function handleMetricsJob(
  job: Job<MetricsJobData>,
): Promise<void> {
  const kind = job.data.kind ?? "collect-all";

  if (kind === "collect-all") {
    const result = await collectMetricsForAllOrgs(new Date());
    logger.info("metrics-worker: sweep complete", { ...result });
    return;
  }

  // Per-profile / per-post collection is deferred to Phase 5 (analytics).
  logger.info("metrics-worker: per-profile/per-post collection deferred", {
    kind,
  });
}

export function createMetricsWorker(): Worker<MetricsJobData> {
  const worker = new Worker<MetricsJobData>(
    QUEUE_NAMES.metrics,
    handleMetricsJob,
    {
      connection: getRedisConnection(),
      concurrency: 2,
    },
  );

  worker.on("failed", (job, err) => {
    logger.error("metrics-worker: job failed", err, { jobId: job?.id });
  });

  return worker;
}
