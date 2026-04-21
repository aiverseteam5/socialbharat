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

      // Upload media if present (single media item; Twitter allows up to 4
      // but the current UX passes one URL at a time).
      if (post.mediaUrls && post.mediaUrls.length > 0 && post.mediaUrls[0]) {
        mediaIds = [await this.uploadMedia(post.mediaUrls[0])];
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

  /**
   * Upload media via the Twitter API v2 chunked upload flow:
   * INIT -> APPEND (1 MiB chunks) -> FINALIZE, then poll STATUS when the
   * platform reports async processing (videos/GIFs).
   *
   * Uses the OAuth 2.0 user-context Bearer token already held by the
   * connector. Requires the `media.write` scope on the connected account.
   * Returns the media id to reference in the v2 tweet creation body.
   */
  private async uploadMedia(mediaUrl: string): Promise<string> {
    const uploadEndpoint = "https://api.x.com/2/media/upload";

    const mediaRes = await fetch(mediaUrl);
    if (!mediaRes.ok) {
      throw new Error(
        `Failed to fetch media (${mediaRes.status}) from ${mediaUrl}`,
      );
    }
    const mediaType =
      mediaRes.headers.get("content-type") ?? "application/octet-stream";
    const mediaBuffer = Buffer.from(await mediaRes.arrayBuffer());
    const totalBytes = mediaBuffer.byteLength;
    if (totalBytes === 0) {
      throw new Error("Media file is empty");
    }
    const mediaCategory = TwitterConnector.getMediaCategory(mediaType);

    // INIT
    const initParams = new URLSearchParams({
      command: "INIT",
      total_bytes: String(totalBytes),
      media_type: mediaType,
      media_category: mediaCategory,
    });
    const initRes = await fetch(`${uploadEndpoint}?${initParams.toString()}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    const initData = await initRes.json();
    if (initData.errors) {
      throw new Error(
        initData.errors[0]?.message || "Twitter media INIT failed",
      );
    }
    const mediaId: string | undefined =
      initData.data?.id ?? initData.media_id_string;
    if (!mediaId) {
      throw new Error("Twitter media INIT returned no media id");
    }

    // APPEND chunks (1 MiB each, <5 MiB per chunk per Twitter spec)
    const CHUNK_SIZE = 1024 * 1024;
    for (
      let offset = 0, segmentIndex = 0;
      offset < totalBytes;
      offset += CHUNK_SIZE, segmentIndex++
    ) {
      const end = Math.min(offset + CHUNK_SIZE, totalBytes);
      const chunk = mediaBuffer.subarray(offset, end);
      const form = new FormData();
      form.append("command", "APPEND");
      form.append("media_id", mediaId);
      form.append("segment_index", String(segmentIndex));
      form.append("media", new Blob([chunk], { type: mediaType }));

      const appendRes = await fetch(uploadEndpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.accessToken}` },
        body: form,
      });
      if (!appendRes.ok) {
        const errText = await appendRes.text();
        throw new Error(
          `Twitter media APPEND failed at segment ${segmentIndex}: ${errText}`,
        );
      }
    }

    // FINALIZE
    const finalizeParams = new URLSearchParams({
      command: "FINALIZE",
      media_id: mediaId,
    });
    const finalizeRes = await fetch(
      `${uploadEndpoint}?${finalizeParams.toString()}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${this.accessToken}` },
      },
    );
    const finalizeData = await finalizeRes.json();
    if (finalizeData.errors) {
      throw new Error(
        finalizeData.errors[0]?.message || "Twitter media FINALIZE failed",
      );
    }

    // For video/gif, FINALIZE may return processing_info; poll until ready.
    let processingInfo =
      finalizeData.data?.processing_info ?? finalizeData.processing_info;
    while (
      processingInfo?.state === "pending" ||
      processingInfo?.state === "in_progress"
    ) {
      const waitSecs = processingInfo.check_after_secs ?? 1;
      await new Promise((resolve) => setTimeout(resolve, waitSecs * 1000));
      const statusParams = new URLSearchParams({
        command: "STATUS",
        media_id: mediaId,
      });
      const statusRes = await fetch(
        `${uploadEndpoint}?${statusParams.toString()}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${this.accessToken}` },
        },
      );
      const statusData = await statusRes.json();
      processingInfo =
        statusData.data?.processing_info ?? statusData.processing_info;
    }
    if (processingInfo?.state === "failed") {
      throw new Error(
        processingInfo.error?.message || "Twitter media processing failed",
      );
    }

    return mediaId;
  }

  private static getMediaCategory(mimeType: string): string {
    if (mimeType.startsWith("video/")) return "tweet_video";
    if (mimeType === "image/gif") return "tweet_gif";
    return "tweet_image";
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
