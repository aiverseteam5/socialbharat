import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/encryption";
import { verifyState } from "@/lib/oauth-state";
import { checkNumericLimit } from "@/lib/plan-limits";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

/**
 * Handle Twitter OAuth callback
 * Exchanges code for access token, stores encrypted token in social_profiles
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

  if (!(await verifyState("twitter", state))) {
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
    const clientId = process.env.TWITTER_API_KEY;
    const clientSecret = process.env.TWITTER_API_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/twitter/callback`;

    const tokenUrl = "https://api.twitter.com/2/oauth2/token";
    const tokenParams = new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: clientId || "",
      redirect_uri: redirectUri,
      code_verifier: "challenge",
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error);
    }

    const accessToken = tokenData.access_token;

    // Get user info
    const userUrl = "https://api.twitter.com/2/users/me";
    const userResponse = await fetch(userUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userData = await userResponse.json();

    if (userData.errors) {
      throw new Error(userData.errors[0].message);
    }

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

    // Store Twitter profile
    await supabase.from("social_profiles").upsert({
      org_id: orgId,
      platform: "twitter",
      platform_user_id: userData.data.id,
      platform_username: userData.data.username,
      access_token_encrypted: encryptedToken,
      metadata: {
        name: userData.data.name,
        profile_image_url: userData.data.profile_image_url,
      },
    });

    redirect("/dashboard/settings/social-accounts?success=twitter_connected");
  } catch (error) {
    redirect(
      `/dashboard/settings/social-accounts?error=${encodeURIComponent(error instanceof Error ? error.message : "Failed to connect Twitter")}`,
    );
  }
}
