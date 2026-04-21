import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/auth";
import { createOrgSchema } from "@/types/schemas";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const validationResult = createOrgSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid organization data",
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const { name, industry, team_size, preferred_language } =
      validationResult.data;

    // Bootstrap a new org requires elevated privileges: a brand-new user isn't
    // yet a member of any org, so user-scoped RLS blocks both the slug-conflict
    // SELECT and the owner-membership INSERT. Safe to use the service client
    // here because requireAuth() above verified the user.
    const serviceClient = createServiceClient();

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const { data: existingOrg } = await serviceClient
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    const finalSlug = existingOrg
      ? `${slug}-${Math.random().toString(36).substring(2, 8)}`
      : slug;

    // Guarantee a users row exists before any FK-constrained insert.
    // This covers Google OAuth sign-ups and cases where the register
    // route's upsert ran before the DB trigger could fire.
    await serviceClient.from("users").upsert(
      {
        id: user.id,
        email: user.email ?? null,
        phone: user.phone ?? null,
        full_name:
          user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
        account_type: "team",
        preferred_language: preferred_language || "en",
        notification_preferences: {
          in_app: true,
          email: true,
          whatsapp: false,
          sms: false,
        },
      },
      { onConflict: "id", ignoreDuplicates: false },
    );

    const { data: org, error: orgError } = await serviceClient
      .from("organizations")
      .insert({
        name,
        slug: finalSlug,
        industry: industry || null,
        team_size: team_size || null,
        preferred_language: preferred_language || "en",
        plan: "free",
      })
      .select()
      .single();

    if (orgError || !org) {
      logger.error("Organization insert failed", orgError, {
        userId: user.id,
        slug: finalSlug,
      });
      return NextResponse.json(
        { error: "Failed to create organization" },
        { status: 500 },
      );
    }

    const { error: memberError } = await serviceClient
      .from("org_members")
      .insert({
        org_id: org.id,
        user_id: user.id,
        role: "owner",
        invited_by: user.id,
        accepted_at: new Date().toISOString(),
      });

    if (memberError) {
      logger.error("Owner membership insert failed", memberError, {
        userId: user.id,
        orgId: org.id,
      });
      return NextResponse.json(
        { error: "Failed to add you as owner" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      organization: org,
      role: "owner",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("redirect")) {
      throw error;
    }
    logger.error("POST /api/orgs failed", error);
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 },
    );
  }
}
