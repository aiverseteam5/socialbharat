import { describe, it, expect, vi } from "vitest";
import { processScheduledPosts } from "@/lib/scheduler";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lte: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
  })),
}));

describe("processScheduledPosts", () => {
  it("should process scheduled posts", async () => {
    const result = await processScheduledPosts();

    expect(result).toEqual({
      processed: 0,
      succeeded: 0,
      failed: 0,
    });
  });
});
