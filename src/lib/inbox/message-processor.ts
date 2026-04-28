import { createServiceClient } from "@/lib/supabase/service";
import { sendNotificationVoid } from "@/lib/notifications/send";
import { maybeEnqueueAutoReply } from "@/lib/agents/auto-reply-gate";
import { logger } from "@/lib/logger";

export type InboxPlatform =
  | "facebook"
  | "instagram"
  | "twitter"
  | "linkedin"
  | "whatsapp";

export type ConversationType = "message" | "comment" | "mention" | "review";

export interface NormalizedIncomingMessage {
  orgId: string;
  socialProfileId: string | null;
  platform: InboxPlatform;
  conversationType: ConversationType;
  platformConversationId: string;
  contact: {
    platformUserId: string;
    displayName?: string;
    avatarUrl?: string;
    metadata?: Record<string, unknown>;
  };
  message: {
    platformMessageId: string;
    content: string;
    mediaUrls?: string[];
    timestamp: Date;
    metadata?: Record<string, unknown>;
  };
}

export interface ProcessResult {
  conversationId: string;
  messageId: string;
  contactId: string;
  deduplicated: boolean;
}

/**
 * Upsert contact, upsert conversation, insert message.
 * Safe to call repeatedly for the same webhook payload: dedupes on
 * (conversation_id, platform_message_id). Uses the service-role client and
 * must only be invoked from webhook / background contexts.
 */
