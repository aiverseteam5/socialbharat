import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/encryption";
import { verifyState } from "@/lib/oauth-state";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

/**
 * Handle Facebook OAuth callback
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

  if (!(await verifyState("facebook", state))) {
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
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/facebook/callback`;

    const tokenUrl = new URL(
      "https://graph.facebook.com/v19.0/oauth/access_token",
    );
    tokenUrl.searchParams.set("client_id", appId || "");
    tokenUrl.searchParams.set("client_secret", appSecret || "");
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error.message);
    }

    const accessToken = tokenData.access_token;

    // Get user's pages
    const pagesUrl = new URL("https://graph.facebook.com/v19.0/me/accounts");
    pagesUrl.searchParams.set("access_token", accessToken);

    const pagesResponse = await fetch(pagesUrl.toString());
    const pagesData = await pagesResponse.json();

    if (pagesData.error) {
      throw new Error(pagesData.error.message);
    }

    const pages = pagesData.data || [];

    // Store each page as a connected profile
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (!currentUser) {
      redirect("/login");
    }

    // Get user's organization
    const { data: orgMember } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", currentUser.id)
      .limit(1)
      .single();

    if (!orgMember) {
      redirect("/onboarding");
    }

    const orgId = orgMember.org_id;
    const encryptedToken = encrypt(accessToken);

    for (const page of pages) {
      await supabase.from("social_profiles").upsert({
        org_id: orgId,
        platform: "facebook",
        platform_user_id: page.id,
        platform_username: page.name,
        access_token_encrypted: encryptedToken,
        metadata: {
          category: page.category,
          tasks: page.tasks,
        },
      });
    }

    redirect("/dashboard/settings/social-accounts?success=facebook_connected");
  } catch (error) {
    redirect(
      `/dashboard/settings/social-accounts?error=${encodeURIComponent(error instanceof Error ? error.message : "Failed to connect Facebook")}`,
    );
  }
}
