import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    logger.error("OAuth callback: code exchange failed", error);
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  // Persist account_type from user_metadata into our users table if not set.
  const accountType =
    (data.user.user_metadata?.account_type as string | undefined) ??
    "individual";

  const svc = createServiceClient();
  const { data: existing } = await svc
    .from("users")
    .select("id, account_type")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!existing) {
    await svc.from("users").insert({
      id: data.user.id,
      email: data.user.email,
      full_name: data.user.user_metadata?.full_name ?? data.user.email,
      account_type: accountType,
      preferred_language: "en",
      notification_preferences: {
        in_app: true,
        email: true,
        whatsapp: false,
        sms: false,
      },
    });
  } else if (existing.account_type === "individual" && accountType === "team") {
    await svc
      .from("users")
      .update({ account_type: "team" })
      .eq("id", data.user.id);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
