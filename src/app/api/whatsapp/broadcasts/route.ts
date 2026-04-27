import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  countTemplateVariables,
  createWhatsappCampaignSchema,
} from "@/types/schemas";
import { broadcastQueue } from "@/lib/queue/queues";
import { logger } from "@/lib/logger";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

interface SegmentFilter {
  lead_status?: string[];
  tags?: string[];
  created_from?: string;
  created_to?: string;
}

/**
 * GET /api/whatsapp/broadcasts
 * Lists campaigns for the caller's org. RLS scopes by org_id.
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

    const { data, error } = await supabase
      .from("whatsapp_campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ campaigns: data ?? [] });
  } catch (error) {
    logger.error("GET /api/whatsapp/broadcasts failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load campaigns",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/whatsapp/broadcasts
 * Body: { template_id, name, segment_filter, template_variables?, scheduled_at? }
 *
 * 1. Validate payload + template ownership + variable coverage.
 * 2. Resolve segment (excludes opted-out contacts at resolve time; the
 *    worker re-checks at send time to close the race window).
 * 3. Insert campaign + bulk-insert recipients (status='pending').
 * 4. Enqueue a fan-out job (immediate or delayed by `scheduled_at`).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createWhatsappCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { data: orgMember } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (!orgMember) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 403 },
      );
    }

    const { data: template } = await supabase
      .from("whatsapp_templates")
      .select("id, body, variable_count, status")
      .eq("id", parsed.data.template_id)
      .maybeSingle();

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }
    if (template.status !== "approved") {
      return NextResponse.json(
        { error: "Template is not approved for sending" },
        { status: 400 },
      );
    }

    // Belt-and-braces variable check at campaign create time. The worker
    // does the same check per recipient (Risk #5) so a template body edit
    // between create and dispatch can't sneak through.
    const expected = countTemplateVariables(template.body);
    if (expected > 0) {
      const vars = parsed.data.template_variables ?? {};
      for (let i = 1; i <= expected; i++) {
        if (typeof vars[String(i)] !== "string") {
          return NextResponse.json(
            { error: `Missing template variable {{${i}}}` },
            { status: 400 },
          );
        }
      }
    }

    const contactIds = await resolveSegment(
      supabase,
      orgMember.org_id,
      parsed.data.segment_filter,
    );

    if (contactIds.length === 0) {
      return NextResponse.json(
        { error: "Segment matched zero recipients" },
        { status: 400 },
      );
    }

    const scheduledAt = parsed.data.scheduled_at ?? null;
    const isScheduled =
      scheduledAt !== null && new Date(scheduledAt).getTime() > Date.now();

    const { data: campaign, error: campaignErr } = await supabase
      .from("whatsapp_campaigns")
      .insert({
        org_id: orgMember.org_id,
        template_id: parsed.data.template_id,
        name: parsed.data.name,
        segment_filter: parsed.data.segment_filter,
        template_variables: parsed.data.template_variables ?? null,
        scheduled_at: scheduledAt,
        status: isScheduled ? "scheduled" : "running",
        total_recipients: contactIds.length,
        created_by: user.id,
      })
      .select()
      .single();

    if (campaignErr || !campaign)
      throw campaignErr ?? new Error("insert failed");

    const recipients = contactIds.map((cid) => ({
      campaign_id: campaign.id,
      contact_id: cid,
      org_id: orgMember.org_id,
      status: "pending" as const,
    }));

    const { error: recipientsErr } = await supabase
      .from("whatsapp_broadcast_recipients")
      .insert(recipients);
    if (recipientsErr) throw recipientsErr;

    const delayMs = isScheduled
      ? new Date(scheduledAt).getTime() - Date.now()
      : 0;

    await broadcastQueue().add(
      "fan-out",
      {
        kind: "fan-out" as const,
        campaignId: campaign.id,
        orgId: orgMember.org_id,
      },
      { delay: delayMs > 0 ? delayMs : undefined },
    );

    return NextResponse.json({
      campaign,
      total_recipients: contactIds.length,
    });
  } catch (error) {
    logger.error("POST /api/whatsapp/broadcasts failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create campaign",
      },
      { status: 500 },
    );
  }
}

// Segment resolution: pull WhatsApp contacts in the org excluding opt-outs,
// then intersect with optional lead-status and tag-overlap filters. Done in
// 1–3 round-trips client-side rather than a single SQL JOIN — at v1 segment
// sizes (low thousands) this is fine and avoids a custom Postgres function.
async function resolveSegment(
  supabase: SupabaseClient,
  orgId: string,
  filter: SegmentFilter,
): Promise<string[]> {
  let q = supabase
    .from("contacts")
    .select("id")
    .eq("org_id", orgId)
    .eq("platform", "whatsapp")
    .is("opted_out_at", null);
  if (filter.created_from) q = q.gte("created_at", filter.created_from);
  if (filter.created_to) q = q.lte("created_at", filter.created_to);

  const { data: baseRows, error: baseErr } = await q;
  if (baseErr) throw baseErr;
  let ids = new Set<string>((baseRows ?? []).map((r) => r.id as string));

  if (filter.lead_status?.length) {
    const { data: leadRows, error: leadErr } = await supabase
      .from("leads")
      .select("contact_id")
      .eq("org_id", orgId)
      .in("status", filter.lead_status);
    if (leadErr) throw leadErr;
    const leadIds = new Set(
      (leadRows ?? []).map((r) => r.contact_id as string),
    );
    ids = new Set([...ids].filter((id) => leadIds.has(id)));
  }

  if (filter.tags?.length) {
    const { data: convRows, error: convErr } = await supabase
      .from("conversations")
      .select("contact_id")
      .eq("org_id", orgId)
      .overlaps("tags", filter.tags);
    if (convErr) throw convErr;
    const tagIds = new Set((convRows ?? []).map((r) => r.contact_id as string));
    ids = new Set([...ids].filter((id) => tagIds.has(id)));
  }

  return [...ids];
}
