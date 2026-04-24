import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

import { middleware } from "@/middleware";
import { updateSession } from "@/lib/supabase/middleware";
import { createServiceClient } from "@/lib/supabase/service";

type MockUser = {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
};
type MockProfile = {
  account_type: "individual" | "team" | null;
  email_verified_at: string | null;
} | null;

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${pathname}`));
}

function setSession(user: MockUser | null) {
  vi.mocked(updateSession).mockResolvedValue({
    response: NextResponse.next(),
    user: user as never,
  });
}

function setProfile(
  profile: MockProfile,
  memberships: Array<{ org_id: string }> = [],
) {
  const usersMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: profile, error: null });
  const usersEq = vi.fn(() => ({ maybeSingle: usersMaybeSingle }));
  const usersSelect = vi.fn(() => ({ eq: usersEq }));

  const orgLimit = vi
    .fn()
    .mockResolvedValue({ data: memberships, error: null });
  const orgEq = vi.fn(() => ({ limit: orgLimit }));
  const orgSelect = vi.fn(() => ({ eq: orgEq }));

  const from = vi.fn((table: string) => {
    if (table === "users") return { select: usersSelect };
    if (table === "org_members") return { select: orgSelect };
    throw new Error(`Unexpected table: ${table}`);
  });

  vi.mocked(createServiceClient).mockReturnValue({ from } as never);
}

const VERIFIED_USER: MockUser = {
  id: "user-1",
  email: "u@example.com",
  email_confirmed_at: "2026-01-01T00:00:00Z",
};

const UNVERIFIED_USER: MockUser = {
  id: "user-2",
  email: "u2@example.com",
  email_confirmed_at: null,
};

describe("middleware redirect decision tree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Case 8: always-public paths
  describe("always-public paths", () => {
    it.each(["/privacy", "/terms", "/data-deletion", "/api/health"])(
      "passes through %s without auth",
      async (path) => {
        setSession(null);
        const res = await middleware(makeRequest(path));
        expect(res.headers.get("location")).toBeNull();
        expect(createServiceClient).not.toHaveBeenCalled();
      },
    );
  });

  // Case 6: api routes (not /api/health, which is case 8)
  describe("API routes", () => {
    it("passes /api/* through without redirect", async () => {
      setSession(null);
      const res = await middleware(makeRequest("/api/posts"));
      expect(res.headers.get("location")).toBeNull();
      expect(createServiceClient).not.toHaveBeenCalled();
    });
  });

  // Case 1: no session + protected path → /login?next=
  describe("unauthenticated access to protected paths", () => {
    it.each([
      "/dashboard",
      "/inbox",
      "/publishing",
      "/settings",
      "/analytics",
      "/media",
      "/listening",
      "/whatsapp",
    ])("redirects %s to /login with next param", async (path) => {
      setSession(null);
      const res = await middleware(makeRequest(path));
      const location = res.headers.get("location");
      expect(location).not.toBeNull();
      const url = new URL(location!);
      expect(url.pathname).toBe("/login");
      expect(url.searchParams.get("next")).toBe(path);
    });

    it("redirects /onboarding to /login with next param", async () => {
      setSession(null);
      const res = await middleware(makeRequest("/onboarding"));
      const url = new URL(res.headers.get("location")!);
      expect(url.pathname).toBe("/login");
      expect(url.searchParams.get("next")).toBe("/onboarding");
    });
  });

  // Case 2: authenticated visiting /login or /register → /dashboard
  describe("authenticated user on auth pages", () => {
    it("redirects /login to /dashboard when session exists", async () => {
      setSession(VERIFIED_USER);
      const res = await middleware(makeRequest("/login"));
      expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
    });

    it("redirects /register to /dashboard when session exists", async () => {
      setSession(VERIFIED_USER);
      const res = await middleware(makeRequest("/register"));
      expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
    });
  });

  // Case 7: marketing paths pass through for both authed + unauthed users
  describe("marketing paths", () => {
    it("passes / through for unauthenticated users", async () => {
      setSession(null);
      const res = await middleware(makeRequest("/"));
      expect(res.headers.get("location")).toBeNull();
    });

    it("passes /pricing through for authenticated users without querying profile", async () => {
      setSession(VERIFIED_USER);
      const res = await middleware(makeRequest("/pricing"));
      expect(res.headers.get("location")).toBeNull();
      expect(createServiceClient).not.toHaveBeenCalled();
    });
  });

  // Case 3: authenticated + email unverified + protected → /verify-email
  describe("unverified email on protected paths", () => {
    it("redirects to /verify-email when email_confirmed_at is null and email_verified_at is null", async () => {
      setSession(UNVERIFIED_USER);
      setProfile({ account_type: "individual", email_verified_at: null });
      const res = await middleware(makeRequest("/dashboard"));
      expect(new URL(res.headers.get("location")!).pathname).toBe(
        "/verify-email",
      );
    });

    it("does NOT redirect to /verify-email when users.email_verified_at is set (even if auth user is unconfirmed)", async () => {
      setSession(UNVERIFIED_USER);
      setProfile({
        account_type: "individual",
        email_verified_at: "2026-01-01T00:00:00Z",
      });
      const res = await middleware(makeRequest("/dashboard"));
      expect(res.headers.get("location")).toBeNull();
    });
  });

  // Case 4: team + no org + protected → /onboarding
  describe("team account without org on protected paths", () => {
    it("redirects team user with no org memberships to /onboarding", async () => {
      setSession(VERIFIED_USER);
      setProfile(
        { account_type: "team", email_verified_at: "2026-01-01T00:00:00Z" },
        [],
      );
      const res = await middleware(makeRequest("/dashboard"));
      expect(new URL(res.headers.get("location")!).pathname).toBe(
        "/onboarding",
      );
    });

    it("passes through when team user has an org", async () => {
      setSession(VERIFIED_USER);
      setProfile(
        { account_type: "team", email_verified_at: "2026-01-01T00:00:00Z" },
        [{ org_id: "org-1" }],
      );
      const res = await middleware(makeRequest("/dashboard"));
      expect(res.headers.get("location")).toBeNull();
    });
  });

  // Case 5: on /onboarding + individual OR has org → /dashboard
  describe("onboarding page bounces", () => {
    it("bounces individual user off /onboarding to /dashboard", async () => {
      setSession(VERIFIED_USER);
      setProfile({
        account_type: "individual",
        email_verified_at: "2026-01-01T00:00:00Z",
      });
      const res = await middleware(makeRequest("/onboarding"));
      expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
    });

    it("bounces team user with org off /onboarding to /dashboard", async () => {
      setSession(VERIFIED_USER);
      setProfile(
        { account_type: "team", email_verified_at: "2026-01-01T00:00:00Z" },
        [{ org_id: "org-1" }],
      );
      const res = await middleware(makeRequest("/onboarding"));
      expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
    });

    it("keeps team user without org on /onboarding (no redirect)", async () => {
      setSession(VERIFIED_USER);
      setProfile(
        { account_type: "team", email_verified_at: "2026-01-01T00:00:00Z" },
        [],
      );
      const res = await middleware(makeRequest("/onboarding"));
      expect(res.headers.get("location")).toBeNull();
    });
  });

  // Individual on protected path — happy path
  describe("individual on protected path happy path", () => {
    it("passes through verified individual on /dashboard", async () => {
      setSession(VERIFIED_USER);
      setProfile({
        account_type: "individual",
        email_verified_at: "2026-01-01T00:00:00Z",
      });
      const res = await middleware(makeRequest("/dashboard"));
      expect(res.headers.get("location")).toBeNull();
    });

    it("passes through verified individual on nested protected path", async () => {
      setSession(VERIFIED_USER);
      setProfile({
        account_type: "individual",
        email_verified_at: "2026-01-01T00:00:00Z",
      });
      const res = await middleware(makeRequest("/inbox/conversation-42"));
      expect(res.headers.get("location")).toBeNull();
    });
  });

  // Missing profile row — default to individual
  describe("missing users row", () => {
    it("defaults missing profile to individual and lets verified user through", async () => {
      setSession(VERIFIED_USER);
      setProfile(null);
      const res = await middleware(makeRequest("/dashboard"));
      expect(res.headers.get("location")).toBeNull();
    });
  });
});
