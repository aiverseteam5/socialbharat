/**
 * Token-refresh worker — proactively refreshes OAuth tokens before expiry.
 *
 * `refresh-all`: scans active social_profiles where token_expires_at is within
 *                48h and enqueues a per-profile refresh or runs inline.
 * `refresh-one`: refreshes a single profile id.
 *
 * If the platform connector does not support refresh (e.g. WhatsApp manual
 * token), we mark the profile inactive so the UI prompts reconnection.
 */
import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../connection";
import { QUEUE_NAMES, type TokenRefreshJobData } from "../queues";
import { createServiceClient } from "@/lib/supabase/service";
import { decrypt, encrypt } from "@/lib/encryption";
import { getPlatformConnector, type SocialPlatform } from "@/lib/platforms";
import { logger } from "@/lib/logger";

const SUPPORTED: readonly SocialPlatform[] = [
  "facebook",
  "instagram",
  "twitter",
  "linkedin",
  "youtube",
  "whatsapp",
];
function isSupported(p: string): p is SocialPlatform {
  return (SUPPORTED as readonly string[]).includes(p);
}

const REFRESH_WINDOW_MS = 48 * 60 * 60 * 1000;

async function refreshProfile(profileId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: profile, error } = await supabase
    .from("social_profiles")
    .select("*")
    .eq("id", profileId)
    .single();

  if (error || !profile) {
    logger.warn("token-refresh-worker: profile not found", { profileId });
    return;
  }
  if (!profile.access_token_encrypted) return;
  if (!isSupported(profile.platform)) return;

  try {
    const decrypted = decrypt(profile.access_token_encrypted);
    const connector = getPlatformConnector(profile.platform, {
      accessToken: decrypted,
      platformUserId: profile.platform_user_id,
    });
    const newToken = await connector.refreshToken();
    if (!newToken || newToken === decrypted) {
      // Connector signaled no-op (e.g. WhatsApp manual token) — nothing to do.
      return;
    }
    await supabase
      .from("social_profiles")
      .update({
        access_token_encrypted: encrypt(newToken),
        updated_at: new Date(),
      })
      .eq("id", profileId);
    logger.info("token-refresh-worker: refreshed", {
      profileId,
      platform: profile.platform,
    });
  } catch (err) {
    logger.error("token-refresh-worker: refresh failed", err, {
      profileId,
      platform: profile.platform,
    });
    // Mark inactive so the UI surfaces a reconnect prompt.
    await supabase
      .from("social_profiles")
      .update({ is_active: false, updated_at: new Date() })
      .eq("id", profileId);
  }
}

async function refreshAll(): Promise<{ scanned: number; queued: number }> {
  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() + REFRESH_WINDOW_MS).toISOString();

  const { data: profiles, error } = await supabase
    .from("social_profiles")
    .select("id, token_expires_at")
    .eq("is_active", true)
    .not("token_expires_at", "is", null)
    .lte("token_expires_at", cutoff);

  if (error) {
    logger.error("token-refresh-worker: scan failed", error);
    return { scanned: 0, queued: 0 };
  }

  const list = profiles ?? [];
  for (const p of list) {
    await refreshProfile(p.id);
  }

  return { scanned: list.length, queued: list.length };
}

export async function handleTokenRefreshJob(
  job: Job<TokenRefreshJobData>,
): Promise<void> {
  const kind = job.data.kind ?? "refresh-all";
  if (kind === "refresh-all") {
    const result = await refreshAll();
    logger.info("token-refresh-worker: sweep complete", result);
    return;
  }
  if (!job.data.profileId) throw new Error("refresh-one requires profileId");
  await refreshProfile(job.data.profileId);
}

export function createTokenRefreshWorker(): Worker<TokenRefreshJobData> {
  const worker = new Worker<TokenRefreshJobData>(
    QUEUE_NAMES.tokenRefresh,
    handleTokenRefreshJob,
    {
      connection: getRedisConnection(),
      concurrency: 2,
    },
  );

  worker.on("failed", (job, err) => {
    logger.error("token-refresh-worker: job failed", err, { jobId: job?.id });
  });

  return worker;
}
