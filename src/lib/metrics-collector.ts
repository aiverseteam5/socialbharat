import { createServiceClient } from "./supabase/service";
import { decrypt } from "./encryption";
import { getPlatformConnector, type SocialPlatform } from "./platforms";
import { logger } from "./logger";

export interface CollectMetricsResult {
  processed: number;
  succeeded: number;
  failed: number;
}

interface ProfileRow {
  id: string;
  org_id: string;
  platform: string;
  platform_user_id: string | null;
  access_token_encrypted: string | null;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
}

const SUPPORTED_PLATFORMS: readonly SocialPlatform[] = [
  "facebook",
  "instagram",
  "twitter",
  "linkedin",
  "youtube",
  "whatsapp",
];

function isSupportedPlatform(platform: string): platform is SocialPlatform {
  return (SUPPORTED_PLATFORMS as readonly string[]).includes(platform);
}

function computeEngagementRate(engagements: number, followers: number): number {
  if (!followers || followers <= 0) return 0;
  return Number(((engagements / followers) * 100).toFixed(4));
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function collectForProfile(
  supabase: ReturnType<typeof createServiceClient>,
  profile: ProfileRow,
  date: Date,
): Promise<boolean> {
  if (!profile.access_token_encrypted) {
    logger.warn("Skipping profile without encrypted token", {
      profileId: profile.id,
    });
    return false;
  }

  if (!isSupportedPlatform(profile.platform)) {
    logger.warn("Skipping unsupported platform for metrics", {
      profileId: profile.id,
      platform: profile.platform,
    });
    return false;
  }

  try {
    const accessToken = decrypt(profile.access_token_encrypted);
    const metadata = profile.metadata ?? {};
    const connector = getPlatformConnector(profile.platform, {
      accessToken,
      platformUserId: profile.platform_user_id ?? undefined,
      organizationUrn: metadata.organization_urn as string | undefined,
      personUrn: metadata.person_urn as string | undefined,
      phoneNumberId: metadata.phone_number_id as string | undefined,
    });

    const endDate = new Date(date);
    const startDate = new Date(date);
    startDate.setUTCDate(startDate.getUTCDate() - 1);

    const metrics = await connector.getMetrics({ startDate, endDate });

    const followers = metrics.followers ?? 0;
    const engagements = metrics.engagement ?? 0;
    const reach = metrics.reach ?? 0;
    const impressions = metrics.impressions ?? 0;

    const { error } = await supabase.from("profile_metrics").upsert(
      {
        social_profile_id: profile.id,
        metric_date: toDateOnly(date),
        followers_count: followers,
        engagements,
        reach,
        impressions,
        engagement_rate: computeEngagementRate(engagements, followers),
      },
      { onConflict: "social_profile_id,metric_date" },
    );

    if (error) {
      logger.error("profile_metrics upsert failed", error, {
        profileId: profile.id,
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Failed to collect metrics for profile", error, {
      profileId: profile.id,
      platform: profile.platform,
    });
    return false;
  }
}

/**
 * Collect daily profile metrics for all active social profiles in an org.
 * Upserts one row per (social_profile_id, metric_date) into profile_metrics.
 */
export async function collectAllMetrics(
  orgId: string,
  date: Date = new Date(),
): Promise<CollectMetricsResult> {
  const supabase = createServiceClient();

  const { data: profiles, error } = await supabase
    .from("social_profiles")
    .select(
      "id, org_id, platform, platform_user_id, access_token_encrypted, metadata, is_active",
    )
    .eq("org_id", orgId)
    .eq("is_active", true);

  if (error) {
    logger.error("Failed to load social profiles for metrics", error, {
      orgId,
    });
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  if (!profiles || profiles.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const profile of profiles as ProfileRow[]) {
    const ok = await collectForProfile(supabase, profile, date);
    if (ok) succeeded++;
    else failed++;
  }

  return { processed: profiles.length, succeeded, failed };
}

/**
 * Iterate every org and collect metrics for its active profiles.
 * Used by the daily cron handler.
 */
export async function collectMetricsForAllOrgs(
  date: Date = new Date(),
): Promise<CollectMetricsResult> {
  const supabase = createServiceClient();

  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("id");

  if (error) {
    logger.error("Failed to load organizations for metrics cron", error);
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const totals: CollectMetricsResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
  };

  for (const org of orgs ?? []) {
    const result = await collectAllMetrics(org.id, date);
    totals.processed += result.processed;
    totals.succeeded += result.succeeded;
    totals.failed += result.failed;
  }

  return totals;
}
