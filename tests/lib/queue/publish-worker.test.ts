import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Job } from "bullmq";

import type { PublishJobData } from "@/lib/queue/queues";

/**
 * V3 Phase 3B — publish worker tests.
 *
 * We exercise `handlePublishJob` directly. Supabase, encryption, platform
 * connectors, and the notification queue are mocked so the test doesn't
 * need a live Redis or Postgres.
 */

const postsUpdateMock = vi.fn((_values: unknown) => {
  void _values;
  return { eq: eqMock };
});
const eqMock = vi.fn(() => Promise.resolve({ error: null }));

let postRow: Record<string, unknown> | null = null;
let profileRows: Array<Record<string, unknown>> = [];

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => {
    const from = (table: string) => {
      if (table === "posts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: postRow,
                    error: postRow ? null : { message: "not found" },
                  }),
              }),
            }),
          }),
          update: (values: unknown) => {
            postsUpdateMock(values);
            return { eq: eqMock };
          },
        };
      }
      if (table === "social_profiles") {
        return {
          select: () => ({
            eq: () => ({
              in: () => Promise.resolve({ data: profileRows, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    };
    return { from };
  },
}));

vi.mock("@/lib/encryption", () => ({
  decrypt: (s: string) => `decrypted:${s}`,
}));

const publishPostMock = vi.fn();
vi.mock("@/lib/platforms", () => ({
  getPlatformConnector: () => ({
    publishPost: publishPostMock,
  }),
}));

vi.mock("@/lib/scheduler", () => ({
  processScheduledPosts: vi.fn(() =>
    Promise.resolve({ processed: 1, succeeded: 1, failed: 0 }),
  ),
}));

const notificationAddMock = vi.fn();
vi.mock("@/lib/queue/queues", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/queue/queues")>(
      "@/lib/queue/queues",
    );
  return {
    ...actual,
    notificationQueue: () => ({ add: notificationAddMock }),
  };
});

import { handlePublishJob } from "@/lib/queue/workers/publish-worker";
import { processScheduledPosts } from "@/lib/scheduler";

function makeJob(data: PublishJobData): Job<PublishJobData> {
  return { id: "j1", data } as unknown as Job<PublishJobData>;
}

describe("publish-worker", () => {
  beforeEach(() => {
    postsUpdateMock.mockClear();
    eqMock.mockClear();
    publishPostMock.mockReset();
    notificationAddMock.mockReset();
    notificationAddMock.mockResolvedValue({ id: "notif-1" });

    postRow = {
      id: "post-1",
      org_id: "org-1",
      status: "scheduled",
      content: "hello",
      content_json: {},
      media_urls: [],
      platforms: ["profile-1"],
    };
    profileRows = [
      {
        id: "profile-1",
        org_id: "org-1",
        platform: "facebook",
        platform_user_id: "page-1",
        access_token_encrypted: "cipher",
        metadata: {},
      },
    ];
  });

  it("throws when publish job is missing postId/orgId", async () => {
    await expect(
      handlePublishJob(makeJob({ postId: "", orgId: "", kind: "publish" })),
    ).rejects.toThrow(/missing postId\/orgId/);
  });

  it("check-scheduled kind delegates to processScheduledPosts", async () => {
    await handlePublishJob(
      makeJob({ postId: "", orgId: "", kind: "check-scheduled" }),
    );
    expect(processScheduledPosts).toHaveBeenCalledTimes(1);
    expect(postsUpdateMock).not.toHaveBeenCalled();
  });

  it("marks a post published when all platforms succeed, and enqueues a notification", async () => {
    publishPostMock.mockResolvedValueOnce({
      platformPostId: "fb-1",
      status: "published",
      url: "https://fb.example/1",
    });

    await handlePublishJob(
      makeJob({ postId: "post-1", orgId: "org-1", kind: "publish" }),
    );

    expect(postsUpdateMock).toHaveBeenCalledTimes(1);
    const updateArgs = postsUpdateMock.mock.calls[0]![0] as {
      status: string;
      publish_results: Record<string, { status: string }>;
    };
    expect(updateArgs.status).toBe("published");
    expect(updateArgs.publish_results["profile-1"]!.status).toBe("published");

    expect(notificationAddMock).toHaveBeenCalledTimes(1);
    const [, notifData] = notificationAddMock.mock.calls[0]!;
    expect(notifData.type).toBe("post_published");
  });

  it("marks a post failed and enqueues a failure notification when all platforms fail", async () => {
    publishPostMock.mockResolvedValueOnce({
      platformPostId: "",
      status: "failed",
      error: "boom",
    });

    await handlePublishJob(
      makeJob({ postId: "post-1", orgId: "org-1", kind: "publish" }),
    );

    const updateArgs = postsUpdateMock.mock.calls[0]![0] as {
      status: string;
      error_message: string | null;
    };
    expect(updateArgs.status).toBe("failed");
    expect(updateArgs.error_message).toBe("All platforms failed");

    const [, notifData] = notificationAddMock.mock.calls[0]!;
    expect(notifData.type).toBe("post_failed");
  });

  it("skips re-publishing a post already in a terminal state", async () => {
    postRow = { ...postRow!, status: "published" };

    await handlePublishJob(
      makeJob({ postId: "post-1", orgId: "org-1", kind: "publish" }),
    );

    expect(publishPostMock).not.toHaveBeenCalled();
    expect(postsUpdateMock).not.toHaveBeenCalled();
  });

  it("marks post failed when no connected profiles match", async () => {
    profileRows = [];

    await handlePublishJob(
      makeJob({ postId: "post-1", orgId: "org-1", kind: "publish" }),
    );

    const updateArgs = postsUpdateMock.mock.calls[0]![0] as {
      status: string;
      error_message: string;
    };
    expect(updateArgs.status).toBe("failed");
    expect(updateArgs.error_message).toMatch(/No connected profiles/);
  });
});
