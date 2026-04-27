import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * POST /api/whatsapp/broadcasts/[id]/cancel
 *
 * Cancellable states: draft | scheduled | running. Anything terminal
 * (completed, cancelled, failed) is rejected with 409.
 *
 * 1. Atomically move campaign → 'cancelled' (filtered by status so the
 *    transition is a no-op if another request already cancelled).
 * 2. Mark all still-pending recipients as 'skipped'. Already-sent or
 *    in-flight recipients are left alone — the worker bails on its next
 *    iteration when it re-reads campaign.status.
 */
export async function POST(
  _request: NextRequest,
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

    const { data: existing, error: existingErr } = await supabase
      .from("whatsapp_campaigns")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();

    if (existingErr) throw existingErr;
    if (!existing) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 },
      );
    }
    if (!["draft", "scheduled", "running"].includes(existing.status)) {
      return NextResponse.json(
        { error: `Campaign is ${existing.status} and cannot be cancelled` },
        { status: 409 },
      );
    }

    const { data: cancelled, error: cancelErr } = await supabase
      .from("whatsapp_campaigns")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .in("status", ["draft", "scheduled", "running"])
      .select("id, status")
      .maybeSingle();

    if (cancelErr) throw cancelErr;
    if (!cancelled) {
      // Race: another request flipped status between the read and update.
      return NextResponse.json(
        { error: "Campaign state changed; refresh and retry" },
        { status: 409 },
      );
    }

    const { error: skipErr } = await supabase
      .from("whatsapp_broadcast_recipients")
      .update({ status: "skipped" })
      .eq("campaign_id", id)
      .eq("status", "pending");
    if (skipErr) throw skipErr;

    return NextResponse.json({ campaign: cancelled });
  } catch (error) {
    logger.error("POST /api/whatsapp/broadcasts/[id]/cancel failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to cancel campaign",
      },
      { status: 500 },
    );
  }
}
