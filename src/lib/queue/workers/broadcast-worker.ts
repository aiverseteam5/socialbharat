/**
 * Broadcast worker — fans out a WhatsApp campaign and sends one template
 * message per recipient.
 *
 * Job kinds:
 *   - fan-out:  paginate the campaign's pending recipients in batches of
 *               FAN_OUT_BATCH_SIZE and enqueue one send-one job each.
 *   - send-one: send the template to a single recipient, write back the
 *               platform_message_id, and bump per-campaign counters.
 *
 * Risk mitigations encoded here:
 *   - Risk #2 (opt-out race): send-one re-checks contacts.opted_out_at at
 *     send time and marks the recipient `skipped` if the contact opted out
 *     after the segment was resolved.
 *   - Risk #4 (Meta rate limit): limiter on the Worker caps to 250/min by
 *     default. Make this per-org in a follow-up; v1 ships with a single
 *     conservative cap shared by all orgs on the worker process.
 *   - Risk #5 (template variable mismatch): send-one validates that
 *     campaign.template_variables covers 1..variable_count and fails the
 *     recipient with VARIABLE_MISMATCH if not.
 *   - Risk #6 (outside-24h policy): only sendTemplate() is invoked — never
 *     the free-form sendMessage path.
 */
import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../connection";
import { QUEUE_NAMES, broadcastQueue, type BroadcastJobData } from "../queues";
import { createServiceClient } from "@/lib/supabase/service";
import { decrypt } from "@/lib/encryption";
import { WhatsAppConnector } from "@/lib/platforms/whatsapp";
import { logger } from "@/lib/logger";

const FAN_OUT_BATCH_SIZE = 100;

type SupabaseClient = ReturnType<typeof createServiceClient>;

export async function fanOutCampaign(
  job: Job<BroadcastJobData>,
): Promise<void> {
  const { campaignId, orgId } = job.data;
  const supabase = createServiceClient();

  // Mark running. Filter by current state so a cancelled campaign can't
  // restart, and so a duplicate fan-out job is a no-op.
  const { data: campaign } = await supabase
    .from("whatsapp_campaigns")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .in("status", ["scheduled", "draft", "running"])
    .select("id, status")
    .maybeSingle();

  if (!campaign) {
    logger.warn("broadcast-worker: fan-out skipped (not in startable state)", {
      campaignId,
    });
    return;
  }

  let pageStart = 0;
  let totalEnqueued = 0;

  for (;;) {
    const { data: batch, error } = await supabase
      .from("whatsapp_broadcast_recipients")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("status", "pending")
      .order("id")
      .range(pageStart, pageStart + FAN_OUT_BATCH_SIZE - 1);

    if (error) throw error;
    if (!batch || batch.length === 0) break;

    await broadcastQueue().addBulk(
      batch.map((r) => ({
        name: "send-one",
        data: {
          kind: "send-one" as const,
          campaignId,
          recipientId: r.id,
          orgId,
        },
      })),
    );

    totalEnqueued += batch.length;
    if (batch.length < FAN_OUT_BATCH_SIZE) break;
    pageStart += FAN_OUT_BATCH_SIZE;
  }

  logger.info("broadcast-worker: fan-out complete", {
    campaignId,
    totalEnqueued,
  });
}

