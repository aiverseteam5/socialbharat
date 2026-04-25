/**
 * Notification worker — fans out queued notifications to org members.
 *
 * The queue job carries an orgId (and optional userId). If userId is present
 * we send to that user; otherwise we broadcast to all org owners/admins.
 * Delegates to the existing `sendNotification()` helper for email + insert.
 */
import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../connection";
import { QUEUE_NAMES, type NotificationJobData } from "../queues";
import {
  sendNotification,
  type NotificationType,
} from "@/lib/notifications/send";
import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

const KNOWN_TYPES: readonly NotificationType[] = [
  "post_published",
  "post_failed",
  "post_approval_requested",
  "post_approved",
  "post_rejected",
  "inbox_message",
  "team_member_invited",
  "team_member_joined",
  "payment_received",
];
function toNotificationType(t: string): NotificationType {
  return (KNOWN_TYPES as readonly string[]).includes(t)
    ? (t as NotificationType)
    : "post_failed";
}

async function recipientsForOrg(orgId: string): Promise<string[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("org_members")
    .select("user_id")
    .eq("org_id", orgId)
    .in("role", ["owner", "admin"]);

  if (error || !data) return [];
  return data.map((r) => r.user_id as string);
}

export async function handleNotificationJob(
  job: Job<NotificationJobData>,
): Promise<void> {
  const { type, orgId, userId, title, body, link, data } = job.data;
  const nType = toNotificationType(type);

  const recipients = userId ? [userId] : await recipientsForOrg(orgId);

  if (recipients.length === 0) {
    logger.warn("notification-worker: no recipients", { orgId, type });
    return;
  }

  for (const uid of recipients) {
    await sendNotification({
      userId: uid,
      orgId,
      type: nType,
      title,
      body,
      link,
      metadata: data,
    });
  }
}

export function createNotificationWorker(): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(
    QUEUE_NAMES.notification,
    handleNotificationJob,
    {
      connection: getRedisConnection(),
      concurrency: 5,
    },
  );

  worker.on("failed", (job, err) => {
    logger.error("notification-worker: job failed", err, { jobId: job?.id });
  });

  return worker;
}
