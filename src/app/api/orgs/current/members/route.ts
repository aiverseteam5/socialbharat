import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { checkNumericLimit } from "@/lib/plan-limits";
import { inviteMemberSchema } from "@/types/schemas";
import { serverTrack } from "@/lib/analytics-server";
import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";
import { sendInvitationEmail } from "@/lib/email";
import { sendNotificationVoid } from "@/lib/notifications/send";
import { env } from "@/lib/env";

async function resolveOrgId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data?.org_id ?? null;
}

export async function GET() {
  try {
    const user = await requireAuth();
    const orgId = await resolveOrgId(user.id);
    if (!orgId) {
      return NextResponse.json(
        { error: "No organisation found" },
        { status: 404 },
      );
    }

    await requireRole(orgId, ["owner", "admin", "editor", "viewer"]);

    const supabase = await createClient();
    const { data: members, error } = await supabase
      .from("org_members")
      .select(
        `id, role, invited_at, accepted_at, user_id, users (id, email, phone, full_name, avatar_url)`,
      )
      .eq("org_id", orgId);

    if (error) {
      logger.error("Get current org members failed", error, { orgId });
      return NextResponse.json(
        { error: "Failed to fetch members" },
        { status: 500 },
      );
    }

    return NextResponse.json({ members });
  } catch (error) {
    if (error instanceof Error && error.message.includes("redirect"))
      throw error;
    logger.error("GET /api/orgs/current/members failed", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const orgId = await resolveOrgId(user.id);
    if (!orgId) {
      return NextResponse.json(
        { error: "No organisation found" },
        { status: 404 },
      );
    }

    await requireRole(orgId, ["owner", "admin"]);

    const body = await request.json();
    const parsed = inviteMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid invitation data", details: parsed.error.errors },
        { status: 400 },
      );
    }

    const { email, phone, role } = parsed.data;

    const memberLimit = await checkNumericLimit(orgId, "max_users");
    if (!memberLimit.allowed) {
      return NextResponse.json(
        {
          error: "Team member limit reached for your plan",
          code: "PLAN_LIMIT_EXCEEDED",
        },
        { status: 403 },
      );
    }

    const supabase = await createClient();
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { data: invitation, error } = await supabase
      .from("invitations")
      .insert({
        org_id: orgId,
        email: email || null,
        phone: phone || null,
        role,
        token,
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error || !invitation) {
      logger.error("Create invitation failed", error, { orgId });
      return NextResponse.json(
        { error: "Failed to create invitation" },
        { status: 500 },
      );
    }

    void serverTrack(user.id, "invited_user", { org_id: orgId, role });
    sendNotificationVoid({
      userId: user.id,
      orgId,
      type: "team_member_invited",
      title: "Team member invited",
      body: `Invitation sent to ${email ?? phone ?? "a new member"} as ${role}.`,
      link: "/settings/team",
    });

    const appUrl = env.NEXT_PUBLIC_APP_URL;
    const inviteLink = `${appUrl}/invite/${token}`;

    let emailSent = false;
    if (email) {
      const [{ data: org }, { data: inviter }] = await Promise.all([
        supabase.from("organizations").select("name").eq("id", orgId).single(),
        supabase
          .from("users")
          .select("full_name, email")
          .eq("id", user.id)
          .single(),
      ]);
      const result = await sendInvitationEmail({
        to: email,
        orgName: org?.name ?? "your team",
        inviterName: inviter?.full_name ?? inviter?.email ?? "A teammate",
        inviteLink,
        role,
      });
      emailSent = result.sent;
    }

    return NextResponse.json({ invitation, inviteLink, emailSent });
  } catch (error) {
    if (error instanceof Error && error.message.includes("redirect"))
      throw error;
    logger.error("POST /api/orgs/current/members failed", error);
    return NextResponse.json(
      { error: "Failed to invite member" },
      { status: 500 },
    );
  }
}
