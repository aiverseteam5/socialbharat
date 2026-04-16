import { createServiceClient } from "@/lib/supabase/service";
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

  // 5. Bump last_message_at on the conversation
  await supabase
    .from("conversations")
    .update({
      last_message_at: incoming.message.timestamp.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  return {
    conversationId,
    messageId: msg.id,
    contactId: contact.id,
    deduplicated: false,
  };
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
