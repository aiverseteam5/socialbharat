import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { idParamSchema, updateMemberRoleSchema } from "@/types/schemas";
import { logger } from "@/lib/logger";

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const user = await requireAuth();
    const orgId = await resolveOrgId(user.id);
    if (!orgId)
      return NextResponse.json(
        { error: "No organisation found" },
        { status: 404 },
      );

    const { uid } = await params;
    const uidValidation = idParamSchema.safeParse({ id: uid });
    if (!uidValidation.success)
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });

    await requireRole(orgId, ["owner", "admin"]);

    const body = await request.json();
    const roleValidation = updateMemberRoleSchema.safeParse(body);
    if (!roleValidation.success) {
      return NextResponse.json(
        { error: "Invalid role data", details: roleValidation.error.errors },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: member, error } = await supabase
      .from("org_members")
      .update({ role: roleValidation.data.role })
      .eq("org_id", orgId)
      .eq("user_id", uidValidation.data.id)
      .select()
      .single();

    if (error || !member) {
      logger.error("Update member role failed", error, { orgId });
      return NextResponse.json(
        { error: "Failed to update role" },
        { status: 500 },
      );
    }

    return NextResponse.json({ member });
  } catch (error) {
    if (error instanceof Error && error.message.includes("redirect"))
      throw error;
    logger.error("PUT /api/orgs/current/members/[uid] failed", error);
    return NextResponse.json(
      { error: "Failed to update role" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const user = await requireAuth();
    const orgId = await resolveOrgId(user.id);
    if (!orgId)
      return NextResponse.json(
        { error: "No organisation found" },
        { status: 404 },
      );

    const { uid } = await params;
    const uidValidation = idParamSchema.safeParse({ id: uid });
    if (!uidValidation.success)
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });

    await requireRole(orgId, ["owner", "admin"]);

    const supabase = await createClient();
    const { data: owners } = await supabase
      .from("org_members")
      .select("id, user_id")
      .eq("org_id", orgId)
      .eq("role", "owner");

    if (
      owners &&
      owners.length <= 1 &&
      owners[0]?.user_id === uidValidation.data.id
    ) {
      return NextResponse.json(
        { error: "Cannot remove the last owner" },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("org_members")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", uidValidation.data.id);

    if (error) {
      logger.error("Remove member failed", error, { orgId });
      return NextResponse.json(
        { error: "Failed to remove member" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("redirect"))
      throw error;
    logger.error("DELETE /api/orgs/current/members/[uid] failed", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 },
    );
  }
}
