import type { SupabaseClient } from "@supabase/supabase-js";
import { agentQueue } from "@/lib/queue/queues";
import { logger } from "@/lib/logger";

export const AUTO_REPLY_DAILY_CAP = 5;
export const AUTO_REPLY_BURST_WINDOW_MS = 60_000;

export interface AutoReplyGateContext {
  orgId: string;
  conversationId: string;
  contactId: string;
  triggeringMessageId: string;
}

export type AutoReplyGateSkipReason =
  | "opted_out"
  | "org_not_opted_in"
  | "conversation_missing"
  | "conversation_closed"
  | "conversation_snoozed"
  | "conversation_paused"
  | "human_assigned"
  | "lead_hot"
  | "lead_paid"
  | "daily_cap"
  | "rate_limit";

export interface AutoReplyGateResult {
  enqueued: boolean;
  reason?: AutoReplyGateSkipReason;
}

/**
 * Decides whether an inbound WhatsApp message should trigger an autonomous
 * AI reply, and if so enqueues the agent worker job. All checks are evaluated
 * at gate-time (fresh from DB) — no stale state from earlier in the webhook.
 *
 * Caller is responsible for: only invoking this for whatsapp + sender=contact.
 */
export async function maybeEnqueueAutoReply(
  supabase: SupabaseClient,
  ctx: AutoReplyGateContext,
): Promise<AutoReplyGateResult> {
  const dailyCutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const burstCutoff = new Date(
    Date.now() - AUTO_REPLY_BURST_WINDOW_MS,
  ).toISOString();

  const [orgRes, convRes, contactRes, leadRes, dailyCountRes, recentCountRes] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("opted_in_to_agent_automation")
        .eq("id", ctx.orgId)
        .maybeSingle(),
      supabase
        .from("conversations")
        .select("status, auto_reply_paused_at, assigned_to")
        .eq("id", ctx.conversationId)
        .maybeSingle(),
      supabase
        .from("contacts")
        .select("opted_out_at")
        .eq("id", ctx.contactId)
        .maybeSingle(),
      supabase
        .from("leads")
        .select("status")
        .eq("org_id", ctx.orgId)
        .eq("contact_id", ctx.contactId)
        .maybeSingle(),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", ctx.conversationId)
        .not("metadata->auto_reply", "is", null)
        .gte("created_at", dailyCutoff),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", ctx.conversationId)
        .not("metadata->auto_reply", "is", null)
        .gte("created_at", burstCutoff),
    ]);

  if (contactRes.data?.opted_out_at) {
    return { enqueued: false, reason: "opted_out" };
  }
  if (!orgRes.data?.opted_in_to_agent_automation) {
    return { enqueued: false, reason: "org_not_opted_in" };
  }
  const conv = convRes.data as
    | {
        status?: string | null;
        auto_reply_paused_at?: string | null;
        assigned_to?: string | null;
      }
    | null
    | undefined;
  if (!conv) return { enqueued: false, reason: "conversation_missing" };
  if (conv.status === "closed") {
    return { enqueued: false, reason: "conversation_closed" };
  }
  if (conv.status === "snoozed") {
    return { enqueued: false, reason: "conversation_snoozed" };
  }
  if (conv.auto_reply_paused_at) {
    return { enqueued: false, reason: "conversation_paused" };
  }
  if (conv.assigned_to) {
    return { enqueued: false, reason: "human_assigned" };
  }
  const leadStatus = (leadRes.data as { status?: string } | null)?.status;
  if (leadStatus === "Hot") return { enqueued: false, reason: "lead_hot" };
  if (leadStatus === "Paid") return { enqueued: false, reason: "lead_paid" };
  if ((dailyCountRes.count ?? 0) >= AUTO_REPLY_DAILY_CAP) {
    return { enqueued: false, reason: "daily_cap" };
  }
  if ((recentCountRes.count ?? 0) > 0) {
    return { enqueued: false, reason: "rate_limit" };
  }

  try {
    await agentQueue().add("auto_reply", {
      kind: "auto_reply",
      orgId: ctx.orgId,
      conversationId: ctx.conversationId,
      triggeringMessageId: ctx.triggeringMessageId,
      triggeredBy: "webhook",
    });
  } catch (err) {
    // Queue failures must not break the webhook. Log and treat as skipped.
    logger.error("auto-reply enqueue failed", err, {
      conversationId: ctx.conversationId,
    });
    return { enqueued: false };
  }

  return { enqueued: true };
}
