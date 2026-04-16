import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { replyMessageSchema } from "@/types/schemas";
import { decrypt } from "@/lib/encryption";
import { getPlatformConnector, type SocialPlatform } from "@/lib/platforms";
import type { ReplyContext } from "@/lib/platforms/base";
import { logger } from "@/lib/logger";

/**
 * POST /api/inbox/conversations/[id]/reply
 * Send a reply in a conversation via the underlying platform connector.
 * Inserts an agent-authored message row on success.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = replyMessageSchema.parse(body);

    const { data: conversation, error: convErr } = await supabase
      .from("conversations")
      .select(
        `
        id, org_id, platform, type, platform_conversation_id,
        social_profile_id, contact_id,
        contact:contacts!contact_id (platform_user_id),
        social_profile:social_profiles!social_profile_id (
          access_token_encrypted, platform_user_id, metadata
        )
        `,
      )
      .eq("id", id)
      .single();

    if (convErr || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    const socialProfile = Array.isArray(conversation.social_profile)
      ? conversation.social_profile[0]
      : conversation.social_profile;
    if (!socialProfile?.access_token_encrypted) {
      return NextResponse.json(
        { error: "No connected social profile for this conversation" },
        { status: 400 },
      );
    }

    const contact = Array.isArray(conversation.contact)
      ? conversation.contact[0]
      : conversation.contact;

    // Find the most recent incoming message so we can thread comments/mentions.
    const { data: lastIncoming } = await supabase
      .from("messages")
      .select("platform_message_id, metadata")
      .eq("conversation_id", id)
      .eq("sender_type", "contact")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const decryptedToken = decrypt(socialProfile.access_token_encrypted);
    const profileMetadata = (socialProfile.metadata ?? {}) as Record<
      string,
      unknown
    >;

    const connector = getPlatformConnector(
      conversation.platform as SocialPlatform,
      {
        accessToken: decryptedToken,
        platformUserId: socialProfile.platform_user_id,
        organizationUrn: profileMetadata.organization_urn as string | undefined,
        personUrn: profileMetadata.person_urn as string | undefined,
        phoneNumberId: profileMetadata.phone_number_id as string | undefined,
      },
    );

    const context: ReplyContext = {
      type: conversation.type as ReplyContext["type"],
      recipientPlatformId: contact?.platform_user_id,
      parentPlatformMessageId: lastIncoming?.platform_message_id ?? undefined,
      metadata: (lastIncoming?.metadata ?? {}) as Record<string, unknown>,
    };

    const result = await connector.sendReply(
      context,
      parsed.content,
      parsed.media_urls,
    );

    if (result.status === "failed") {
      return NextResponse.json(
        { error: result.error ?? "Platform refused the reply" },
        { status: 502 },
      );
    }

    const { data: message, error: msgErr } = await supabase
      .from("messages")
      .insert({
        conversation_id: id,
        sender_type: "agent",
        sender_id: user.id,
        content: parsed.content,
        media_urls: parsed.media_urls,
        platform_message_id: result.platformMessageId || null,
        is_read: true,
      })
      .select()
      .single();

    if (msgErr) throw msgErr;

    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    logger.error("POST /api/inbox/conversations/[id]/reply failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to send reply",
      },
      { status: 500 },
    );
  }
}
