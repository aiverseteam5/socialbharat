import { describe, it, expect, vi, beforeEach } from "vitest";
import { TwitterConnector } from "@/lib/platforms/twitter";

/**
 * V3 Phase 3B — Twitter connector is stubbed. These tests verify that all
 * entry points short-circuit with "Platform not yet supported" and never
 * make HTTP calls, so the UI can safely still reference TwitterConnector
 * while the real implementation is deferred.
 */
describe("TwitterConnector (V3 Phase 3B stub)", () => {
  let connector: TwitterConnector;

  beforeEach(() => {
    connector = new TwitterConnector("test-token");
    global.fetch = vi.fn();
  });

  it("publishPost returns 'Platform not yet supported' and makes no HTTP calls", async () => {
    const result = await connector.publishPost({ content: "hi" });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("Platform not yet supported");
    expect(result.platformPostId).toBe("");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("deletePost returns false without hitting the network", async () => {
    const ok = await connector.deletePost("tweet-1");
    expect(ok).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("getProfile returns a placeholder profile", async () => {
    const profile = await connector.getProfile();
    expect(profile.name).toContain("coming soon");
    expect(global.fetch).not.toHaveBeenCalled();
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

  it("sendReply short-circuits with 'not supported'", async () => {
    const result = await connector.sendReply({ type: "message" }, "hello");
    expect(result.status).toBe("failed");
    expect(result.error).toBe("Platform not yet supported");
  });
});