export async function processIncomingMessage(
  incoming: NormalizedIncomingMessage,
): Promise<ProcessResult> {
  const supabase = createServiceClient();

  // 1. Upsert contact (unique on org_id + platform + platform_user_id)
  const { data: contact, error: contactErr } = await supabase
    .from("contacts")
    .upsert(
      {
        org_id: incoming.orgId,
        platform: incoming.platform,
        platform_user_id: incoming.contact.platformUserId,
        display_name: incoming.contact.displayName ?? null,
        avatar_url: incoming.contact.avatarUrl ?? null,
        metadata: incoming.contact.metadata ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,platform,platform_user_id" },
    )
    .select("id")
    .single();

  if (contactErr || !contact) {
    logger.error("Failed to upsert contact", contactErr, {
      orgId: incoming.orgId,
      platform: incoming.platform,
    });
    throw contactErr || new Error("Contact upsert returned no row");
  }

  // 1b. WhatsApp STOP-keyword opt-out (DPDP + Meta policy). Marks the contact
  //     so future broadcast campaigns exclude them. We still record the message
  //     and stay silent — sending a STOP-confirmation reply risks a consent
  //     loop and is deferred. The .is(opted_out_at, null) filter makes a
  //     repeat STOP a no-op (timestamp is set once).
  if (incoming.platform === "whatsapp") {
    const STOP_RX = /^\s*(stop|unsubscribe|remove|cancel)\s*$/i;
    if (STOP_RX.test(incoming.message.content)) {
      const { error: optErr } = await supabase
        .from("contacts")
        .update({ opted_out_at: new Date().toISOString() })
        .eq("id", contact.id)
        .is("opted_out_at", null);
      if (optErr) {
        logger.warn("opt-out update failed", {
          error: optErr,
          contactId: contact.id,
        });
      }
    }
  }

  // 2. Find or create conversation
  const { data: existingConv } = await supabase
    .from("conversations")
    .select("id")
    .eq("org_id", incoming.orgId)
    .eq("platform", incoming.platform)
    .eq("platform_conversation_id", incoming.platformConversationId)
    .maybeSingle();

  let conversationId: string;
  if (existingConv) {
    conversationId = existingConv.id;
  } else {
    const { data: newConv, error: convErr } = await supabase
      .from("conversations")
      .insert({
        org_id: incoming.orgId,
        social_profile_id: incoming.socialProfileId,
        contact_id: contact.id,
        platform: incoming.platform,
        platform_conversation_id: incoming.platformConversationId,
        type: incoming.conversationType,
        status: "open",
        last_message_at: incoming.message.timestamp.toISOString(),
      })
      .select("id")
      .single();
    if (convErr || !newConv) {
      logger.error("Failed to create conversation", convErr, {
        orgId: incoming.orgId,
      });
      throw convErr || new Error("Conversation insert returned no row");
    }
    conversationId = newConv.id;
  }

  // 3. Dedupe: skip if this platform_message_id is already on the conversation
  const { data: existingMsg } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("platform_message_id", incoming.message.platformMessageId)
    .maybeSingle();

  if (existingMsg) {
    return {
      conversationId,
      messageId: existingMsg.id,
      contactId: contact.id,
      deduplicated: true,
    };
  }

  // 4. Insert message
  const { data: msg, error: msgErr } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_type: "contact",
      sender_id: incoming.contact.platformUserId,
      content: incoming.message.content,
      media_urls: incoming.message.mediaUrls ?? [],
      platform_message_id: incoming.message.platformMessageId,
      is_read: false,
      metadata: incoming.message.metadata ?? {},
      created_at: incoming.message.timestamp.toISOString(),
    })
    .select("id")
    .single();

  if (msgErr || !msg) {
    logger.error("Failed to insert message", msgErr, { conversationId });
    throw msgErr || new Error("Message insert returned no row");
  }

  // 5. Lead seed: first inbound from this contact creates a 'New' lead.
  // Idempotent — repeats are no-ops via UNIQUE (org_id, contact_id) +
  // ignoreDuplicates. A 'Hot' lead messaging again must not regress to 'New'.
  // Best-effort: webhook must not 500 if CRM seeding fails.
  const { error: leadErr } = await supabase
    .from("leads")
    .upsert(
      { org_id: incoming.orgId, contact_id: contact.id, status: "New" },
      { onConflict: "org_id,contact_id", ignoreDuplicates: true },
    );
  if (leadErr) {
    logger.warn("lead auto-create failed", {
      error: leadErr,
      orgId: incoming.orgId,
      contactId: contact.id,
    });
  }

  // 6. Bump last_message_at on the conversation
  await supabase
    .from("conversations")
    .update({
      last_message_at: incoming.message.timestamp.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  // Notify assigned agent (best-effort)
  const { data: conv } = await supabase
    .from("conversations")
    .select("assigned_to")
    .eq("id", conversationId)
    .maybeSingle();

  if (conv?.assigned_to) {
    sendNotificationVoid({
      userId: conv.assigned_to as string,
      orgId: incoming.orgId,
      type: "inbox_message",
      title: "New inbox message",
      body: incoming.message.content.substring(0, 100),
      link: `/inbox`,
    });
  }

  // Auto-reply gate (WhatsApp inbound only). Best-effort — never blocks the
  // webhook. The gate evaluates org/conv/lead/contact/rate state and enqueues
  // an `auto_reply` agent job if every check passes.
  if (incoming.platform === "whatsapp") {
    try {
      const gate = await maybeEnqueueAutoReply(supabase, {
        orgId: incoming.orgId,
        conversationId,
        contactId: contact.id,
        triggeringMessageId: msg.id,
      });
      if (!gate.enqueued && gate.reason) {
        logger.info("auto-reply gate skipped", {
          reason: gate.reason,
          conversationId,
        });
      }
    } catch (err) {
      logger.warn("auto-reply gate failed", { error: err, conversationId });
    }
  }

  return {
    conversationId,
    messageId: msg.id,
    contactId: contact.id,
    deduplicated: false,
  };
}

export type DeliveryStatus = "sent" | "delivered" | "read" | "failed";

export interface NormalizedStatusUpdate {
  platformMessageId: string;
  status: DeliveryStatus;
  timestamp: Date;
}

/**
 * Apply a WhatsApp Cloud API status receipt (sent/delivered/read/failed) to
 * the matching outbound message. Calls the Postgres `apply_message_status`
 * function which does atomic, rank-based comparison: never downgrades, sets
 * timestamps once, and `failed` always wins. Idempotent on Meta retries.
 */
export async function applyMessageStatusUpdate(
  update: NormalizedStatusUpdate,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.rpc("apply_message_status", {
    p_platform_message_id: update.platformMessageId,
    p_status: update.status,
    p_ts: update.timestamp.toISOString(),
  });

  if (error) {
    logger.error("apply_message_status RPC failed", error, {
      platformMessageId: update.platformMessageId,
      status: update.status,
    });
    throw error;
  }

  // Mirror the status onto the broadcast recipients table when this
  // wamid was produced by a campaign send. The filter on `status IN
  // (lower-ranked)` makes the update race-safe and idempotent: retries
  // and out-of-order webhooks can never downgrade a row, and `skipped`
  // (operator cancel) is preserved because it's not in any allowed-from
  // set. No error if the wamid doesn't belong to any campaign.
  const allowedFrom: Record<DeliveryStatus, string[]> = {
    sent: ["pending"],
    delivered: ["pending", "sent"],
    read: ["pending", "sent", "delivered"],
    failed: ["pending", "sent", "delivered", "read"],
  };

  const { error: recipErr } = await supabase
    .from("whatsapp_broadcast_recipients")
    .update({ status: update.status })
    .eq("platform_message_id", update.platformMessageId)
    .in("status", allowedFrom[update.status]);

  if (recipErr) {
    logger.warn("broadcast recipient status update failed", {
      platformMessageId: update.platformMessageId,
      status: update.status,
      error: recipErr,
    });
  }
}

/**
 * Resolve the social_profile row for a platform-specific target id
 * (page id, IG business account id, WABA id, Twitter user id, etc.).
 * Used by webhook handlers to figure out which org a webhook belongs to.
 */
export async function resolveProfileByPlatformId(
  platform: InboxPlatform,
  platformUserId: string,
): Promise<{ id: string; orgId: string } | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("social_profiles")
    .select("id, org_id")
    .eq("platform", platform)
    .eq("platform_user_id", platformUserId)
    .maybeSingle();

  if (error) {
    logger.error("Failed to resolve social_profile", error, {
      platform,
      platformUserId,
    });
    return null;
  }
  if (!data) return null;
  return { id: data.id, orgId: data.org_id };
}
