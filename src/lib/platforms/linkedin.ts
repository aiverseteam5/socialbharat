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
 * V3 Phase 3B — LinkedIn connector is stubbed.
 *
 * Reconnection is routed to /settings/channels?error=platform_coming_soon
 * by the corresponding /api/connectors/linkedin/* route.
 */
export class LinkedInConnector extends BasePlatformConnector {
  private personUrn: string;
  private organizationUrn: string;

  constructor(accessToken: string, personUrn: string, organizationUrn: string) {
    super(accessToken);
    this.personUrn = personUrn;
    this.organizationUrn = organizationUrn;
  }

  private unsupported<T>(method: string, fallback: T): Promise<T> {
    logger.warn("Platform not yet supported", { platform: "linkedin", method });
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
      id: this.personUrn || "",
      name: "LinkedIn (coming soon)",
      platformUserId: this.organizationUrn || "",
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
