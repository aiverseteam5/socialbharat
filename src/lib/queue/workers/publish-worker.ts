/**
 * Publish worker — processes `publish` and `check-scheduled` jobs.
 *
 * `publish`:        publish a single post identified by postId.
 * `check-scheduled`: safety-net sweep — reuses existing scheduler logic to
 *                   pick up any posts whose scheduled_at elapsed without a
 *                   matching delayed job (e.g. after a Redis restart).
 *
 * The worker reuses the existing `processScheduledPosts()` helper rather
 * than reimplementing publishing so behavior stays consistent with the
 * pre-queue synchronous path.
 */
import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../connection";
import { QUEUE_NAMES, type PublishJobData } from "../queues";
import { processScheduledPosts } from "@/lib/scheduler";
import { createServiceClient } from "@/lib/supabase/service";
import { decrypt } from "@/lib/encryption";
import { getPlatformConnector, type SocialPlatform } from "@/lib/platforms";
import { logger } from "@/lib/logger";
import { notificationQueue } from "../queues";

const SUPPORTED_PLATFORMS: readonly SocialPlatform[] = [
  "facebook",
  "instagram",
  "twitter",
  "linkedin",
  "youtube",
  "whatsapp",
];

function isSupportedPlatform(p: string): p is SocialPlatform {
  return (SUPPORTED_PLATFORMS as readonly string[]).includes(p);
}

async function publishSinglePost(postId: string, orgId: string): Promise<void> {
  const supabase = createServiceClient();
  const now = new Date();

  const { data: post, error: fetchErr } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .eq("org_id", orgId)
    .single();

  if (fetchErr || !post) {
    logger.error("publish-worker: post not found", fetchErr ?? undefined, {
      postId,
      orgId,
    });
    return;
  }

  if (post.status === "published" || post.status === "failed") {
    logger.info("publish-worker: post already terminal, skipping", {
      postId,
      status: post.status,
    });
    return;
  }

  const { data: profiles } = await supabase
    .from("social_profiles")
    .select("*")
    .eq("org_id", orgId)
    .in("id", post.platforms ?? []);

  if (!profiles || profiles.length === 0) {
    await supabase
      .from("posts")
      .update({
        status: "failed",
        error_message: "No connected profiles found",
        updated_at: now,
      })
      .eq("id", postId);
    return;
  }

  const publishResults: Record<
    string,
    { platformPostId: string; url?: string; status: string; error?: string }
  > = {};
  let successCount = 0;

  for (const profile of profiles) {
    try {
      if (!isSupportedPlatform(profile.platform)) {
        publishResults[profile.id] = {
          platformPostId: "",
          status: "failed",
          error: `Unsupported platform: ${profile.platform}`,
        };
        continue;
      }
      const decrypted = decrypt(profile.access_token_encrypted);
      const connector = getPlatformConnector(profile.platform, {
        accessToken: decrypted,
        platformUserId: profile.platform_user_id,
        organizationUrn: profile.metadata?.organization_urn as
          | string
          | undefined,
        personUrn: profile.metadata?.person_urn as string | undefined,
        phoneNumberId: profile.metadata?.phone_number_id as string | undefined,
      });

      const content =
        post.content_json?.platform_overrides?.[profile.platform]?.text ||
        post.content;
      const mediaUrls =
        post.content_json?.platform_overrides?.[profile.platform]?.media_urls ||
        post.media_urls;

      const result = await connector.publishPost({ content, mediaUrls });
      publishResults[profile.id] = {
        platformPostId: result.platformPostId,
        url: result.url,
        status: result.status,
      };
      if (result.status === "published") successCount++;
    } catch (err) {
      publishResults[profile.id] = {
        platformPostId: "",
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const overallStatus: "published" | "failed" | "partially_failed" =
    successCount === 0
      ? "failed"
      : successCount < profiles.length
        ? "partially_failed"
        : "published";

  await supabase
    .from("posts")
    .update({
      status: overallStatus,
      published_at: now,
      publish_results: publishResults,
      error_message: overallStatus === "failed" ? "All platforms failed" : null,
      updated_at: now,
    })
    .eq("id", postId);

  // Enqueue a notification regardless of outcome. The notification worker
  // resolves the recipient (org owner / post author).
  await notificationQueue().add("post-result", {
    type: overallStatus === "failed" ? "post_failed" : "post_published",
    orgId,
    title:
      overallStatus === "failed"
        ? "Post failed to publish"
        : overallStatus === "partially_failed"
          ? "Post partially published"
          : "Post published successfully",
    body: `Published to ${successCount} of ${profiles.length} platform(s).`,
    link: "/publishing",
    data: { postId, overallStatus },
  });
}

export async function handlePublishJob(
  job: Job<PublishJobData>,
): Promise<void> {
  const kind = job.data.kind ?? "publish";
  if (kind === "check-scheduled") {
    const result = await processScheduledPosts();
    logger.info("publish-worker: sweep complete", result);
    return;
  }

  const { postId, orgId } = job.data;
  if (!postId || !orgId) {
    throw new Error("publish job missing postId/orgId");
  }
  await publishSinglePost(postId, orgId);
}

export function createPublishWorker(): Worker<PublishJobData> {
  const worker = new Worker<PublishJobData>(
    QUEUE_NAMES.publish,
    handlePublishJob,
    {
      connection: getRedisConnection(),
      concurrency: 5,
    },
  );

  worker.on("failed", (job, err) => {
    logger.error("publish-worker: job failed", err, {
      jobId: job?.id,
      attempts: job?.attemptsMade,
    });
  });

  return worker;
}
