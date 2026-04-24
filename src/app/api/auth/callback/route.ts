import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

/**
 * Unified Supabase auth callback.
 *
 * Handles:
 *   - Google OAuth sign-in (new and returning users)
 *   - Email verification links (supabase.auth.signUp flow)
 *
 * Post-auth routing:
 *   - individual             → /dashboard
 *   - team + has org         → /dashboard
 *   - team + no org          → /onboarding
 *
 * On failure, redirect to /login with a generic error code. Never expose
 * provider error details in the URL — log to logger only.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const explicitNext = searchParams.get("next");
  const queryAccountType = searchParams.get("account_type");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    logger.error("OAuth callback: code exchange failed", error);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const authUser = data.user;
  const userMetadata = authUser.user_metadata ?? {};
  const provider = authUser.app_metadata?.provider ?? "email";
  const isEmailVerified = Boolean(authUser.email_confirmed_at);

  // account_type priority:
  //   1. explicit ?account_type= on the callback URL (set by register/login pages before OAuth)
  //   2. user_metadata.account_type (set by admin.createUser on email signup)
  //   3. existing users row
  //   4. default 'individual'
  const requestedAccountType =
    queryAccountType === "team" || queryAccountType === "individual"
      ? queryAccountType
      : undefined;

  const metadataAccountType =
    userMetadata.account_type === "team" ||
    userMetadata.account_type === "individual"
      ? (userMetadata.account_type as "team" | "individual")
      : undefined;

  const svc = createServiceClient();

  const { data: existing } = await svc
    .from("users")
    .select("id, account_type, email_verified_at")
    .eq("id", authUser.id)
    .maybeSingle();

  const accountType =
    requestedAccountType ??
    metadataAccountType ??
    existing?.account_type ??
    "individual";

  if (!existing) {
    // First-time user (typically Google OAuth — email/password creates the
    // users row inside /api/auth/register before the verification link fires).
    const { error: insertErr } = await svc.from("users").insert({
      id: authUser.id,
      email: authUser.email,
      full_name:
        (userMetadata.full_name as string | undefined) ??
        (userMetadata.name as string | undefined) ??
        authUser.email,
      avatar_url: (userMetadata.avatar_url as string | undefined) ?? null,
      account_type: accountType,
      preferred_language: "en",
      notification_preferences: {
        in_app: true,
        email: true,
        whatsapp: false,
        sms: false,
      },
      email_verified_at: isEmailVerified ? new Date().toISOString() : null,
    });

    if (insertErr) {
      logger.error("OAuth callback: users insert failed", insertErr, {
        userId: authUser.id,
        provider,
      });
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }
  } else {
    // Returning user. Sync email_verified_at on first verified callback, and
    // upgrade account_type from individual → team if this callback was
    // initiated from the team register path.
    const updates: Record<string, unknown> = {};

    if (isEmailVerified && !existing.email_verified_at) {
      updates.email_verified_at = new Date().toISOString();
    }
    if (existing.account_type === "individual" && accountType === "team") {
      updates.account_type = "team";
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await svc
        .from("users")
        .update(updates)
        .eq("id", authUser.id);

      if (updateErr) {
        logger.error("OAuth callback: users update failed", updateErr, {
          userId: authUser.id,
        });
        // Non-fatal — user is authenticated, continue to dashboard routing.
      }
    }
  }

  // Decide post-auth destination.
  if (explicitNext && explicitNext.startsWith("/")) {
    return NextResponse.redirect(`${origin}${explicitNext}`);
  }

  if (accountType === "team") {
    const { data: memberships } = await svc
      .from("org_members")
      .select("org_id")
      .eq("user_id", authUser.id)
      .limit(1);

    if (!memberships || memberships.length === 0) {
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
