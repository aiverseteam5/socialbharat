import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateOrgKnowledgeSchema } from "@/types/schemas";

/**
 * GET /api/agent/knowledge
 * Returns the org's auto-reply grounding text. Empty string if not yet set.
 *
 * PUT /api/agent/knowledge
 * Upserts the body. RLS scopes both reads and writes to the caller's org.
 *
 * Single row per org — primary key is org_id. Insert + on-conflict handled
 * by Postgres `upsert` so callers don't need to differentiate create vs
 * update.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!member) {
    return NextResponse.json(
      { error: "No organization found" },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("org_agent_knowledge")
    .select("body, updated_at, updated_by")
    .eq("org_id", member.org_id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    body: data?.body ?? "",
    updated_at: data?.updated_at ?? null,
    updated_by: data?.updated_by ?? null,
  });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!member) {
    return NextResponse.json(
      { error: "No organization found" },
      { status: 403 },
    );
  }

  const json = await request.json().catch(() => ({}));
  const parsed = updateOrgKnowledgeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("org_agent_knowledge")
    .upsert(
      {
        org_id: member.org_id,
        body: parsed.data.body,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: "org_id" },
    )
    .select("body, updated_at, updated_by")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    body: data.body,
    updated_at: data.updated_at,
    updated_by: data.updated_by,
  });
}
