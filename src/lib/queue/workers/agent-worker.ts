/**
 * Agent worker — processes `weekly_content` and `inbox_replies` jobs.
 *
 * Cron routes enqueue one job per opted-in org; this worker serializes them
 * (concurrency: 2) to keep Anthropic spend bounded. If a run fails the job
 * retries once per BullMQ's default retry policy for this queue.
 */
import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../connection";
import { QUEUE_NAMES, type AgentJobData } from "../queues";
import { runWeeklyCycle, runInboxCycle } from "@/lib/agents/orchestrator";
import { logger } from "@/lib/logger";

export async function handleAgentJob(job: Job<AgentJobData>): Promise<void> {
  const { kind, orgId, triggeredBy } = job.data;
  if (!orgId) throw new Error("agent job missing orgId");

  logger.info("agent-worker: job received", {
    jobId: job.id,
    kind,
    orgId,
    triggeredBy,
  });

  if (kind === "weekly_content") {
    const result = await runWeeklyCycle(orgId);
    logger.info("agent-worker: weekly_content complete", { ...result });
    return;
  }
  if (kind === "inbox_replies") {
    const result = await runInboxCycle(orgId);
    logger.info("agent-worker: inbox_replies complete", { ...result });
    return;
  }
  throw new Error(`agent-worker: unknown kind ${String(kind)}`);
}

export function createAgentWorker(): Worker<AgentJobData> {
  const worker = new Worker<AgentJobData>(QUEUE_NAMES.agent, handleAgentJob, {
    connection: getRedisConnection(),
    // Cap parallel Anthropic calls. Raise if billing allows.
    concurrency: 2,
  });

  worker.on("failed", (job, err) => {
    logger.error("agent-worker: job failed", err, {
      jobId: job?.id,
      attempts: job?.attemptsMade,
      kind: job?.data?.kind,
      orgId: job?.data?.orgId,
    });
  });

  return worker;
}
