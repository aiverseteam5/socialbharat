/**
 * Auto-reply runner — executes a single auto-reply attempt for one
 * triggering inbound WhatsApp message.
 *
 * Called from the agent worker (kind="auto_reply"). Owns:
 *   1. Loading triggering message + conversation + contact + history.
 *   2. Defensive re-check of the gates that already ran in the webhook —
 *      a human may have grabbed the conversation between enqueue and run.
 *   3. Loading per-org grounding (org_agent_knowledge.body) + brand voice.
 *   4. Calling decideAutoReply() (regex + Claude self-confidence).
 *   5. Either sending via WhatsAppConnector.sendMessage() and inserting
 *      an outbound `messages` row tagged with metadata.auto_reply, OR
 *      writing an `agent_inbox_actions` escape row for human review.
 *
 * Throws only on transient failures the BullMQ retry policy should
 * handle (Anthropic timeout, Meta send error). Stale-state aborts are
 * logged-and-returned, never thrown.
 */
import { createServiceClient } from "@/lib/supabase/service";
import { decrypt } from "@/lib/encryption";
import { WhatsAppConnector } from "@/lib/platforms/whatsapp";
import { logger } from "@/lib/logger";
import { ANTHROPIC_MODEL } from "./anthropic-client";
import { buildBrandSystemPrompt, loadBrandVoice } from "./brand-voice";
import {
  decideAutoReply,
  type AutoReplyMessage,
  type AutoReplyDecision,
} from "./auto-reply";

const HISTORY_LIMIT = 10;

export interface AutoReplyRunContext {
  orgId: string;
  conversationId: string;
  triggeringMessageId: string;
}

export type AutoReplyRunOutcome =
  | "sent"
  | "escaped"
  | "stale_message"
  | "stale_conversation"
  | "stale_contact"
  | "stale_paused"
  | "stale_human_assigned"
  | "stale_status";

export interface AutoReplyRunResult {
  outcome: AutoReplyRunOutcome;
  decision?: AutoReplyDecision;
}

export async function runAutoReply(
  ctx: AutoReplyRunContext,
): Promise<AutoReplyRunResult> {
  const supabase = createServiceClient();

  // 1. Load the triggering message. If it vanished (deleted between enqueue
  // and run, or wrong id), bail without retrying.
  const { data: trigger } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_type, content, created_at")
    .eq("id", ctx.triggeringMessageId)
    .maybeSingle();

  if (!trigger || trigger.sender_type !== "contact") {
    logger.info("auto-reply runner: triggering message stale", {
      triggeringMessageId: ctx.triggeringMessageId,
    });
    return { outcome: "stale_message" };
  }

  // 2. Re-check conversation state. The gate ran at webhook time but a human
  // could have paused, closed, or claimed the conversation in the interim.
  const { data: conv } = await supabase
    .from("conversations")
    .select(
      "id, org_id, contact_id, status, auto_reply_paused_at, assigned_to, language_detected",
    )
    .eq("id", ctx.conversationId)
    .maybeSingle();

  if (!conv) {
    return { outcome: "stale_conversation" };
  }
  if (conv.status === "closed" || conv.status === "snoozed") {
    return { outcome: "stale_status" };
  }
  if (conv.auto_reply_paused_at) {
    return { outcome: "stale_paused" };
  }
  if (conv.assigned_to) {
    return { outcome: "stale_human_assigned" };
  }

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, platform_user_id, opted_out_at")
    .eq("id", conv.contact_id)
    .maybeSingle();

  if (!contact || contact.opted_out_at) {
    return { outcome: "stale_contact" };
  }

  // 3. Load brand voice + grounding knowledge.
  const voice = await loadBrandVoice(supabase, ctx.orgId);
  const brandSystemPrompt = buildBrandSystemPrompt(voice);

  const { data: knowledgeRow } = await supabase
    .from("org_agent_knowledge")
    .select("body")
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  const knowledge = (knowledgeRow as { body?: string } | null)?.body ?? "";

  // 4. Load recent history (chronological, last HISTORY_LIMIT messages
  // before the trigger). Order desc by created_at then reverse.
  const { data: rawHistory } = await supabase
    .from("messages")
    .select("sender_type, content, created_at")
    .eq("conversation_id", ctx.conversationId)
    .lt("created_at", trigger.created_at)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const history: AutoReplyMessage[] = (rawHistory ?? [])
    .reverse()
    .filter(
      (m): m is { sender_type: string; content: string; created_at: string } =>
        m.content != null &&
        (m.sender_type === "contact" || m.sender_type === "agent"),
    )
    .map((m) => ({
      role: m.sender_type === "contact" ? "contact" : "agent",
      content: m.content,
    }));

  // 5. Decide.
  const decision = await decideAutoReply({
    inboundContent: trigger.content ?? "",
    detectedLanguage: conv.language_detected ?? null,
    history,
    knowledge,
    brandSystemPrompt,
  });

  if (decision.kind === "escape") {
    await writeEscapeAction(
      supabase,
      ctx,
      decision.reason,
      decision.draftReply,
      decision.confidence,
    );
    return { outcome: "escaped", decision };
  }

  // 6. Send. Throws on Meta error so BullMQ retries.
  await sendAndPersist(
    supabase,
    ctx,
    contact.platform_user_id,
    decision.reply,
    decision.confidence,
  );
  return { outcome: "sent", decision };
}

