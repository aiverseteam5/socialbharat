import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { GET } from "@/app/api/auth/callback/route";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type AuthUser = {
  id: string;
  email: string;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: { provider?: string };
};

function mockExchangeCode(user: AuthUser | null, error: unknown = null) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: { user },
        error,
      }),
    },
  } as never);
}

type UsersRow = {
  id: string;
  account_type: "individual" | "team";
  email_verified_at: string | null;
} | null;

function mockService({
  existing,
  insertError = null,
  updateError = null,
  memberships = [],
}: {
  existing: UsersRow;
  insertError?: unknown;
  updateError?: unknown;
  memberships?: Array<{ org_id: string }>;
}) {
  const usersMaybeSingle = vi.fn().mockResolvedValue({
    data: existing,
    error: null,
  });
  const usersSelectEq = vi.fn(() => ({ maybeSingle: usersMaybeSingle }));
  const usersSelect = vi.fn(() => ({ eq: usersSelectEq }));

  const usersInsert = vi.fn().mockResolvedValue({ error: insertError });

  const usersUpdateEq = vi.fn().mockResolvedValue({ error: updateError });
  const usersUpdate = vi
    .fn<[Record<string, unknown>], { eq: typeof usersUpdateEq }>()
    .mockImplementation(() => ({ eq: usersUpdateEq }));

  const orgLimit = vi
    .fn()
    .mockResolvedValue({ data: memberships, error: null });
  const orgEq = vi.fn(() => ({ limit: orgLimit }));
  const orgSelect = vi.fn(() => ({ eq: orgEq }));

  const from = vi.fn((table: string) => {
    if (table === "users") {
      return {
        select: usersSelect,
        insert: usersInsert,
        update: usersUpdate,
      };
    }
    if (table === "org_members") {
      return { select: orgSelect };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  vi.mocked(createServiceClient).mockReturnValue({ from } as never);

  return { usersInsert, usersUpdate, usersUpdateEq };
}

function makeReq(url: string): NextRequest {
  return new NextRequest(new URL(url));
}

describe("GET /api/auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /login?error=missing_code when code param is absent", async () => {
    const res = await GET(makeReq("http://localhost:3000/api/auth/callback"));
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("error")).toBe("missing_code");
  });

  it("redirects to /login?error=auth_failed when code exchange fails", async () => {
    mockExchangeCode(null, { message: "invalid code" });
    const res = await GET(
      makeReq("http://localhost:3000/api/auth/callback?code=bad"),
    );
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("error")).toBe("auth_failed");
  });

  it("inserts new user row and redirects to /dashboard for new individual", async () => {
    mockExchangeCode({
      id: "user-new",
      email: "new@example.com",
      email_confirmed_at: "2026-01-01T00:00:00Z",
      user_metadata: { full_name: "New User", avatar_url: "https://avatar" },
      app_metadata: { provider: "google" },
    });
    const { usersInsert } = mockService({ existing: null });

    const res = await GET(
      makeReq("http://localhost:3000/api/auth/callback?code=good"),
    );

    expect(usersInsert).toHaveBeenCalledTimes(1);
    const insertedRow = usersInsert.mock.calls[0][0];
    expect(insertedRow).toMatchObject({
      id: "user-new",
      email: "new@example.com",
      full_name: "New User",
      avatar_url: "https://avatar",
      account_type: "individual",
    });
    expect(insertedRow.email_verified_at).toBeTruthy();

    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/dashboard");
  });

  it("redirects new team user with no org to /onboarding", async () => {
    mockExchangeCode({
      id: "user-team",
      email: "team@example.com",
      email_confirmed_at: "2026-01-01T00:00:00Z",
      user_metadata: { name: "Team User" },
      app_metadata: { provider: "google" },
    });
    const { usersInsert } = mockService({ existing: null, memberships: [] });

    const res = await GET(
      makeReq(
        "http://localhost:3000/api/auth/callback?code=good&account_type=team",
      ),
    );

    expect(usersInsert).toHaveBeenCalledTimes(1);
    expect(usersInsert.mock.calls[0][0].account_type).toBe("team");

    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/onboarding");
  });

  it("does not insert when users row already exists; syncs email_verified_at", async () => {
    mockExchangeCode({
      id: "user-existing",
      email: "existing@example.com",
      email_confirmed_at: "2026-01-01T00:00:00Z",
      user_metadata: {},
      app_metadata: { provider: "email" },
    });
    const { usersInsert, usersUpdate, usersUpdateEq } = mockService({
      existing: {
        id: "user-existing",
        account_type: "individual",
        email_verified_at: null,
      },
    });

    const res = await GET(
      makeReq("http://localhost:3000/api/auth/callback?code=good"),
    );

    expect(usersInsert).not.toHaveBeenCalled();
    expect(usersUpdate).toHaveBeenCalledTimes(1);
    const updatedFields = usersUpdate.mock.calls[0]?.[0];
    expect(updatedFields?.email_verified_at).toBeTruthy();
    expect(usersUpdateEq).toHaveBeenCalledWith("id", "user-existing");

    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/dashboard");
  });

  it("upgrades existing individual to team when account_type=team query is passed", async () => {
    mockExchangeCode({
      id: "user-upgrade",
      email: "upgrade@example.com",
      email_confirmed_at: "2026-01-01T00:00:00Z",
      user_metadata: {},
      app_metadata: { provider: "google" },
    });
    const { usersUpdate } = mockService({
      existing: {
        id: "user-upgrade",
        account_type: "individual",
        email_verified_at: "2026-01-01T00:00:00Z",
      },
      memberships: [],
    });

    const res = await GET(
      makeReq(
        "http://localhost:3000/api/auth/callback?code=good&account_type=team",
      ),
    );

    expect(usersUpdate).toHaveBeenCalledTimes(1);
    const updated = usersUpdate.mock.calls[0]?.[0];
    expect(updated?.account_type).toBe("team");

    // Team without org → /onboarding
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/onboarding");
  });

  it("performs no update when existing verified individual returns", async () => {
    mockExchangeCode({
      id: "user-noop",
      email: "noop@example.com",
      email_confirmed_at: "2026-01-01T00:00:00Z",
      user_metadata: {},
      app_metadata: { provider: "google" },
    });
    const { usersInsert, usersUpdate } = mockService({
      existing: {
        id: "user-noop",
        account_type: "individual",
        email_verified_at: "2025-12-01T00:00:00Z",
      },
    });

    const res = await GET(
      makeReq("http://localhost:3000/api/auth/callback?code=good"),
    );

    expect(usersInsert).not.toHaveBeenCalled();
    expect(usersUpdate).not.toHaveBeenCalled();
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("routes existing team user with org to /dashboard", async () => {
    mockExchangeCode({
      id: "user-team-org",
      email: "t@example.com",
      email_confirmed_at: "2026-01-01T00:00:00Z",
      user_metadata: {},
      app_metadata: { provider: "google" },
    });
    mockService({
      existing: {
        id: "user-team-org",
        account_type: "team",
        email_verified_at: "2026-01-01T00:00:00Z",
      },
      memberships: [{ org_id: "org-1" }],
    });

    const res = await GET(
      makeReq("http://localhost:3000/api/auth/callback?code=good"),
    );

    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("honors explicit next param when it starts with /", async () => {
    mockExchangeCode({
      id: "user-next",
      email: "n@example.com",
      email_confirmed_at: "2026-01-01T00:00:00Z",
      user_metadata: {},
      app_metadata: { provider: "google" },
    });
    mockService({
      existing: {
        id: "user-next",
        account_type: "individual",
        email_verified_at: "2026-01-01T00:00:00Z",
      },
    });

    const res = await GET(
      makeReq(
        "http://localhost:3000/api/auth/callback?code=good&next=/publishing",
      ),
    );

    expect(new URL(res.headers.get("location")!).pathname).toBe("/publishing");
  });

  it("redirects to /login?error=auth_failed when insert fails", async () => {
    mockExchangeCode({
      id: "user-failed",
      email: "f@example.com",
      email_confirmed_at: "2026-01-01T00:00:00Z",
      user_metadata: {},
      app_metadata: { provider: "google" },
    });
    mockService({
      existing: null,
      insertError: { message: "db error" },
    });

    const res = await GET(
      makeReq("http://localhost:3000/api/auth/callback?code=good"),
    );
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("error")).toBe("auth_failed");
  });
});
