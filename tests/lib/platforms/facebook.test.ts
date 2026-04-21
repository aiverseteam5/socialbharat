import { describe, it, expect, vi, beforeEach } from "vitest";
import { FacebookConnector } from "@/lib/platforms/facebook";

describe("FacebookConnector", () => {
  let connector: FacebookConnector;

  beforeEach(() => {
    connector = new FacebookConnector("test-token", "test-page-id");
    global.fetch = vi.fn();
  });

  describe("publishPost", () => {
    it("should construct correct API call for text post", async () => {
      const mockResponse = { id: "123_456" };
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await connector.publishPost({
        content: "Test post",
        mediaUrls: [],
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("facebook.com"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Test post"),
        }),
      );
      expect(result).toEqual({
        platformPostId: "123_456",
        status: "published",
        url: expect.stringContaining("facebook.com"),
      });
    });

    it("should pass public media url to Graph API /photos as url param", async () => {
      const publicUrl =
        "https://xxx.supabase.co/storage/v1/object/public/media/org/123.jpg";
      vi.mocked(fetch)
        // 1st call: photos upload (returns media fbid)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: "media-fbid-1" }),
        } as Response)
        // 2nd call: feed post
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: "post-1" }),
        } as Response);

      const result = await connector.publishPost({
        content: "With image",
        mediaUrls: [publicUrl],
      });

      const firstCall = vi.mocked(fetch).mock.calls[0];
      if (!firstCall) throw new Error("fetch was not called");
      expect(firstCall[0]).toEqual(expect.stringContaining("/photos"));
      const firstBody = JSON.parse((firstCall[1] as { body: string }).body) as {
        url: string;
        published: boolean;
      };
      expect(firstBody.url).toBe(publicUrl);
      expect(firstBody.published).toBe(false);
      expect(result.status).toBe("published");
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("API Error"));

      const result = await connector.publishPost({
        content: "Test post",
        mediaUrls: [],
      });

      expect(result).toEqual({
        platformPostId: "",
        status: "failed",
        error: "API Error",
      });
    });
  });

  describe("checkTokenHealth", () => {
    it("should return true for valid token", async () => {
      const mockResponse = { id: "123", name: "Test Page" };
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await connector.checkTokenHealth();

      expect(result).toBe(true);
    });

    it("should return false for invalid token", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Invalid token"));

      const result = await connector.checkTokenHealth();

      expect(result).toBe(false);
    });
  });
});
