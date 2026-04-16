import { NextRequest, NextResponse } from "next/server";
import {
  twitterCrcResponseToken,
  verifyTwitterSignature,
} from "@/lib/webhooks/verify";
import {
  processIncomingMessage,
  resolveProfileByPlatformId,
  type NormalizedIncomingMessage,
} from "@/lib/inbox/message-processor";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * GET /api/webhooks/twitter
 * Twitter Account Activity API CRC challenge.
 * Twitter sends ?crc_token=...; we reply with
 * `{ response_token: "sha256=" + base64(HMAC-SHA256(crc_token, consumer_secret)) }`.
 */
export async function GET(request: NextRequest) {
  const crcToken = request.nextUrl.searchParams.get("crc_token");
  const consumerSecret = process.env.TWITTER_API_SECRET;
  if (!crcToken || !consumerSecret) {
    return NextResponse.json({ error: "crc_token missing" }, { status: 400 });
  }
  const responseToken = twitterCrcResponseToken(crcToken, consumerSecret);
  return NextResponse.json({ response_token: responseToken });
}

/**
 * POST /api/webhooks/twitter
 * Incoming DMs, mentions, and tweet events from the Account Activity API.
 * Signed with HMAC-SHA256 using consumer secret; header is
 * `x-twitter-webhooks-signature: sha256=<base64>`.
 */
export async function POST(request: NextRequest) {
  const consumerSecret = process.env.TWITTER_API_SECRET;
  if (!consumerSecret) {
    logger.error("TWITTER_API_SECRET not configured");
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-twitter-webhooks-signature");
  if (!verifyTwitterSignature(rawBody, signature, consumerSecret)) {
    logger.warn("Twitter webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // `for_user_id` identifies the subscribed account — our social_profiles.platform_user_id
  const forUserId = String(payload.for_user_id ?? "");
  if (!forUserId) {
    return NextResponse.json({ error: "Missing for_user_id" }, { status: 400 });
  }
  const profile = await resolveProfileByPlatformId("twitter", forUserId);
  if (!profile) {
    logger.warn("No connected social_profile for Twitter event", { forUserId });
    return NextResponse.json({ received: 0 });
  }

  let handled = 0;

  // Direct messages
  const dmEvents = payload.direct_message_events as
    | Array<Record<string, unknown>>
    | undefined;
  const users = payload.users as
    | Record<
        string,
        {
          name?: string;
          screen_name?: string;
          profile_image_url_https?: string;
        }
      >
    | undefined;
  if (dmEvents) {
    for (const ev of dmEvents) {
      if (ev.type !== "message_create") continue;
      const mc = ev.message_create as Record<string, unknown>;
      const senderId = String(mc.sender_id ?? "");
      if (!senderId || senderId === forUserId) continue; // skip echoes of our own DMs
      const target = mc.target as { recipient_id?: string } | undefined;
      const msgData = mc.message_data as { text?: string } | undefined;
      const senderProfile = users?.[senderId];
      const threadKey = [senderId, target?.recipient_id ?? forUserId]
        .sort()
        .join("-");

      const incoming: NormalizedIncomingMessage = {
        orgId: profile.orgId,
        socialProfileId: profile.id,
        platform: "twitter",
        conversationType: "message",
        platformConversationId: `tw:dm:${threadKey}`,
        contact: {
          platformUserId: senderId,
          displayName: senderProfile?.name,
          avatarUrl: senderProfile?.profile_image_url_https,
          metadata: { screen_name: senderProfile?.screen_name },
        },
        message: {
          platformMessageId: String(ev.id ?? `tw-dm-${Date.now()}`),
          content: msgData?.text ?? "",
          timestamp: new Date(
            typeof ev.created_timestamp === "string"
              ? parseInt(ev.created_timestamp, 10)
              : Date.now(),
          ),
        },
      };
      try {
        await processIncomingMessage(incoming);
        handled++;
      } catch (err) {
        logger.error("Twitter DM processing failed", err);
      }
    }
  }

  // Mentions / reply tweets
  const tweets = payload.tweet_create_events as
    | Array<Record<string, unknown>>
    | undefined;
  if (tweets) {
    for (const t of tweets) {
      const user = t.user as
        | {
            id_str?: string;
            name?: string;
            screen_name?: string;
            profile_image_url_https?: string;
          }
        | undefined;
      if (!user?.id_str || user.id_str === forUserId) continue;
      const text = String(t.text ?? "");
      if (!text.toLowerCase().includes(forUserId)) {
        // Only process mentions (tweets referencing our user)
        const mentions = (
          t.entities as
            | { user_mentions?: Array<{ id_str?: string }> }
            | undefined
        )?.user_mentions;
        if (!mentions?.some((um) => um.id_str === forUserId)) continue;
      }
      const tweetId = String(t.id_str ?? "");
      const incoming: NormalizedIncomingMessage = {
        orgId: profile.orgId,
        socialProfileId: profile.id,
        platform: "twitter",
        conversationType: "mention",
        platformConversationId: `tw:mention:${tweetId}`,
        contact: {
          platformUserId: user.id_str,
          displayName: user.name,
          avatarUrl: user.profile_image_url_https,
          metadata: { screen_name: user.screen_name },
        },
        message: {
          platformMessageId: tweetId,
          content: text,
          timestamp: new Date(
            typeof t.timestamp_ms === "string"
              ? parseInt(t.timestamp_ms, 10)
              : Date.now(),
          ),
          metadata: { tweet_id: tweetId },
        },
      };
      try {
        await processIncomingMessage(incoming);
        handled++;
      } catch (err) {
        logger.error("Twitter mention processing failed", err);
      }
    }
  }

  return NextResponse.json({ received: handled });
}
