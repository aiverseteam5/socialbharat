import { describe, it, expect, vi, beforeEach } from "vitest";
import { InstagramConnector } from "@/lib/platforms/instagram";

describe("InstagramConnector", () => {
  let connector: InstagramConnector;

  beforeEach(() => {
    connector = new InstagramConnector("test-token", "ig-business-id");
    global.fetch = vi.fn();
  });

  it("passes public image URL to /media container as image_url", async () => {
    const publicUrl =
      "https://xxx.supabase.co/storage/v1/object/public/media/org/456.png";

    vi.mocked(fetch)
      // 1: create container
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "container-1" }),
      } as Response)
      // 2: publish container
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "ig-post-1" }),
      } as Response);

    const result = await connector.publishPost({
      content: "Diwali greetings",
      mediaUrls: [publicUrl],
    });

    const firstCall = vi.mocked(fetch).mock.calls[0];
    if (!firstCall) throw new Error("fetch was not called");
    expect(firstCall[0]).toEqual(expect.stringContaining("/media"));
    const body = JSON.parse((firstCall[1] as { body: string }).body) as {
      image_url: string;
      caption: string;
    };
    expect(body.image_url).toBe(publicUrl);
    expect(body.caption).toBe("Diwali greetings");
    expect(result.status).toBe("published");
    expect(result.platformPostId).toBe("ig-post-1");
  });

  it("fails fast when no media URL is provided", async () => {
    const result = await connector.publishPost({
      content: "Text only",
      mediaUrls: [],
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("at least one media URL");
  });
});
