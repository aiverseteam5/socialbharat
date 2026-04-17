import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPlanLimits,
  checkPlanLimit,
  checkNumericLimit,
  canAddSocialProfile,
  canAddUser,
  canCreatePost,
  canSchedulePost,
} from "@/lib/plan-limits";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

type FetchResult = { data?: unknown; count?: number; error?: null };

/**
 * Build a fluent Supabase-style mock. The returned `client` has only
 * `.from()` — NOT thenable (otherwise `await createClient()` would unwrap
 * it). `.from()` returns a fresh query chain. Chain methods return the
 * chain; `.single()` and the thenable resolve to the next queued result.
 */
function buildClientMock(results: FetchResult[]): {
  client: unknown;
  update: ReturnType<typeof vi.fn>;
} {
  let idx = 0;
  const next = () => results[idx++] ?? { data: null, count: 0, error: null };
  const update = vi.fn().mockReturnValue({ eq: vi.fn() });
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve(next()));
  chain.then = (resolve: (v: FetchResult) => unknown) => resolve(next());
  chain.update = update;
  const client = { from: vi.fn(() => chain) };
  return { client, update };
}

describe("Plan Limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPlanLimits", () => {
    it("returns plan limits for free plan", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { client } = buildClientMock([
        { data: { plan: "free", plan_expires_at: null }, error: null },
        {
          data: {
            max_social_profiles: 3,
            max_users: 1,
            max_posts_per_month: 30,
            max_scheduled_posts: 10,
            ai_content_generation: false,
            social_listening: false,
            custom_reports: false,
            approval_workflows: false,
            whatsapp_inbox: false,
            api_access: false,
          },
          error: null,
        },
      ]);
      vi.mocked(createClient).mockResolvedValue(client as SupabaseClient);

      const limits = await getPlanLimits("org-123");
      expect(limits).toEqual({
        maxSocialProfiles: 3,
        maxUsers: 1,
        maxPostsPerMonth: 30,
        maxScheduledPosts: 10,
        aiContentGeneration: false,
        socialListening: false,
        customReports: false,
        approvalWorkflows: false,
        whatsappInbox: false,
        apiAccess: false,
      });
    });

    it("returns plan limits for pro plan", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { client } = buildClientMock([
        { data: { plan: "pro", plan_expires_at: null }, error: null },
        {
          data: {
            max_social_profiles: 15,
            max_users: 5,
            max_posts_per_month: 1000,
            max_scheduled_posts: 500,
            ai_content_generation: true,
            social_listening: true,
            custom_reports: false,
            approval_workflows: true,
            whatsapp_inbox: true,
            api_access: false,
          },
          error: null,
        },
      ]);
      vi.mocked(createClient).mockResolvedValue(client as SupabaseClient);

      const limits = await getPlanLimits("org-123");
      expect(limits?.aiContentGeneration).toBe(true);
      expect(limits?.socialListening).toBe(true);
      expect(limits?.approvalWorkflows).toBe(true);
    });

    it("downgrades expired plan to free", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const expiredDate = new Date(Date.now() - 10000).toISOString();
      const { client, update } = buildClientMock([
        { data: { plan: "pro", plan_expires_at: expiredDate }, error: null },
        {
          data: {
            max_social_profiles: 3,
            max_users: 1,
            max_posts_per_month: 30,
            max_scheduled_posts: 10,
            ai_content_generation: false,
            social_listening: false,
            custom_reports: false,
            approval_workflows: false,
            whatsapp_inbox: false,
            api_access: false,
          },
          error: null,
        },
      ]);
      vi.mocked(createClient).mockResolvedValue(client as SupabaseClient);

      const limits = await getPlanLimits("org-123");
      expect(update).toHaveBeenCalledWith({
        plan: "free",
        plan_expires_at: null,
      });
      expect(limits?.aiContentGeneration).toBe(false);
    });

    it("returns null when organization row missing", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { client } = buildClientMock([{ data: null, error: null }]);
      vi.mocked(createClient).mockResolvedValue(client as SupabaseClient);
      const limits = await getPlanLimits("org-missing");
      expect(limits).toBeNull();
    });

    it("returns null when plan_limits row missing", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { client } = buildClientMock([
        { data: { plan: "mystery", plan_expires_at: null }, error: null },
        { data: null, error: null },
      ]);
      vi.mocked(createClient).mockResolvedValue(client as SupabaseClient);
      const limits = await getPlanLimits("org-123");
      expect(limits).toBeNull();
    });
  });

  describe("checkPlanLimit", () => {
    async function seedProLimits() {
      const { createClient } = await import("@/lib/supabase/server");
      const { client } = buildClientMock([
        { data: { plan: "pro", plan_expires_at: null }, error: null },
        {
          data: {
            max_social_profiles: 15,
            max_users: 5,
            max_posts_per_month: 1000,
            max_scheduled_posts: 500,
            ai_content_generation: true,
            social_listening: true,
            custom_reports: false,
            approval_workflows: true,
            whatsapp_inbox: true,
            api_access: false,
          },
          error: null,
        },
      ]);
      vi.mocked(createClient).mockResolvedValue(client as SupabaseClient);
    }

    it("returns false for AI features on free plan", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { client } = buildClientMock([
        { data: { plan: "free", plan_expires_at: null }, error: null },
        { data: { ai_content_generation: false }, error: null },
      ]);
      vi.mocked(createClient).mockResolvedValue(client as SupabaseClient);
      const result = await checkPlanLimit("org-123", "ai_content_generation");
      expect(result).toBe(false);
    });

    it("returns true for AI on pro plan", async () => {
      await seedProLimits();
      const result = await checkPlanLimit("org-123", "ai_content_generation");
      expect(result).toBe(true);
    });

    it("returns true for social_listening on pro plan", async () => {
      await seedProLimits();
      expect(await checkPlanLimit("org-123", "social_listening")).toBe(true);
    });

    it("returns false for custom_reports on pro plan", async () => {
      await seedProLimits();
      expect(await checkPlanLimit("org-123", "custom_reports")).toBe(false);
    });

    it("returns true for whatsapp_inbox on pro plan", async () => {
      await seedProLimits();
      expect(await checkPlanLimit("org-123", "whatsapp_inbox")).toBe(true);
    });

    it("returns true for approval_workflows on pro plan", async () => {
      await seedProLimits();
      expect(await checkPlanLimit("org-123", "approval_workflows")).toBe(true);
    });

    it("returns false for api_access on pro plan", async () => {
      await seedProLimits();
      expect(await checkPlanLimit("org-123", "api_access")).toBe(false);
    });

    it("returns false when org missing", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { client } = buildClientMock([{ data: null, error: null }]);
      vi.mocked(createClient).mockResolvedValue(client as SupabaseClient);
      expect(await checkPlanLimit("org-missing", "ai_content_generation")).toBe(
        false,
      );
    });
  });

  describe("checkNumericLimit + helpers", () => {
    const freePlanRow = {
      max_social_profiles: 3,
      max_users: 1,
      max_posts_per_month: 30,
      max_scheduled_posts: 10,
      ai_content_generation: false,
      social_listening: false,
      custom_reports: false,
      approval_workflows: false,
      whatsapp_inbox: false,
      api_access: false,
    };

    async function withCount(count: number) {
      const { createClient } = await import("@/lib/supabase/server");
      const { client } = buildClientMock([
        { data: { plan: "free", plan_expires_at: null }, error: null },
        { data: freePlanRow, error: null },
        { count, error: null },
      ]);
      vi.mocked(createClient).mockResolvedValue(client as SupabaseClient);
    }

    it("max_social_profiles allowed when below cap", async () => {
      await withCount(1);
      const r = await checkNumericLimit("org-1", "max_social_profiles");
      expect(r).toEqual({ allowed: true, current: 1, max: 3 });
    });

    it("max_social_profiles denied at cap", async () => {
      await withCount(3);
      const r = await checkNumericLimit("org-1", "max_social_profiles");
      expect(r.allowed).toBe(false);
    });

    it("max_users returns current/max", async () => {
      await withCount(0);
      const r = await checkNumericLimit("org-1", "max_users");
      expect(r).toEqual({ allowed: true, current: 0, max: 1 });
    });

    it("max_posts_per_month counts current month", async () => {
      await withCount(5);
      const r = await checkNumericLimit("org-1", "max_posts_per_month");
      expect(r).toEqual({ allowed: true, current: 5, max: 30 });
    });

    it("max_scheduled_posts counts scheduled status", async () => {
      await withCount(2);
      const r = await checkNumericLimit("org-1", "max_scheduled_posts");
      expect(r).toEqual({ allowed: true, current: 2, max: 10 });
    });

    it("returns disallowed when org has no plan", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { client } = buildClientMock([{ data: null, error: null }]);
      vi.mocked(createClient).mockResolvedValue(client as SupabaseClient);
      const r = await checkNumericLimit("missing", "max_social_profiles");
      expect(r).toEqual({ allowed: false, current: 0, max: 0 });
    });

    it("treats -1 as unlimited", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const unlimitedRow = {
        ...freePlanRow,
        max_social_profiles: -1,
        max_users: -1,
        max_posts_per_month: -1,
        max_scheduled_posts: -1,
      };
      const { client } = buildClientMock([
        { data: { plan: "enterprise", plan_expires_at: null }, error: null },
        { data: unlimitedRow, error: null },
        { count: 9999, error: null },
      ]);
      vi.mocked(createClient).mockResolvedValue(client as SupabaseClient);
      const r = await checkNumericLimit("ent", "max_social_profiles");
      expect(r.allowed).toBe(true);
      expect(r.max).toBeNull();
    });

    it("canAddSocialProfile delegates to checkNumericLimit", async () => {
      await withCount(1);
      expect(await canAddSocialProfile("org-1")).toBe(true);
    });

    it("canAddUser returns false at cap", async () => {
      await withCount(1);
      expect(await canAddUser("org-1")).toBe(false);
    });

    it("canCreatePost returns true below cap", async () => {
      await withCount(10);
      expect(await canCreatePost("org-1")).toBe(true);
    });

    it("canSchedulePost returns true below cap", async () => {
      await withCount(3);
      expect(await canSchedulePost("org-1")).toBe(true);
    });
  });
});
