import { describe, it, expect, vi, beforeEach } from "vitest";
import { TwitterConnector } from "@/lib/platforms/twitter";

describe("TwitterConnector media upload", () => {
  let connector: TwitterConnector;

  beforeEach(() => {
    connector = new TwitterConnector("test-token");
    global.fetch = vi.fn();
  });

  it("runs INIT → APPEND → FINALIZE with real byte size, then posts tweet with media_id", async () => {
    // 2.5 MiB of bytes → forces 3 APPEND segments at 1 MiB each
    const totalBytes = Math.floor(2.5 * 1024 * 1024);
    const mediaBytes = new Uint8Array(totalBytes);

    vi.mocked(fetch)
      // 1. fetch the media from Supabase public URL
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "image/jpeg" }),
        arrayBuffer: async () => mediaBytes.buffer,
      } as unknown as Response)
      // 2. INIT
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: "media-xyz" } }),
      } as Response)
      // 3. APPEND segment 0
      .mockResolvedValueOnce({ ok: true, text: async () => "" } as Response)
      // 4. APPEND segment 1
      .mockResolvedValueOnce({ ok: true, text: async () => "" } as Response)
      // 5. APPEND segment 2
      .mockResolvedValueOnce({ ok: true, text: async () => "" } as Response)
      // 6. FINALIZE — no processing_info = ready immediately
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: "media-xyz" } }),
      } as Response)
      // 7. POST tweet
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: "tweet-1" } }),
      } as Response);

    const result = await connector.publishPost({
      content: "With media",
      mediaUrls: [
        "https://xxx.supabase.co/storage/v1/object/public/media/org/1.jpg",
      ],
    });

    expect(result.status).toBe("published");
    expect(result.platformPostId).toBe("tweet-1");

    const calls = vi.mocked(fetch).mock.calls;

    // INIT call carries real total_bytes, not the hardcoded 1000000
    const initCall = calls[1];
    if (!initCall) throw new Error("INIT call missing");
    const initUrl = String(initCall[0]);
    expect(initUrl).toContain("https://api.x.com/2/media/upload");
    expect(initUrl).toContain("command=INIT");
    expect(initUrl).toContain(`total_bytes=${totalBytes}`);
    expect(initUrl).toContain("media_type=image%2Fjpeg");
    expect(initUrl).toContain("media_category=tweet_image");

    // Three APPEND calls with incrementing segment_index
    for (let i = 0; i < 3; i++) {
      const appendCall = calls[2 + i];
      if (!appendCall) throw new Error(`APPEND call ${i} missing`);
      expect(String(appendCall[0])).toBe("https://api.x.com/2/media/upload");
      const init = appendCall[1] as { method: string; body: FormData };
      expect(init.method).toBe("POST");
      expect(init.body.get("command")).toBe("APPEND");
      expect(init.body.get("media_id")).toBe("media-xyz");
      expect(init.body.get("segment_index")).toBe(String(i));
      expect(init.body.get("media")).toBeInstanceOf(Blob);
    }

    // FINALIZE
    const finalizeCall = calls[5];
    if (!finalizeCall) throw new Error("FINALIZE call missing");
    expect(String(finalizeCall[0])).toContain("command=FINALIZE");
    expect(String(finalizeCall[0])).toContain("media_id=media-xyz");

    // Tweet body references the returned media id
    const tweetCall = calls[6];
    if (!tweetCall) throw new Error("tweet call missing");
    const tweetBody = JSON.parse((tweetCall[1] as { body: string }).body) as {
      text: string;
      media: { media_ids: string[] };
    };
    expect(tweetBody.media.media_ids).toEqual(["media-xyz"]);
  });

  it("polls STATUS until processing completes for videos", async () => {
    const videoBytes = new Uint8Array(500); // tiny single-chunk video

    vi.mocked(fetch)
      // fetch media
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "video/mp4" }),
        arrayBuffer: async () => videoBytes.buffer,
      } as unknown as Response)
      // INIT
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: "vid-1" } }),
      } as Response)
      // single APPEND
      .mockResolvedValueOnce({ ok: true, text: async () => "" } as Response)
      // FINALIZE — pending
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: "vid-1",
            processing_info: { state: "in_progress", check_after_secs: 0 },
          },
        }),
      } as Response)
      // STATUS poll 1 — still pending
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: "vid-1",
            processing_info: { state: "pending", check_after_secs: 0 },
          },
        }),
      } as Response)
      // STATUS poll 2 — succeeded
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: "vid-1",
            processing_info: { state: "succeeded" },
          },
        }),
      } as Response)
      // POST tweet
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: "tweet-2" } }),
      } as Response);

    const result = await connector.publishPost({
      content: "Video post",
      mediaUrls: ["https://example.com/video.mp4"],
    });

    expect(result.status).toBe("published");
    expect(result.platformPostId).toBe("tweet-2");

    const calls = vi.mocked(fetch).mock.calls;
    // INIT declared tweet_video category
    expect(String(calls[1]![0])).toContain("media_category=tweet_video");
    // Two STATUS requests (before success)
    expect(String(calls[4]![0])).toContain("command=STATUS");
    expect(String(calls[5]![0])).toContain("command=STATUS");
  });

  it("fails the post when media fetch fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const result = await connector.publishPost({
      content: "With broken media",
      mediaUrls: ["https://example.com/missing.jpg"],
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("404");
  });
});
