import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

const NEGATIVE_RATIO_THRESHOLD = 0.5; // >50% negative in last hour
const VOLUME_SPIKE_MULTIPLIER = 3; // 3x the hourly average over last 24h

export interface AlertCheckResult {
  queryId: string;
  triggered: boolean;
  reason?: string;
  negativeMentions?: number;
  totalMentions?: number;
}

export async function checkAlertThresholds(): Promise<AlertCheckResult[]> {
  const supabase = createServiceClient();

  const { data: queries, error } = await supabase
    .from("listening_queries")
    .select("id, name, org_id")
    .eq("is_active", true);

  if (error || !queries) return [];

  const results: AlertCheckResult[] = [];

  for (const query of queries) {
    const result = await checkQueryAlerts(query.id, query.name, query.org_id);
    results.push(result);
  }

  return results;
}

export async function checkQueryAlerts(
  queryId: string,
  queryName: string,
  orgId: string,
): Promise<AlertCheckResult> {
  const supabase = createServiceClient();

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Mentions in the last hour
  const { data: recentMentions } = await supabase
    .from("listening_mentions")
    .select("sentiment_label")
    .eq("query_id", queryId)
    .gte("fetched_at", oneHourAgo);

  const recentTotal = recentMentions?.length ?? 0;

  // Mentions in the last 24h (excluding last hour) for baseline
  const { data: previousMentions } = await supabase
    .from("listening_mentions")
    .select("id")
    .eq("query_id", queryId)
    .gte("fetched_at", oneDayAgo)
    .lt("fetched_at", oneHourAgo);

  const previousTotal = previousMentions?.length ?? 0;

  if (recentTotal === 0) {
    return { queryId, triggered: false };
  }

  const negativeCount = (recentMentions ?? []).filter(
    (m: { sentiment_label: string | null }) => m.sentiment_label === "negative",
  ).length;
  const negativeRatio = negativeCount / recentTotal;

  // Calculate hourly baseline from the previous 23 hours
  const hourlyBaseline = previousTotal / 23;
  const volumeSpike =
    hourlyBaseline > 0 &&
    recentTotal >= hourlyBaseline * VOLUME_SPIKE_MULTIPLIER;
  const sentimentSpike = negativeRatio >= NEGATIVE_RATIO_THRESHOLD;

  const triggered = sentimentSpike || volumeSpike;

  if (!triggered) {
    return { queryId, triggered: false };
  }

  const reasons: string[] = [];
  if (sentimentSpike) {
    reasons.push(
      `${Math.round(negativeRatio * 100)}% negative sentiment in the last hour (${negativeCount}/${recentTotal} mentions)`,
    );
  }
  if (volumeSpike) {
    reasons.push(
      `Volume spike: ${recentTotal} mentions in last hour vs ${Math.round(hourlyBaseline)} hourly average`,
    );
  }
  const reason = reasons.join("; ");

  // Find org owner to notify
  const { data: owner } = await supabase
    .from("org_members")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("role", "owner")
    .limit(1)
    .single();

  if (owner) {
    const { error: notifErr } = await supabase.from("notifications").insert({
      user_id: owner.user_id,
      org_id: orgId,
      type: "crisis_alert",
      title: `Crisis Alert: ${queryName}`,
      body: reason,
      link: `/listening/queries/${queryId}`,
      metadata: {
        query_id: queryId,
        negative_count: negativeCount,
        total_mentions: recentTotal,
        negative_ratio: negativeRatio,
        volume_spike: volumeSpike,
      },
    });

    if (notifErr) {
      logger.error("Failed to create crisis_alert notification", notifErr);
    } else {
      logger.info("Crisis alert triggered", { queryId, reason });
    }
  }

  return {
    queryId,
    triggered: true,
    reason,
    negativeMentions: negativeCount,
    totalMentions: recentTotal,
  };
}
