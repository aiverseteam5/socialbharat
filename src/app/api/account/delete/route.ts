import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

const deleteSchema = z.object({
  confirm: z.literal("DELETE MY ACCOUNT"),
});

/**
 * DELETE /api/account/delete
 * DPDP Act compliance: permanently delete the authenticated user's account
 * and all associated data. Requires explicit confirmation string.
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            'Confirmation required. Send { "confirm": "DELETE MY ACCOUNT" }',
        },
        { status: 400 },
      );
    }

    const serviceClient = createServiceClient();

    // Delete user data in dependency order (RLS won't apply for service client).
    await serviceClient.from("messages").delete().eq("sender_id", user.id);
    await serviceClient
      .from("post_approvals")
      .delete()
      .eq("reviewed_by", user.id);
    await serviceClient.from("posts").delete().eq("created_by", user.id);
    await serviceClient
      .from("media_assets")
      .delete()
      .eq("uploaded_by", user.id);
    await serviceClient.from("invitations").delete().eq("invited_by", user.id);
    await serviceClient.from("org_members").delete().eq("user_id", user.id);
    await serviceClient.from("users").delete().eq("id", user.id);

    // Delete the Supabase Auth user last (service client required).
    const { error: authDeleteError } =
      await serviceClient.auth.admin.deleteUser(user.id);
    if (authDeleteError) {
      logger.error("Auth user deletion failed", authDeleteError, {
        userId: user.id,
      });
      return NextResponse.json(
        { error: "Failed to delete account" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, message: "Account deleted" });
  } catch (error) {
    logger.error("DELETE /api/account/delete failed", error);
    return NextResponse.json(
      { error: "Account deletion failed" },
      { status: 500 },
    );
  }
}
