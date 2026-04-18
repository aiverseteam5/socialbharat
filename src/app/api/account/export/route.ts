import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * GET /api/account/export
 * DPDP Act compliance: export all data belonging to the authenticated user.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [profileResult, membershipsResult, postsResult, conversationsResult] =
      await Promise.all([
        supabase
          .from("users")
          .select(
            "id, email, phone, full_name, avatar_url, preferred_language, created_at, updated_at",
          )
          .eq("id", user.id)
          .single(),
        supabase
          .from("org_members")
          .select(
            "org_id, role, invited_at, accepted_at, organizations(id, name, slug, plan)",
          )
          .eq("user_id", user.id),
        supabase
          .from("posts")
          .select(
            "id, content, status, scheduled_at, published_at, platforms, created_at",
          )
          .eq("created_by", user.id)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("conversations")
          .select("id, platform, status, created_at, updated_at")
          .eq("assigned_to", user.id)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      user: profileResult.data,
      org_memberships: membershipsResult.data ?? [],
      posts: postsResult.data ?? [],
      assigned_conversations: conversationsResult.data ?? [],
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="socialbharat-data-export-${user.id}.json"`,
      },
    });
  } catch (error) {
    logger.error("GET /api/account/export failed", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