async function writeEscapeAction(
  supabase: ReturnType<typeof createServiceClient>,
  ctx: AutoReplyRunContext,
  reason: string,
  draftReply: string | null,
  confidence: number,
): Promise<void> {
  const { error } = await supabase.from("agent_inbox_actions").insert({
    org_id: ctx.orgId,
    conversation_id: ctx.conversationId,
    intent: "auto_reply",
    draft_reply: draftReply,
    flags: [reason, `confidence:${confidence.toFixed(2)}`],
    status: "pending",
  });
  if (error) {
    logger.warn("auto-reply runner: escape row insert failed", {
      error: error.message,
      conversationId: ctx.conversationId,
    });
  }
}

async function sendAndPersist(
  supabase: ReturnType<typeof createServiceClient>,
  ctx: AutoReplyRunContext,
  recipientPhone: string,
  reply: string,
  confidence: number,
): Promise<void> {
  const { data: profile } = await supabase
    .from("social_profiles")
    .select("access_token_encrypted, metadata")
    .eq("org_id", ctx.orgId)
    .eq("platform", "whatsapp")
    .limit(1)
    .maybeSingle();

  if (!profile) {
    throw new Error("auto-reply: WhatsApp profile not connected for org");
  }
  const phoneNumberId = (profile.metadata as { phone_number_id?: string })
    ?.phone_number_id;
  if (!phoneNumberId) {
    throw new Error("auto-reply: phone_number_id missing in profile metadata");
  }

  const accessToken = decrypt(profile.access_token_encrypted);
  const connector = new WhatsAppConnector(accessToken, phoneNumberId);
  const platformMessageId = await connector.sendMessage(recipientPhone, reply);

  const sentAt = new Date().toISOString();
  const { error: insertErr } = await supabase.from("messages").insert({
    conversation_id: ctx.conversationId,
    sender_type: "agent",
    content: reply,
    platform_message_id: platformMessageId,
    is_read: true,
    delivery_status: "sent",
    metadata: {
      auto_reply: {
        sent_at: sentAt,
        model: ANTHROPIC_MODEL,
        confidence,
        triggering_message_id: ctx.triggeringMessageId,
      },
    },
    created_at: sentAt,
  });

  if (insertErr) {
    logger.error(
      "auto-reply runner: outbound message insert failed",
      insertErr,
      { conversationId: ctx.conversationId, platformMessageId },
    );
    throw insertErr;
  }

  await supabase
    .from("conversations")
    .update({
      last_message_at: sentAt,
      updated_at: sentAt,
    })
    .eq("id", ctx.conversationId);
}
