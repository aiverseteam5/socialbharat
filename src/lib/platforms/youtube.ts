import {
  BasePlatformConnector,
  PlatformPost,
  PlatformMetrics,
  DateRange,
  PlatformProfile,
  PlatformPostResult,
} from "./base";
import { logger } from "@/lib/logger";

/**
 * V3 Phase 3B — YouTube connector is stubbed.
 *
 * Reconnection is routed to /settings/channels?error=platform_coming_soon
 * by the corresponding /api/connectors/youtube/* route.
 */
export class YouTubeConnector extends BasePlatformConnector {
  private channelId: string;

  constructor(accessToken: string, channelId: string) {
    super(accessToken);
    this.channelId = channelId;
  }

  private unsupported<T>(method: string, fallback: T): Promise<T> {
    logger.warn("Platform not yet supported", { platform: "youtube", method });
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
      id: this.channelId || "",
      name: "YouTube (coming soon)",
      platformUserId: this.channelId || "",
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
}
