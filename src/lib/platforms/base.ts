/**
 * Base interface for all social platform connectors
 * Each platform implements these methods with platform-specific logic
 */

export interface PlatformPost {
  content: string;
  mediaUrls?: string[];
  scheduledAt?: Date;
}

export interface PlatformMetrics {
  followers: number;
  engagement: number;
  reach: number;
  impressions?: number;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface PlatformProfile {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  platformUserId: string;
}

export interface PlatformPostResult {
  platformPostId: string;
  url?: string;
  status: "published" | "failed";
  error?: string;
}

/**
 * Reply context for inbox reply sending.
 * `type` mirrors `conversations.type` in the DB.
 */
export interface ReplyContext {
  type: "message" | "comment" | "mention" | "review";
  /** Platform-specific user id of the recipient (for DMs) */
  recipientPlatformId?: string;
  /** Platform message/comment id being replied to (for threaded comments) */
  parentPlatformMessageId?: string;
  /** Additional platform-specific context (e.g. post id, urns) */
  metadata?: Record<string, unknown>;
}

export interface PlatformReplyResult {
  platformMessageId: string;
  status: "sent" | "failed";
  error?: string;
}

/**
 * Abstract base class for social platform connectors
 * All platform-specific connectors must extend this class
 */
export abstract class BasePlatformConnector {
  protected accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  abstract publishPost(post: PlatformPost): Promise<PlatformPostResult>;
  abstract deletePost(platformPostId: string): Promise<boolean>;
  abstract getProfile(): Promise<PlatformProfile>;
  abstract getMetrics(dateRange: DateRange): Promise<PlatformMetrics>;
  abstract checkTokenHealth(): Promise<boolean>;
  abstract refreshToken(): Promise<string>;

  /**
   * Send a reply in an inbox conversation. Concrete connectors override this
   * for the platforms they support. Default implementation marks the reply as
   * failed with a "not supported" error so the route can record it without
   * throwing.
   */
  async sendReply(
    context: ReplyContext,
    text: string,
    mediaUrls?: string[],
  ): Promise<PlatformReplyResult> {
    void context;
    void text;
    void mediaUrls;
    return {
      platformMessageId: "",
      status: "failed",
      error: "Reply not supported for this platform",
    };
  }
}
