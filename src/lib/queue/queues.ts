/**
 * BullMQ queue definitions.
 *
 * V3 Phase 3B scope: publish / metrics / token-refresh / notification.
 * V3 Phase 4A adds `agent` for agentic AI fan-out — cron routes enqueue one
 * job per opted-in org so the cron handler stays fast.
 */
import { Queue, QueueEvents, type JobsOptions } from "bullmq";
import { getRedisConnection } from "./connection";

export const QUEUE_NAMES = {
  publish: "publish",
  metrics: "metrics",
  tokenRefresh: "token-refresh",
  notification: "notification",
  agent: "agent",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ── Job payload types ───────────────────────────────────────────────────────

export interface PublishJobData {
  /** Post id in `posts` table. */
  postId: string;
  orgId: string;
  /** Sentinel job kind used by the cron scanner. */
  kind?: "publish" | "check-scheduled";
}

export interface MetricsJobData {
  profileId?: string;
  orgId?: string;
  postId?: string;
  kind?: "collect-post" | "collect-profile" | "collect-all";
}

export interface TokenRefreshJobData {
  profileId?: string;
  orgId?: string;
  kind?: "refresh-one" | "refresh-all";
}

export interface NotificationJobData {
  type: string;
  orgId: string;
  userId?: string;
  title: string;
  body: string;
  link?: string;
  data?: Record<string, unknown>;
}

export interface AgentJobData {
  /**
   * Which agent pipeline to run for this org.
   * - weekly_content: research → content, writes to agent_plans
   * - inbox_replies:  batch classify + draft, writes to agent_inbox_actions
   */
  kind: "weekly_content" | "inbox_replies";
  orgId: string;
  /** Optional — when set, propagated into logs so cron runs are traceable. */
  triggeredBy?: "cron" | "manual";
}

// ── Shared defaults ─────────────────────────────────────────────────────────

const defaultJobOptions: JobsOptions = {
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
  attempts: 3,
  backoff: { type: "exponential", delay: 5_000 },
};

// ── Singletons ──────────────────────────────────────────────────────────────
// Lazily constructed so importing this module doesn't open a connection
// during Next.js `next build` route-data collection.

let _publish: Queue<PublishJobData> | null = null;
let _metrics: Queue<MetricsJobData> | null = null;
let _tokenRefresh: Queue<TokenRefreshJobData> | null = null;
let _notification: Queue<NotificationJobData> | null = null;
let _agent: Queue<AgentJobData> | null = null;

export function publishQueue(): Queue<PublishJobData> {
  if (!_publish) {
    _publish = new Queue<PublishJobData>(QUEUE_NAMES.publish, {
      connection: getRedisConnection(),
      defaultJobOptions,
    });
  }
  return _publish;
}

export function metricsQueue(): Queue<MetricsJobData> {
  if (!_metrics) {
    _metrics = new Queue<MetricsJobData>(QUEUE_NAMES.metrics, {
      connection: getRedisConnection(),
      defaultJobOptions,
    });
  }
  return _metrics;
}

export function tokenRefreshQueue(): Queue<TokenRefreshJobData> {
  if (!_tokenRefresh) {
    _tokenRefresh = new Queue<TokenRefreshJobData>(QUEUE_NAMES.tokenRefresh, {
      connection: getRedisConnection(),
      defaultJobOptions,
    });
  }
  return _tokenRefresh;
}

export function notificationQueue(): Queue<NotificationJobData> {
  if (!_notification) {
    _notification = new Queue<NotificationJobData>(QUEUE_NAMES.notification, {
      connection: getRedisConnection(),
      defaultJobOptions,
    });
  }
  return _notification;
}

export function agentQueue(): Queue<AgentJobData> {
  if (!_agent) {
    _agent = new Queue<AgentJobData>(QUEUE_NAMES.agent, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        ...defaultJobOptions,
        // Agent jobs are costlier and less retryable than publish — a single
        // retry is enough to cover transient Anthropic timeouts.
        attempts: 2,
      },
    });
  }
  return _agent;
}

export function allQueues(): Queue[] {
  return [
    publishQueue(),
    metricsQueue(),
    tokenRefreshQueue(),
    notificationQueue(),
    agentQueue(),
  ];
}

export async function closeQueues(): Promise<void> {
  const queues = [_publish, _metrics, _tokenRefresh, _notification, _agent];
  for (const q of queues) {
    if (q) await q.close();
  }
  _publish = _metrics = _tokenRefresh = _notification = _agent = null;
}

/**
 * Test hook — resets cached singletons so next call reconstructs with the
 * current (mock) connection from `setRedisConnection`.
 */
export function _resetQueueSingletonsForTests(): void {
  _publish = _metrics = _tokenRefresh = _notification = _agent = null;
}

// Re-export BullMQ event types for worker files.
export { QueueEvents };
