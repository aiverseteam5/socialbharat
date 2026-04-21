import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * PUT /api/notifications/read-all
 * Mark all of the authenticated user's notifications as read.
 */
export async function PUT() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to mark all notifications as read",
      },
      { status: 500 },
    );
  }
}
