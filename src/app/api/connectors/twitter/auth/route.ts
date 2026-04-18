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

  const rl = await checkConnectorAuthRateLimit(user.id, "twitter");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many connection attempts. Please try again later." },
      { status: 429 },
    );
  }
  const clientId = process.env.TWITTER_API_KEY;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/twitter/callback`;
  const state = await issueState("twitter");

  const scopes = ["tweet.read", "tweet.write", "users.read", "offline.access"];

  const authUrl = new URL("https://twitter.com/i/oauth2/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId || "");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes.join(" "));
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", "challenge");
  authUrl.searchParams.set("code_challenge_method", "plain");

  redirect(authUrl.toString());
}
