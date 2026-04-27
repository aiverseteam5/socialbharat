import { NextRequest, NextResponse } from "next/server";
import { verifyMetaSignature } from "@/lib/webhooks/verify";
import {
  processIncomingMessage,
  resolveProfileByPlatformId,
  applyMessageStatusUpdate,
  type InboxPlatform,
  type NormalizedIncomingMessage,
  type NormalizedStatusUpdate,
  type DeliveryStatus,
} from "@/lib/inbox/message-processor";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * GET /api/webhooks/meta
 * Meta webhook verification handshake.
 * Meta sends ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
 * and expects us to echo back hub.challenge if the verify_token matches.
 */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && token && expected && token === expected) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * POST /api/webhooks/meta
 * Receives FB Page / IG / WhatsApp Cloud events. Routes by `object` field.
 * Dedupes on (conversation_id, platform_message_id) in the processor.
 */
export async function POST(request: NextRequest) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    logger.error("META_APP_SECRET not configured");
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyMetaSignature(rawBody, signature, appSecret)) {
    logger.warn("Meta webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = payload as { object?: string; entry?: unknown[] };
  const entries = Array.isArray(body.entry) ? body.entry : [];

  const results: Array<{ ok: boolean; error?: string }> = [];

  for (const rawEntry of entries) {
    try {
      const normalized = normalizeMetaEntry(body.object, rawEntry);
      for (const n of normalized) {
        const profile = await resolveProfileByPlatformId(
          n.platform,
          n.profileTargetId,
        );
        if (!profile) {
          logger.warn("No connected social_profile for Meta event", {
            platform: n.platform,
            targetId: n.profileTargetId,
          });
          results.push({ ok: false, error: "profile not connected" });
          continue;
        }
        const incoming: NormalizedIncomingMessage = {
          orgId: profile.orgId,
          socialProfileId: profile.id,
          platform: n.platform,
          conversationType: n.conversationType,
          platformConversationId: n.platformConversationId,
          contact: n.contact,
          message: n.message,
        };
        await processIncomingMessage(incoming);
        results.push({ ok: true });
      }

      // WhatsApp also delivers status receipts (sent/delivered/read/failed)
      // alongside or independently of incoming messages. Apply via the
      // race-safe RPC; idempotent on Meta retries.
      const statuses = normalizeMetaStatusUpdates(body.object, rawEntry);
      for (const s of statuses) {
        await applyMessageStatusUpdate(s);
        results.push({ ok: true });
      }
    } catch (err) {
      logger.error("Meta entry processing failed", err);
      results.push({
        ok: false,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  // Meta requires a 200 response to stop retries even on partial failures.
  return NextResponse.json({ received: results.length });
}

// ------------------------------------------------------------------
// Normalizers — shape Meta's per-object-type payloads into the common
// NormalizedIncomingMessage used by processIncomingMessage.
// ------------------------------------------------------------------

interface NormalizedMetaEvent {
  platform: InboxPlatform;
  /** platform_user_id on social_profiles (page id / IG biz id / WABA id) */
  profileTargetId: string;
  conversationType: "message" | "comment" | "mention";
  platformConversationId: string;
  contact: NormalizedIncomingMessage["contact"];
  message: NormalizedIncomingMessage["message"];
}

function normalizeMetaEntry(
  object: string | undefined,
  rawEntry: unknown,
): NormalizedMetaEvent[] {
  const entry = rawEntry as Record<string, unknown>;
  if (object === "page") return normalizeFacebook(entry);
  if (object === "instagram") return normalizeInstagram(entry);
  if (object === "whatsapp_business_account") return normalizeWhatsApp(entry);
  return [];
}

type RawMessaging = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; attachments?: unknown[] };
};

function normalizeFacebook(
  entry: Record<string, unknown>,
): NormalizedMetaEvent[] {
  const pageId = String(entry.id ?? "");
  const out: NormalizedMetaEvent[] = [];

  const messaging = entry.messaging as RawMessaging[] | undefined;
  if (messaging) {
    for (const m of messaging) {
      if (!m.message || !m.sender?.id) continue;
      out.push({
        platform: "facebook",
        profileTargetId: pageId,
        conversationType: "message",
        platformConversationId: `fb:${pageId}:${m.sender.id}`,
        contact: { platformUserId: m.sender.id },
        message: {
          platformMessageId: m.message.mid ?? `fb-${Date.now()}`,
          content: m.message.text ?? "",
          timestamp: new Date(m.timestamp ? m.timestamp : Date.now()),
          metadata: { attachments: m.message.attachments ?? [] },
        },
      });
    }
  }

  const changes = entry.changes as Array<Record<string, unknown>> | undefined;
  if (changes) {
    for (const c of changes) {
      if (c.field !== "feed") continue;
      const value = c.value as Record<string, unknown> | undefined;
      if (!value || value.item !== "comment") continue;
      const from = value.from as { id?: string; name?: string } | undefined;
      const commentId = String(value.comment_id ?? "");
      const postId = String(value.post_id ?? "");
      if (!from?.id || !commentId) continue;
      out.push({
        platform: "facebook",
        profileTargetId: pageId,
        conversationType: "comment",
        platformConversationId: `fb:comment:${postId}`,
        contact: {
          platformUserId: from.id,
          displayName: from.name,
        },
        message: {
          platformMessageId: commentId,
          content: String(value.message ?? ""),
          timestamp: new Date(
            typeof value.created_time === "number"
              ? (value.created_time as number) * 1000
              : Date.now(),
          ),
          metadata: { post_id: postId, parent_comment_id: commentId },
        },
      });
    }
  }

  return out;
}

function normalizeInstagram(
  entry: Record<string, unknown>,
): NormalizedMetaEvent[] {
  const igUserId = String(entry.id ?? "");
  const out: NormalizedMetaEvent[] = [];

  const messaging = entry.messaging as RawMessaging[] | undefined;
  if (messaging) {
    for (const m of messaging) {
      if (!m.message || !m.sender?.id) continue;
      out.push({
        platform: "instagram",
        profileTargetId: igUserId,
        conversationType: "message",
        platformConversationId: `ig:${igUserId}:${m.sender.id}`,
        contact: { platformUserId: m.sender.id },
        message: {
          platformMessageId: m.message.mid ?? `ig-${Date.now()}`,
          content: m.message.text ?? "",
          timestamp: new Date(m.timestamp ? m.timestamp : Date.now()),
          metadata: { attachments: m.message.attachments ?? [] },
        },
      });
    }
  }

  const changes = entry.changes as Array<Record<string, unknown>> | undefined;
  if (changes) {
    for (const c of changes) {
      if (c.field !== "comments") continue;
      const value = c.value as Record<string, unknown> | undefined;
      if (!value) continue;
      const from = value.from as { id?: string; username?: string } | undefined;
      const commentId = String(value.id ?? "");
      const mediaId = String((value.media as { id?: string })?.id ?? "");
      if (!from?.id || !commentId) continue;
      out.push({
        platform: "instagram",
        profileTargetId: igUserId,
        conversationType: "comment",
        platformConversationId: `ig:comment:${mediaId || commentId}`,
        contact: {
          platformUserId: from.id,
          displayName: from.username,
        },
        message: {
          platformMessageId: commentId,
          content: String(value.text ?? ""),
          timestamp: new Date(),
          metadata: { media_id: mediaId },
        },
      });
    }
  }

  return out;
}

function normalizeMetaStatusUpdates(
  object: string | undefined,
  rawEntry: unknown,
): NormalizedStatusUpdate[] {
  if (object !== "whatsapp_business_account") return [];
  const entry = rawEntry as Record<string, unknown>;
  const out: NormalizedStatusUpdate[] = [];
  const changes = entry.changes as Array<Record<string, unknown>> | undefined;
  if (!changes) return out;

  for (const c of changes) {
    if (c.field !== "messages") continue;
    const value = c.value as Record<string, unknown> | undefined;
    if (!value) continue;

    const statuses = value.statuses as
      | Array<{ id?: string; status?: string; timestamp?: string }>
      | undefined;
    if (!statuses) continue;

    for (const s of statuses) {
      if (!s.id || !s.status) continue;
      const status = s.status as DeliveryStatus;
      if (
        status !== "sent" &&
        status !== "delivered" &&
        status !== "read" &&
        status !== "failed"
      ) {
        continue;
      }
      out.push({
        platformMessageId: s.id,
        status,
        timestamp: new Date(
          s.timestamp ? parseInt(s.timestamp, 10) * 1000 : Date.now(),
        ),
      });
    }
  }

  return out;
}

function normalizeWhatsApp(
  entry: Record<string, unknown>,
): NormalizedMetaEvent[] {
  const out: NormalizedMetaEvent[] = [];
  const changes = entry.changes as Array<Record<string, unknown>> | undefined;
  if (!changes) return out;

  for (const c of changes) {
    if (c.field !== "messages") continue;
    const value = c.value as Record<string, unknown> | undefined;
    if (!value) continue;

    const metadata = value.metadata as
      | { phone_number_id?: string; display_phone_number?: string }
      | undefined;
    const phoneNumberId = metadata?.phone_number_id;
    if (!phoneNumberId) continue;

    const contacts = value.contacts as
      | Array<{ profile?: { name?: string }; wa_id?: string }>
      | undefined;
    const messages = value.messages as
      | Array<{
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
        }>
      | undefined;
    if (!messages) continue;

    for (const m of messages) {
      if (!m.from || !m.id) continue;
      const contactProfile = contacts?.find((ct) => ct.wa_id === m.from);
      out.push({
        platform: "whatsapp",
        profileTargetId: phoneNumberId,
        conversationType: "message",
        platformConversationId: `wa:${phoneNumberId}:${m.from}`,
        contact: {
          platformUserId: m.from,
          displayName: contactProfile?.profile?.name,
        },
        message: {
          platformMessageId: m.id,
          content: m.text?.body ?? "",
          timestamp: new Date(
            m.timestamp ? parseInt(m.timestamp, 10) * 1000 : Date.now(),
          ),
          metadata: { type: m.type },
        },
      });
    }
  }

  return out;
}