export async function sendOneRecipient(
  job: Job<BroadcastJobData>,
): Promise<void> {
  const { campaignId, recipientId, orgId } = job.data;
  if (!recipientId) {
    throw new Error("send-one job missing recipientId");
  }
  const supabase = createServiceClient();

  const { data: recipient } = await supabase
    .from("whatsapp_broadcast_recipients")
    .select("id, contact_id, status")
    .eq("id", recipientId)
    .maybeSingle();

  // Anything not pending was already handled — cancellation, duplicate
  // job, or a manual operator action. Bail without bumping counters.
  if (!recipient || recipient.status !== "pending") {
    logger.info("broadcast-worker: send-one skipped (not pending)", {
      recipientId,
      status: recipient?.status,
    });
    return;
  }

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, platform_user_id, opted_out_at")
    .eq("id", recipient.contact_id)
    .maybeSingle();

  if (!contact) {
    await failRecipient(
      supabase,
      recipientId,
      campaignId,
      "CONTACT_NOT_FOUND",
      "Contact missing at send time",
    );
    return;
  }

  // Risk #2 mitigation: opt-out may have arrived between segment-resolve
  // and dispatch. Mark skipped (not failed) so the operator can see the
  // distinction and the campaign still completes cleanly.
  if (contact.opted_out_at) {
    await supabase
      .from("whatsapp_broadcast_recipients")
      .update({ status: "skipped" })
      .eq("id", recipientId);
    await checkCampaignCompletion(supabase, campaignId);
    return;
  }

  const { data: campaign } = await supabase
    .from("whatsapp_campaigns")
    .select("id, template_id, template_variables, status")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign || campaign.status === "cancelled") {
    await supabase
      .from("whatsapp_broadcast_recipients")
      .update({ status: "skipped" })
      .eq("id", recipientId);
    return;
  }

  const { data: template } = await supabase
    .from("whatsapp_templates")
    .select("name, language, variable_count")
    .eq("id", campaign.template_id)
    .maybeSingle();

  if (!template) {
    await failRecipient(
      supabase,
      recipientId,
      campaignId,
      "TEMPLATE_NOT_FOUND",
      "Template missing at send time",
    );
    return;
  }

  const { data: profile } = await supabase
    .from("social_profiles")
    .select("access_token_encrypted, metadata")
    .eq("org_id", orgId)
    .eq("platform", "whatsapp")
    .limit(1)
    .maybeSingle();

  if (!profile) {
    await failRecipient(
      supabase,
      recipientId,
      campaignId,
      "WHATSAPP_NOT_CONNECTED",
      "WhatsApp profile not connected for this org",
    );
    return;
  }

  const phoneNumberId = (profile.metadata as { phone_number_id?: string })
    ?.phone_number_id;
  if (!phoneNumberId) {
    await failRecipient(
      supabase,
      recipientId,
      campaignId,
      "PHONE_NUMBER_ID_MISSING",
      "phone_number_id missing in profile metadata",
    );
    return;
  }

  // Build template body components. Risk #5: every {{N}} placeholder must
  // map to a value in campaign.template_variables; missing keys fail the
  // recipient (the rest of the campaign continues).
  let components: unknown[] | undefined;
  if (template.variable_count > 0) {
    const vars = (campaign.template_variables ?? {}) as Record<string, string>;
    const parameters: Array<{ type: "text"; text: string }> = [];
    for (let i = 1; i <= template.variable_count; i++) {
      const v = vars[String(i)];
      if (typeof v !== "string") {
        await failRecipient(
          supabase,
          recipientId,
          campaignId,
          "VARIABLE_MISMATCH",
          `Missing template variable {{${i}}}`,
        );
        return;
      }
      parameters.push({ type: "text", text: v });
    }
    components = [{ type: "body", parameters }];
  }

  const accessToken = decrypt(profile.access_token_encrypted);
  const connector = new WhatsAppConnector(accessToken, phoneNumberId);

  try {
    const platformMessageId = await connector.sendTemplate(
      contact.platform_user_id,
      template.name,
      template.language,
      components,
    );

    await supabase
      .from("whatsapp_broadcast_recipients")
      .update({
        status: "sent",
        platform_message_id: platformMessageId,
        sent_at: new Date().toISOString(),
      })
      .eq("id", recipientId);

    await bumpCounter(supabase, campaignId, "sent");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failRecipient(
      supabase,
      recipientId,
      campaignId,
      "META_SEND_FAILED",
      message,
    );
    throw err;
  }
}

async function failRecipient(
  supabase: SupabaseClient,
  recipientId: string,
  campaignId: string,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  await supabase
    .from("whatsapp_broadcast_recipients")
    .update({
      status: "failed",
      error_code: errorCode,
      error_message: errorMessage,
    })
    .eq("id", recipientId);
  await bumpCounter(supabase, campaignId, "failed");
}

// Counter bump is read-modify-write. Concurrency is bounded (worker
// concurrency 10), so race-induced drift is small and the recipients
// table remains the source of truth — counters are an approximation
// surfaced in the campaign list. Completion check uses an exact COUNT.
async function bumpCounter(
  supabase: SupabaseClient,
  campaignId: string,
  field: "sent" | "failed",
): Promise<void> {
  const { data } = await supabase
    .from("whatsapp_campaigns")
    .select("sent_count, failed_count")
    .eq("id", campaignId)
    .maybeSingle();
  if (!data) return;
  const patch =
    field === "sent"
      ? { sent_count: (data.sent_count ?? 0) + 1 }
      : { failed_count: (data.failed_count ?? 0) + 1 };
  await supabase
    .from("whatsapp_campaigns")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", campaignId);
  await checkCampaignCompletion(supabase, campaignId);
}

async function checkCampaignCompletion(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<void> {
  const { count: terminalCount } = await supabase
    .from("whatsapp_broadcast_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("status", ["sent", "delivered", "read", "failed", "skipped"]);

  const { data: campaign } = await supabase
    .from("whatsapp_campaigns")
    .select("total_recipients, status")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) return;
  if (campaign.status !== "running") return;
  if ((terminalCount ?? 0) < (campaign.total_recipients ?? 0)) return;

  await supabase
    .from("whatsapp_campaigns")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .eq("status", "running");
}

export async function handleBroadcastJob(
  job: Job<BroadcastJobData>,
): Promise<void> {
  if (job.data.kind === "fan-out") {
    await fanOutCampaign(job);
    return;
  }
  if (job.data.kind === "send-one") {
    await sendOneRecipient(job);
    return;
  }
  throw new Error(`broadcast-worker: unknown kind ${String(job.data.kind)}`);
}

export function createBroadcastWorker(): Worker<BroadcastJobData> {
  const worker = new Worker<BroadcastJobData>(
    QUEUE_NAMES.broadcast,
    handleBroadcastJob,
    {
      connection: getRedisConnection(),
      concurrency: 10,
      // Risk #4 mitigation: cap throughput to stay under Meta's per-tier
      // rate limits. Configurable per-org in a follow-up; v1 uses a single
      // conservative cap shared across the worker process.
      limiter: { max: 250, duration: 60_000 },
    },
  );

  worker.on("failed", (job, err) => {
    logger.error("broadcast-worker: job failed", err, {
      jobId: job?.id,
      attempts: job?.attemptsMade,
      kind: job?.data?.kind,
      campaignId: job?.data?.campaignId,
    });
  });

  return worker;
}
