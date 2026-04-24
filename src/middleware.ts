import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServiceClient } from "@/lib/supabase/service";

// Top-level paths served by the (dashboard) route group. Route groups
// don't appear in URLs, so these must be enumerated explicitly.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/inbox",
  "/publishing",
  "/settings",
  "/analytics",
  "/media",
  "/listening",
  "/whatsapp",
];

// Always-public paths that must never be gated — Meta review requires these to
// be publicly accessible, and /api/health is used by uptime monitors.
const ALWAYS_PUBLIC = new Set([
  "/privacy",
  "/terms",
  "/data-deletion",
  "/api/health",
]);

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

function isOnboardingPath(pathname: string): boolean {
  return pathname === "/onboarding" || pathname.startsWith("/onboarding/");
}

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // 8. Always-public paths (privacy, terms, data-deletion, /api/health)
  if (ALWAYS_PUBLIC.has(pathname)) {
    return response;
  }

  // 6. API routes handle their own auth internally.
  if (pathname.startsWith("/api")) {
    return response;
  }

  const isProtected = isProtectedPath(pathname);
  const isOnboarding = isOnboardingPath(pathname);

  // 1. No session + protected path → /login
  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (isOnboarding && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Has session + visiting /login or /register → /dashboard
  if ((pathname === "/login" || pathname === "/register") && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Beyond this point we only act for authenticated users on protected or
  // onboarding paths. For marketing paths (/, /pricing, etc.), pass through.
  if (!user || (!isProtected && !isOnboarding)) {
    return response;
  }

  // Load minimal profile info via service client. RLS-free read of only the
  // current user's row so we can decide verification + onboarding state.
  const svc = createServiceClient();
  const { data: profile } = await svc
    .from("users")
    .select("account_type, email_verified_at")
    .eq("id", user.id)
    .maybeSingle();

  // 3. Has session + email NOT verified + protected path → /verify-email
  //    (Only gate password-signup users — OAuth users have email_confirmed_at
  //    set by the provider, which we mirror to email_verified_at on callback.)
  const emailVerified = Boolean(
    profile?.email_verified_at || user.email_confirmed_at,
  );
  if (isProtected && !emailVerified) {
    return NextResponse.redirect(new URL("/verify-email", request.url));
  }

  // Check org membership only for team accounts — individuals never need an org.
  const accountType = profile?.account_type ?? "individual";
  let hasOrg = false;
  if (accountType === "team") {
    const { data: memberships } = await svc
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1);
    hasOrg = Boolean(memberships && memberships.length > 0);
  }

  // 4. Has session + email verified + team + no org + protected → /onboarding
  if (isProtected && accountType === "team" && !hasOrg) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // 5. Has session + on /onboarding + (individual OR already has org) → /dashboard
  if (isOnboarding && (accountType === "individual" || hasOrg)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
