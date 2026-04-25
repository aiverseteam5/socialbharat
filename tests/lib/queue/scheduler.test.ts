import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * V3 Phase 3B — scheduler tests.
 *
 * ioredis-mock doesn't ship Redis' `cmsgpack` Lua module that BullMQ's
 * scripts depend on, so we mock the queue layer directly. This isolates
 * the unit under test (delay math, job-id format, validation, cancel
 * semantics) from BullMQ's Redis plumbing.
 */

const publishAddMock = vi.fn();
const publishGetJobMock = vi.fn();
const tokenRefreshAddMock = vi.fn();

vi.mock("@/lib/queue/queues", () => ({
  publishQueue: () => ({
    add: publishAddMock,
    getJob: publishGetJobMock,
  }),
  tokenRefreshQueue: () => ({
    add: tokenRefreshAddMock,
  }),
}));

import {
  SchedulerValidationError,
  cancelScheduledPost,
  schedulePost,
  scheduleTokenRefresh,
  triggerScheduledPostSweep,
} from "@/lib/queue/scheduler";

describe("queue scheduler (V3 Phase 3B)", () => {
  beforeEach(() => {
    publishAddMock.mockReset();
    publishGetJobMock.mockReset();
    tokenRefreshAddMock.mockReset();
  });

  describe("schedulePost", () => {
    it("rejects a non-Date scheduledAt with SchedulerValidationError", async () => {
      await expect(
        schedulePost({
          postId: "p1",
          orgId: "o1",
          scheduledAt: new Date("not a date"),
        }),
      ).rejects.toBeInstanceOf(SchedulerValidationError);
      expect(publishAddMock).not.toHaveBeenCalled();
    });

    it("rejects a past scheduledAt with SchedulerValidationError", async () => {
      await expect(
        schedulePost({
          postId: "p1",
          orgId: "o1",
          scheduledAt: new Date(Date.now() - 60_000),
        }),
      ).rejects.toBeInstanceOf(SchedulerValidationError);
      expect(publishAddMock).not.toHaveBeenCalled();
    });

    it("enqueues a delayed publish job and returns the job id", async () => {
      publishAddMock.mockResolvedValueOnce({ id: "post-post-123" });

      const scheduledAt = new Date(Date.now() + 10 * 60_000); // +10 min
      const jobId = await schedulePost({
        postId: "post-123",
        orgId: "org-abc",
        scheduledAt,
      });

      expect(jobId).toBe("post-post-123");
      expect(publishAddMock).toHaveBeenCalledTimes(1);

      const [name, data, opts] = publishAddMock.mock.calls[0]!;
      expect(name).toBe("publish");
      expect(data).toEqual({
        postId: "post-123",
        orgId: "org-abc",
        kind: "publish",
      });
      expect(opts.jobId).toBe("post-post-123");
      expect(opts.delay).toBeGreaterThan(9 * 60_000);
      expect(opts.delay).toBeLessThanOrEqual(10 * 60_000);
    });

    it("throws when BullMQ returns a job with no id", async () => {
      publishAddMock.mockResolvedValueOnce({ id: undefined });

      await expect(
        schedulePost({
          postId: "oops",
          orgId: "o",
          scheduledAt: new Date(Date.now() + 60_000),
        }),
      ).rejects.toThrow(/did not return a job id/);
    });
  });

  describe("cancelScheduledPost", () => {
    it("removes an existing delayed job", async () => {
      const removeMock = vi.fn().mockResolvedValue(undefined);
      publishGetJobMock.mockResolvedValueOnce({ remove: removeMock });

      await cancelScheduledPost("post-abc");

      expect(publishGetJobMock).toHaveBeenCalledWith("post-abc");
      expect(removeMock).toHaveBeenCalledTimes(1);
    });

    it("is a no-op when the job is not found", async () => {
      publishGetJobMock.mockResolvedValueOnce(undefined);

      await expect(
        cancelScheduledPost("post-missing"),
      ).resolves.toBeUndefined();
    });

    it("swallows errors so callers never throw mid-reschedule", async () => {
      publishGetJobMock.mockRejectedValueOnce(new Error("redis down"));

      await expect(cancelScheduledPost("post-boom")).resolves.toBeUndefined();
    });
  });

  describe("scheduleTokenRefresh", () => {
    it("enqueues with a ~48h delay when expiresAt is far out", async () => {
      tokenRefreshAddMock.mockResolvedValueOnce({ id: "token-prof-1" });

      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const jobId = await scheduleTokenRefresh({
        profileId: "prof-1",
        orgId: "o",
        expiresAt,
      });

      expect(jobId).toBe("token-prof-1");
      const [, data, opts] = tokenRefreshAddMock.mock.calls[0]!;
      expect(data).toEqual({
        profileId: "prof-1",
        orgId: "o",
        kind: "refresh-one",
      });
      expect(opts.jobId).toBe("token-prof-1");
      expect(opts.delay).toBeGreaterThan(47 * 60 * 60 * 1000);
    });

    it("enqueues without delay when expiresAt is inside the 24h buffer", async () => {
      tokenRefreshAddMock.mockResolvedValueOnce({ id: "token-prof-2" });

      const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
      await scheduleTokenRefresh({
        profileId: "prof-2",
        orgId: "o",
        expiresAt,
      });

      const [, , opts] = tokenRefreshAddMock.mock.calls[0]!;
      expect(opts.delay).toBeUndefined();
    });
  });

  describe("triggerScheduledPostSweep", () => {
    it("enqueues a check-scheduled job with a minute-bucket id", async () => {
      publishAddMock.mockResolvedValueOnce({ id: "sweep-12345" });

      const jobId = await triggerScheduledPostSweep();

      expect(jobId).toBe("sweep-12345");
      const [name, data, opts] = publishAddMock.mock.calls[0]!;
      expect(name).toBe("check-scheduled");
      expect(data.kind).toBe("check-scheduled");
      expect(opts.jobId).toMatch(/^sweep-\d+$/);
    });
  });
});
