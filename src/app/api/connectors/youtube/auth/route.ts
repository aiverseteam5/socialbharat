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

  const rl = await checkConnectorAuthRateLimit(user.id, "youtube");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many connection attempts. Please try again later." },
      { status: 429 },
    );
  }
  const clientId = process.env.YOUTUBE_API_KEY;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/youtube/callback`;
  const state = await issueState("youtube");

  const scopes = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
  ];

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId || "");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  redirect(authUrl.toString());
}
