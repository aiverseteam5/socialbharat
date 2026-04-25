import { NextResponse } from "next/server";

/**
 * V3 Phase 3B — LinkedIn connector is stubbed.
 *
 * Redirects to /settings/channels?error=platform_coming_soon instead of
 * initiating OAuth.
 */
export function GET() {
  return NextResponse.redirect(
    new URL(
      "/settings/channels?error=platform_coming_soon",
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    ),
  );
}
