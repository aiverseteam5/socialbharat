import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";
import { getPlatformConnector, type SocialPlatform } from "@/lib/platforms";
import type { ReplyContext } from "@/lib/platforms/base";
import { logger } from "@/lib/logger";

const bodySchema = z.object({
  /** When set, overrides the agent's draft (user edited the reply). */
  contentOverride: z.string().min(1).max(5000).optional(),
});

/**
 * POST /api/agent/inbox/send/[actionId]
 *
 * Dispatches an agent-drafted reply through the platform connector and marks
 * the action row as 'sent' (or 'edited' when contentOverride is supplied).
 *
 * Mirrors the dispatch logic in /api/inbox/conversations/[id]/reply — kept
 * duplicated rather than extracted, because the agent path also needs to
 * mutate the agent_inbox_actions row in the same transaction-ish flow.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ actionId: string }> },
) {
  const { actionId } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { data: action, error: actionErr } = await supabase
    .from("agent_inbox_actions")
    .select("id, org_id, conversation_id, draft_reply, status")
    .eq("id", actionId)
    .maybeSingle();
  if (actionErr || !action) {
    return NextResponse.json({ error: "Action not found" }, { status: 404 });
  }
  if (action.status === "sent") {
    return NextResponse.json({ error: "Action already sent" }, { status: 409 });
  }

  const content = parsed.data.contentOverride ?? action.draft_reply;
  if (!content) {
    return NextResponse.json(
      { error: "No reply text available to send" },
      { status: 400 },
    );
  }

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
    .eq("id", action.conversation_id)
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

  const { data: lastIncoming } = await supabase
    .from("messages")
    .select("platform_message_id, metadata")
    .eq("conversation_id", conversation.id)
    .eq("sender_type", "contact")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  try {
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

    const replyContext: ReplyContext = {
      type: conversation.type as ReplyContext["type"],
      recipientPlatformId: contact?.platform_user_id,
      parentPlatformMessageId: lastIncoming?.platform_message_id ?? undefined,
      metadata: (lastIncoming?.metadata ?? {}) as Record<string, unknown>,
    };

    const result = await connector.sendReply(replyContext, content);
    if (result.status === "failed") {
      return NextResponse.json(
        { error: result.error ?? "Platform refused the reply" },
        { status: 502 },
      );
    }

    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_type: "agent",
      sender_id: user.id,
      content,
      platform_message_id: result.platformMessageId || null,
      is_read: true,
    });

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation.id);

    const newStatus = parsed.data.contentOverride ? "edited" : "sent";
    await supabase
      .from("agent_inbox_actions")
      .update({
        status: newStatus,
        sent_by: user.id,
        sent_at: new Date().toISOString(),
        draft_reply: content,
      })
      .eq("id", actionId);

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err) {
    logger.error("agent-inbox send failed", err, { actionId });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send reply" },
      { status: 500 },
    );
  }
}
