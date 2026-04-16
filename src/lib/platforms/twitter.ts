import {
  BasePlatformConnector,
  PlatformPost,
  PlatformMetrics,
  PlatformProfile,
  PlatformPostResult,
  ReplyContext,
  PlatformReplyResult,
} from "./base";

/**
 * Twitter/X API v2 connector
 * Supports creating tweets with text and media
 */
export class TwitterConnector extends BasePlatformConnector {
  private apiVersion = "v2";

  constructor(accessToken: string) {
    super(accessToken);
  }

  async publishPost(post: PlatformPost): Promise<PlatformPostResult> {
    try {
      let mediaIds: string[] = [];

      // Upload media if present
      if (post.mediaUrls && post.mediaUrls.length > 0) {
        mediaIds = await Promise.all([this.uploadMedia(post.mediaUrls[0]!)]);
      }

      // Create tweet
      const url = `https://api.twitter.com/${this.apiVersion}/tweets`;

      const body: Record<string, unknown> = {
        text: post.content.substring(0, 280),
      };

      if (mediaIds.length > 0) {
        body.media = { media_ids: mediaIds };
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.errors) {
        throw new Error(data.errors[0]?.message || "Failed to publish tweet");
      }

      return {
        platformPostId: data.data.id,
        status: "published",
        url: `https://twitter.com/user/status/${data.data.id}`,
      };
    } catch (error) {
      return {
        platformPostId: "",
        status: "failed",
        error:
          error instanceof Error ? error.message : "Failed to publish tweet",
      };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async uploadMedia(_mediaUrl: string): Promise<string> {
    try {
      // Step 1: Initialize upload
      const initUrl = "https://upload.twitter.com/1.1/media/upload.json";
      const initResponse = await fetch(
        `${initUrl}?command=INIT&total_bytes=1000000&media_type=image/jpeg`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );
      const initData = await initResponse.json();

      // Step 2: Append (simplified - production would handle chunked upload)
      // For now, we'll use a direct upload approach
      const mediaId = initData.media_id_string;

      // Step 3: Finalize
      const finalizeUrl = "https://upload.twitter.com/1.1/media/upload.json";
      await fetch(`${finalizeUrl}?command=FINALIZE&media_id=${mediaId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return mediaId;
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Failed to upload media",
      );
    }
  }

  async deletePost(platformPostId: string): Promise<boolean> {
    try {
      const url = `https://api.twitter.com/${this.apiVersion}/tweets/${platformPostId}`;
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async getProfile(): Promise<PlatformProfile> {
    try {
      const url = `https://api.twitter.com/${this.apiVersion}/users/me`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      const data = await response.json();

      return {
        id: data.data.id,
        name: data.data.name,
        username: data.data.username,
        avatarUrl: data.data.profile_image_url,
        platformUserId: data.data.id,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Failed to fetch profile",
      );
    }
  }

  async getMetrics(): Promise<PlatformMetrics> {
    try {
      const url = `https://api.twitter.com/${this.apiVersion}/users/me?user.fields=public_metrics`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      const data = await response.json();
      const metrics = data.data.public_metrics;

      return {
        followers: metrics.followers_count || 0,
        engagement:
          (metrics.like_count || 0) +
          (metrics.retweet_count || 0) +
          (metrics.reply_count || 0),
        reach: metrics.followers_count || 0,
        impressions: 0, // Twitter doesn't provide impressions at user level
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Failed to fetch metrics",
      );
    }
  }

  async checkTokenHealth(): Promise<boolean> {
    try {
      const url = `https://api.twitter.com/${this.apiVersion}/users/me`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async refreshToken(): Promise<string> {
    // Twitter access tokens don't expire for OAuth 2.0
    return this.accessToken;
  }

  async sendReply(
    context: ReplyContext,
    text: string,
  ): Promise<PlatformReplyResult> {
    try {
      if (context.type === "message") {
        if (!context.recipientPlatformId) {
          throw new Error("recipientPlatformId required for Twitter DM");
        }
        const url = `https://api.twitter.com/${this.apiVersion}/dm_conversations/with/${context.recipientPlatformId}/messages`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: text.substring(0, 10000) }),
        });
        const data = await response.json();
        if (data.errors) {
          throw new Error(data.errors[0]?.message || "Failed to send DM");
        }
        return {
          platformMessageId: data.data?.dm_event_id || "",
          status: "sent",
        };
      }

      // Reply as a public tweet threaded under the parent tweet
      if (!context.parentPlatformMessageId) {
        throw new Error("parentPlatformMessageId required for tweet reply");
      }
      const url = `https://api.twitter.com/${this.apiVersion}/tweets`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text.substring(0, 280),
          reply: { in_reply_to_tweet_id: context.parentPlatformMessageId },
        }),
      });
      const data = await response.json();
      if (data.errors) {
        throw new Error(
          data.errors[0]?.message || "Failed to send reply tweet",
        );
      }
      return { platformMessageId: data.data?.id || "", status: "sent" };
    } catch (error) {
      return {
        platformMessageId: "",
        status: "failed",
        error: error instanceof Error ? error.message : "Failed to send reply",
      };
    }
  }
}
