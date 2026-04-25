import { describe, it, expect, vi, beforeEach } from "vitest";
import { YouTubeConnector } from "@/lib/platforms/youtube";

/**
 * V3 Phase 3B — YouTube connector is stubbed. See twitter.test.ts for the
 * rationale; these tests only assert short-circuit behavior and that no
 * network calls are made.
 */
describe("YouTubeConnector (V3 Phase 3B stub)", () => {
  let connector: YouTubeConnector;

  beforeEach(() => {
    connector = new YouTubeConnector("test-token", "UC-channel-123");
    global.fetch = vi.fn();
  });

  it("publishPost returns 'Platform not yet supported' with no HTTP calls", async () => {
    const result = await connector.publishPost({ content: "hi" });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("Platform not yet supported");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("deletePost returns false", async () => {
    expect(await connector.deletePost("video-1")).toBe(false);
  });

  it("getProfile returns a placeholder profile", async () => {
    const profile = await connector.getProfile();
    expect(profile.name).toContain("coming soon");
  });

  it("getMetrics returns zeros", async () => {
    const metrics = await connector.getMetrics({
      startDate: new Date(),
      endDate: new Date(),
    });
    expect(metrics).toEqual({ followers: 0, engagement: 0, reach: 0 });
  });

  it("checkTokenHealth returns false", async () => {
    expect(await connector.checkTokenHealth()).toBe(false);
  });

  it("refreshToken returns the existing token unchanged", async () => {
    expect(await connector.refreshToken()).toBe("test-token");
  });
});
