import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { issueState } from "@/lib/oauth-state";
import { checkConnectorAuthRateLimit } from "@/lib/ratelimit";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkConnectorAuthRateLimit(user.id, "linkedin");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many connection attempts. Please try again later." },
      { status: 429 },
    );
  }
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/linkedin/callback`;
  const state = await issueState("linkedin");

  // LinkedIn OpenID Connect scopes (replaces deprecated v1 profile scopes).
  // Organization-level posting (w_organization_social / r_organization_social)
  // requires LinkedIn Marketing Developer Platform approval — handled separately
  // once the app is approved.
  const scopes = ["openid", "profile", "email", "w_member_social"];

  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId || "");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes.join(" "));
  authUrl.searchParams.set("state", state);

  redirect(authUrl.toString());
}
