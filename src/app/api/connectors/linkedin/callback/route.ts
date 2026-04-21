import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/encryption";
import { verifyState } from "@/lib/oauth-state";
import { checkNumericLimit } from "@/lib/plan-limits";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

/**
 * Handle LinkedIn OAuth callback
 * Exchanges code for access token, fetches organizations, stores encrypted token
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

  if (!(await verifyState("linkedin", state))) {
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
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/linkedin/callback`;

    const tokenUrl = "https://www.linkedin.com/oauth/v2/accessToken";
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId || "",
      client_secret: clientSecret || "",
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
      throw new Error(tokenData.error_description);
    }

    const accessToken = tokenData.access_token;

    // Fetch the authenticated member's profile via OIDC userinfo.
    // `sub` is the member's person URN id (e.g. "abc123") — use this for posting
    // via author="urn:li:person:<sub>".
    const userUrl = "https://api.linkedin.com/v2/userinfo";
    const userResponse = await fetch(userUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userData = await userResponse.json();

    if (userData.serviceErrorCode || userData.status >= 400) {
      throw new Error(userData.message || "Failed to fetch LinkedIn profile");
    }

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
    const personUrn = `urn:li:person:${userData.sub}`;

    await supabase.from("social_profiles").upsert({
      org_id: orgId,
      platform: "linkedin",
      platform_user_id: userData.sub,
      platform_username: userData.name || userData.email || userData.sub,
      access_token_encrypted: encryptedToken,
      metadata: {
        person_urn: personUrn,
        email: userData.email,
        picture: userData.picture,
        locale: userData.locale,
      },
    });

    redirect("/dashboard/settings/social-accounts?success=linkedin_connected");
  } catch (error) {
    redirect(
      `/dashboard/settings/social-accounts?error=${encodeURIComponent(error instanceof Error ? error.message : "Failed to connect LinkedIn")}`,
    );
  }
}
