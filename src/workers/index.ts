/**
 * BullMQ worker process entrypoint.
 *
 * Run locally:    pnpm workers:dev
 * Run in PM2:     see `socialbharat-workers` block in ecosystem.config.js
 *
 * This file boots the 4 V3 Phase 3B workers, logs startup, and registers a
 * graceful shutdown on SIGTERM/SIGINT so PM2 reloads drain in-flight jobs.
 */
import "@/lib/env"; // validates env on startup
import { logger } from "@/lib/logger";
import { createPublishWorker } from "@/lib/queue/workers/publish-worker";
import { createMetricsWorker } from "@/lib/queue/workers/metrics-worker";
import { createTokenRefreshWorker } from "@/lib/queue/workers/token-refresh-worker";
import { createNotificationWorker } from "@/lib/queue/workers/notification-worker";
import { createAgentWorker } from "@/lib/queue/workers/agent-worker";

async function main() {
  logger.info("Starting SocialBharat workers", {
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    nodeEnv: process.env.NODE_ENV,
  });

  const workers = [
    createPublishWorker(),
    createMetricsWorker(),
    createTokenRefreshWorker(),
    createNotificationWorker(),
    createAgentWorker(),
  ];

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, draining workers...`);
    await Promise.all(workers.map((w) => w.close()));
    logger.info("Workers drained, exiting");
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  logger.info("Workers started", { count: workers.length });
}

void main().catch((err) => {
  logger.error("Worker startup failed", err);
  process.exit(1);
});
