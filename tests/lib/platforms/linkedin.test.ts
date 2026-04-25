import { describe, it, expect, vi, beforeEach } from "vitest";
import { LinkedInConnector } from "@/lib/platforms/linkedin";

/**
 * V3 Phase 3B — LinkedIn connector is stubbed. See twitter.test.ts for the
 * rationale; these tests only assert short-circuit behavior and that no
 * network calls are made.
 */
describe("LinkedInConnector (V3 Phase 3B stub)", () => {
  let connector: LinkedInConnector;

  beforeEach(() => {
    connector = new LinkedInConnector(
      "test-token",
      "urn:li:person:abc",
      "urn:li:organization:xyz",
    );
    global.fetch = vi.fn();
  });

  it("publishPost returns 'Platform not yet supported' with no HTTP calls", async () => {
    const result = await connector.publishPost({ content: "hi" });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("Platform not yet supported");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("deletePost returns false", async () => {
    expect(await connector.deletePost("share-1")).toBe(false);
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
