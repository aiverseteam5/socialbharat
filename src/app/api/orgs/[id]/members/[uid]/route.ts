import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { idParamSchema, updateMemberRoleSchema } from "@/types/schemas";
import { logger } from "@/lib/logger";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; uid: string }> },
) {
  try {
    await requireAuth();

    const { id, uid } = await params;

    const idValidation = idParamSchema.safeParse({ id });
    const uidValidation = idParamSchema.safeParse({ id: uid });

    if (!idValidation.success || !uidValidation.success) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    const { id: orgId } = idValidation.data;
    const { id: targetUserId } = uidValidation.data;

    // Verify membership (owner/admin only)
    await requireRole(orgId, ["owner", "admin"]);

    const body = await request.json();
    const roleValidation = updateMemberRoleSchema.safeParse(body);

    if (!roleValidation.success) {
      return NextResponse.json(
        { error: "Invalid role data", details: roleValidation.error.errors },
        { status: 400 },
      );
    }

    const { role } = roleValidation.data;

    const supabase = await createClient();

    // Update member role
    const { data: member, error } = await supabase
      .from("org_members")
      .update({ role })
      .eq("org_id", orgId)
      .eq("user_id", targetUserId)
      .select()
      .single();

    if (error || !member) {
      logger.error("Update member role query failed", error, {
        orgId,
        targetUserId,
      });
      return NextResponse.json(
        { error: "Failed to update member role" },
        { status: 500 },
      );
    }

    return NextResponse.json({ member });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("redirect")) {
        throw error;
      }
      if (
        error.message.includes("not a member") ||
        error.message.includes("permission")
      ) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    logger.error("PUT /api/orgs/[id]/members/[uid] failed", error);
    return NextResponse.json(
      { error: "Failed to update member role" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; uid: string }> },
) {
  try {
    await requireAuth();

    const { id, uid } = await params;

    const idValidation = idParamSchema.safeParse({ id });
    const uidValidation = idParamSchema.safeParse({ id: uid });

    if (!idValidation.success || !uidValidation.success) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    const { id: orgId } = idValidation.data;
    const { id: targetUserId } = uidValidation.data;

    // Verify membership (owner/admin only)
    await requireRole(orgId, ["owner", "admin"]);

    const supabase = await createClient();

    // Check if this is the last owner
    const { data: owners, error: countError } = await supabase
      .from("org_members")
      .select("id")
      .eq("org_id", orgId)
      .eq("role", "owner");

    if (countError) {
      logger.error("Count owners query failed", countError, { orgId });
      return NextResponse.json(
        { error: "Failed to check ownership" },
        { status: 500 },
      );
    }

    if (owners && owners.length <= 1 && owners[0]?.id === targetUserId) {
      return NextResponse.json(
        { error: "Cannot remove the last owner of the organization" },
        { status: 400 },
      );
    }

    // Remove member
    const { error } = await supabase
      .from("org_members")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", targetUserId);

    if (error) {
      logger.error("Remove member query failed", error, {
        orgId,
        targetUserId,
      });
      return NextResponse.json(
        { error: "Failed to remove member" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("redirect")) {
        throw error;
      }
      if (
        error.message.includes("not a member") ||
        error.message.includes("permission")
      ) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    logger.error("DELETE /api/orgs/[id]/members/[uid] failed", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 },
    );
  }
}
