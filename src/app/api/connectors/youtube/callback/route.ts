import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/encryption";
import { verifyState } from "@/lib/oauth-state";
import { checkNumericLimit } from "@/lib/plan-limits";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

/**
 * Handle YouTube OAuth callback
 * Exchanges code for access token, fetches channel, stores encrypted token
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");

  if (error) {
    redirect(
      `/dashboard/settings/social-accounts?error=${encodeURIComponent(error)}`,
    );
  }

  if (!code) {
    redirect("/dashboard/settings/social-accounts?error=no_code");
  }

  if (!(await verifyState("youtube", state))) {
    redirect("/dashboard/settings/social-accounts?error=invalid_state");
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    // Exchange code for access token
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/youtube/callback`;

    const tokenUrl = "https://oauth2.googleapis.com/token";
    const tokenParams = new URLSearchParams({
      code,
      client_id: clientId || "",
      client_secret: clientSecret || "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error);
    }

    const accessToken = tokenData.access_token;

    // Get user's channel
    const channelUrl =
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true";
    const channelResponse = await fetch(
      `${channelUrl}&access_token=${accessToken}`,
    );
    const channelData = await channelResponse.json();

    if (channelData.error) {
      throw new Error(channelData.error.message);
    }

    const channel = channelData.items?.[0];

    // Get user's organization
    const { data: orgMember } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!orgMember) {
      redirect("/onboarding");
    }

    const orgId = orgMember.org_id;

    const profileLimit = await checkNumericLimit(orgId, "max_social_profiles");
    if (!profileLimit.allowed) {
      redirect("/dashboard/settings/social-accounts?error=plan_limit_reached");
    }

    const encryptedToken = encrypt(accessToken);

    // Store YouTube channel
    await supabase.from("social_profiles").upsert({
      org_id: orgId,
      platform: "youtube",
      platform_user_id: channel.id,
      platform_username: channel.snippet.title,
      access_token_encrypted: encryptedToken,
      metadata: {
        description: channel.snippet.description,
        thumbnail_url: channel.snippet.thumbnails?.default?.url,
      },
    });

    redirect("/dashboard/settings/social-accounts?success=youtube_connected");
  } catch (error) {
    redirect(
      `/dashboard/settings/social-accounts?error=${encodeURIComponent(error instanceof Error ? error.message : "Failed to connect YouTube")}`,
    );
  }
}
