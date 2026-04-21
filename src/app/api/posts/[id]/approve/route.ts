import { createClient } from "@/lib/supabase/server";
import { postApprovalSchema } from "@/types/schemas";
import { sendNotificationVoid } from "@/lib/notifications/send";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/posts/[id]/approve
 * Approve a post (owner/admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const postId = id;
    const body = await request.json();
    const parsed = postApprovalSchema.parse(body);

    // Get user's organization and role
    const { data: orgMember } = await supabase
      .from("org_members")
      .select("org_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!orgMember) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 400 },
      );
    }

    const orgId = orgMember.org_id;
    const userRole = orgMember.role;

    // Only owner and admin can approve
    if (userRole !== "owner" && userRole !== "admin") {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    // Verify post exists and belongs to org
    const { data: existingPost } = await supabase
      .from("posts")
      .select("id, status, created_by")
      .eq("id", postId)
      .eq("org_id", orgId)
      .single();

    if (!existingPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Only pending_approval posts can be approved
    if (existingPost.status !== "pending_approval") {
      return NextResponse.json(
        { error: "Can only approve posts pending approval" },
        { status: 400 },
      );
    }

    // Update post status — approved posts return to draft so they can be scheduled; rejected posts also return to draft with feedback
    const { data: post, error: updateError } = await supabase
      .from("posts")
      .update({
        status: "draft",
        updated_at: new Date(),
      })
      .eq("id", postId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Create approval record
    const { error: approvalError } = await supabase
      .from("post_approvals")
      .insert({
        post_id: postId,
        reviewer_id: user.id,
        status: parsed.status,
        feedback: parsed.feedback || null,
      });

    if (approvalError) {
      throw approvalError;
    }

    if (existingPost.created_by) {
      sendNotificationVoid({
        userId: existingPost.created_by as string,
        orgId,
        type: "post_approved",
        title: "Your post was approved",
        body:
          parsed.feedback ??
          "Your post has been approved and is ready to schedule.",
        link: `/publishing`,
      });
    }

    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to approve post",
      },
      { status: 500 },
    );
  }
}
