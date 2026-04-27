import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const RECIPIENT_PAGE_SIZE = 100;

/**
 * GET /api/whatsapp/broadcasts/[id]
 * Detail view: campaign row + paginated recipient sample + live counts.
 *
 * `?page=N` (0-indexed) selects the recipient page. Counts are computed
 * from the recipients table (not the campaign counters) so they're always
 * exact even when the worker counter has drifted.
 */
export async function GET(
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

    const url = new URL(request.url);
    const pageRaw = Number(url.searchParams.get("page") ?? "0");
    const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? pageRaw : 0;
    const from = page * RECIPIENT_PAGE_SIZE;
    const to = from + RECIPIENT_PAGE_SIZE - 1;

    const { data: campaign, error: campaignErr } = await supabase
      .from("whatsapp_campaigns")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (campaignErr) throw campaignErr;
    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 },
      );
    }

    const { data: recipients, error: recipientsErr } = await supabase
      .from("whatsapp_broadcast_recipients")
      .select(
        "id, contact_id, status, platform_message_id, error_code, error_message, sent_at",
      )
      .eq("campaign_id", id)
      .order("id")
      .range(from, to);
    if (recipientsErr) throw recipientsErr;

    const counts = await loadCounts(supabase, id);

    return NextResponse.json({
      campaign,
      recipients: recipients ?? [],
      counts,
      page,
      page_size: RECIPIENT_PAGE_SIZE,
    });
  } catch (error) {
    logger.error("GET /api/whatsapp/broadcasts/[id] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load campaign",
      },
      { status: 500 },
    );
  }
}

async function loadCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaignId: string,
): Promise<Record<string, number>> {
  const statuses = [
    "pending",
    "sent",
    "delivered",
    "read",
    "failed",
    "skipped",
  ] as const;
  const out: Record<string, number> = {};
  for (const s of statuses) {
    const { count } = await supabase
      .from("whatsapp_broadcast_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("status", s);
    out[s] = count ?? 0;
  }
  return out;
}
