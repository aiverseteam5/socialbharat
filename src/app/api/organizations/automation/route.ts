import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * GET  /api/organizations/automation — returns the current opt-in flag.
 * PATCH /api/organizations/automation — toggles `opted_in_to_agent_automation`.
 *   RLS on `organizations` already restricts UPDATE to owner/admin.
 */

const patchSchema = z.object({
  optedIn: z.boolean(),
});

async function getOrgId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data?.org_id ?? null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) {
    return NextResponse.json(
      { error: "No organization found" },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("organizations")
    .select("opted_in_to_agent_automation")
    .eq("id", orgId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    optedIn: Boolean(data?.opted_in_to_agent_automation),
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) {
    return NextResponse.json(
      { error: "No organization found" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("organizations")
    .update({ opted_in_to_agent_automation: parsed.data.optedIn })
    .eq("id", orgId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ optedIn: parsed.data.optedIn });
}
