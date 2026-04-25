import { NextResponse } from "next/server";

/**
 * V3 Phase 3B — Twitter/X connector is stubbed.
 *
 * Redirects to /settings/channels?error=platform_coming_soon instead of
 * initiating OAuth. Re-enable by restoring the pre-3B auth flow from git
 * history once the full Twitter implementation returns.
 */
export function GET() {
  return NextResponse.redirect(
    new URL(
      "/settings/channels?error=platform_coming_soon",
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    ),
  );
}
