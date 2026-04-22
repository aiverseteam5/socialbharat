import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// All top-level paths served by the (dashboard) route group. Route groups
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
  "/onboarding",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // API routes handle their own auth
  if (pathname.startsWith("/api")) {
    return response;
  }

  // Protect all (dashboard) route-group paths — redirect unauthenticated users to /login
  if (isProtectedPath(pathname) && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from /login and /register
  if ((pathname === "/login" || pathname === "/register") && user) {
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
