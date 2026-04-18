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

  const rl = await checkConnectorAuthRateLimit(user.id, "facebook");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many connection attempts. Please try again later." },
      { status: 429 },
    );
  }
  const appId = process.env.META_APP_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/facebook/callback`;
  const state = await issueState("facebook");

  const scopes = [
    "pages_manage_posts",
    "pages_read_engagement",
    "pages_read_user_content",
    "instagram_basic",
    "instagram_content_publish",
  ];

  const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  authUrl.searchParams.set("client_id", appId || "");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes.join(","));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);

  redirect(authUrl.toString());
}
