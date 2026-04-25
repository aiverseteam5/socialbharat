import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * GET /api/brand-voice — returns the active brand voice for the caller's org,
 *   or { voice: null } when none is set yet.
 * PUT /api/brand-voice — upserts (one active row per org). RLS enforces role.
 */

const upsertSchema = z.object({
  tone: z.string().trim().min(1).max(80),
  coreValues: z.string().trim().max(2000).default(""),
  avoid: z.string().trim().max(2000).default(""),
  exampleCaptions: z.string().trim().max(4000).default(""),
  primaryLanguage: z.string().trim().max(20).nullable().default(null),
  targetAudience: z.string().trim().max(500).default(""),
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
    .from("brand_voices")
    .select(
      "id, tone, core_values, avoid, example_captions, primary_language, target_audience, updated_at",
    )
    .eq("org_id", orgId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ voice: null });
  }

  return NextResponse.json({
    voice: {
      id: data.id,
      tone: data.tone ?? "friendly",
      coreValues: data.core_values ?? "",
      avoid: data.avoid ?? "",
      exampleCaptions: data.example_captions ?? "",
      primaryLanguage: data.primary_language ?? null,
      targetAudience: data.target_audience ?? "",
      updatedAt: data.updated_at,
    },
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

  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) {
    return NextResponse.json(
      { error: "No organization found" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const row = {
    org_id: orgId,
    tone: parsed.data.tone,
    core_values: parsed.data.coreValues,
    avoid: parsed.data.avoid,
    example_captions: parsed.data.exampleCaptions,
    primary_language: parsed.data.primaryLanguage,
    target_audience: parsed.data.targetAudience,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("brand_voices")
    .select("id")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("brand_voices")
      .update(row)
      .eq("id", existing.id);
    if (error) {
      logger.error("brand-voice: update failed", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ id: existing.id, success: true });
  }

  const { data: inserted, error } = await supabase
    .from("brand_voices")
    .insert({ ...row, created_by: user.id })
    .select("id")
    .single();
  if (error || !inserted) {
    logger.error("brand-voice: insert failed", error ?? undefined);
    return NextResponse.json(
      { error: error?.message ?? "Insert failed" },
      { status: 500 },
    );
  }
  return NextResponse.json({ id: inserted.id, success: true });
}
