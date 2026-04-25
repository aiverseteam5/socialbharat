import {
  BasePlatformConnector,
  PlatformPost,
  PlatformMetrics,
  DateRange,
  PlatformProfile,
  PlatformPostResult,
  ReplyContext,
  PlatformReplyResult,
} from "./base";
import { logger } from "@/lib/logger";

/**
 * V3 Phase 3B — Twitter/X connector is stubbed.
 *
 * Meta family (Facebook, Instagram, WhatsApp) is the only fully-supported
 * connector set in V3. Twitter/LinkedIn/YouTube publish paths short-circuit
 * so the UI doesn't break when accounts are still present in the DB.
 *
 * Reconnection is routed to /settings/channels?error=platform_coming_soon
 * by the corresponding /api/connectors/twitter/* route.
 */
export class TwitterConnector extends BasePlatformConnector {
  constructor(accessToken: string) {
    super(accessToken);
  }

  private unsupported<T>(method: string, fallback: T): Promise<T> {
    logger.warn("Platform not yet supported", { platform: "twitter", method });
    return Promise.resolve(fallback);
  }

  async publishPost(post: PlatformPost): Promise<PlatformPostResult> {
    void post;
    return this.unsupported("publishPost", {
      platformPostId: "",
      status: "failed",
      error: "Platform not yet supported",
    });
  }

  async deletePost(platformPostId: string): Promise<boolean> {
    void platformPostId;
    return this.unsupported("deletePost", false);
  }

  async getProfile(): Promise<PlatformProfile> {
    return this.unsupported("getProfile", {
      id: "",
      name: "Twitter (coming soon)",
      platformUserId: "",
    });
  }

  async getMetrics(dateRange: DateRange): Promise<PlatformMetrics> {
    void dateRange;
    return this.unsupported("getMetrics", {
      followers: 0,
      engagement: 0,
      reach: 0,
    });
  }

  async checkTokenHealth(): Promise<boolean> {
    return this.unsupported("checkTokenHealth", false);
  }

  async refreshToken(): Promise<string> {
    return this.unsupported("refreshToken", this.accessToken);
  }

  async sendReply(
    context: ReplyContext,
    text: string,
    mediaUrls?: string[],
  ): Promise<PlatformReplyResult> {
    void context;
    void text;
    void mediaUrls;
    return this.unsupported("sendReply", {
      platformMessageId: "",
      status: "failed",
      error: "Platform not yet supported",
    });
  }
}
