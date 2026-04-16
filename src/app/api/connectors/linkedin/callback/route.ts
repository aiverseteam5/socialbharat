import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/encryption";
import { verifyState } from "@/lib/oauth-state";
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

    // Get user info
    const userUrl = "https://api.linkedin.com/v2/userinfo";
    const userResponse = await fetch(userUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userData = await userResponse.json();

    // Get user's organizations
    const orgsUrl =
      "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR";
    const orgsResponse = await fetch(orgsUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });

    const orgsData = await orgsResponse.json();

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
    const encryptedToken = encrypt(accessToken);
    const personUrn = userData.sub;

    // Store each organization as a connected profile
    const organizations = orgsData.elements || [];
    for (const org of organizations) {
      const organizationUrn = org.organization;

      // Fetch organization details
      const orgDetailsUrl = `https://api.linkedin.com/v2/organizations?ids=${organizationUrn}`;
      const orgDetailsResponse = await fetch(orgDetailsUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      });

      const orgDetailsData = await orgDetailsResponse.json();
      const orgDetails = orgDetailsData.results?.[organizationUrn];

      await supabase.from("social_profiles").upsert({
        org_id: orgId,
        platform: "linkedin",
        platform_user_id: organizationUrn,
        platform_username: orgDetails?.name || organizationUrn,
        access_token_encrypted: encryptedToken,
        metadata: {
          person_urn: personUrn,
          organization_urn: organizationUrn,
          logo_url: orgDetails?.logoV2?.original?.url,
        },
      });
    }

    redirect("/dashboard/settings/social-accounts?success=linkedin_connected");
  } catch (error) {
    redirect(
      `/dashboard/settings/social-accounts?error=${encodeURIComponent(error instanceof Error ? error.message : "Failed to connect LinkedIn")}`,
    );
  }
}
