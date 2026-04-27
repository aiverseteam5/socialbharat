import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLeadSchema } from "@/types/schemas";
import { logger } from "@/lib/logger";

/**
 * GET /api/leads?contactId=…
 * Returns the lead row for a contact in the caller's org. RLS enforces scope.
 * 200 { lead } on hit, 404 on miss.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contactId = request.nextUrl.searchParams.get("contactId");
    if (!contactId) {
      return NextResponse.json(
        { error: "contactId is required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("contact_id", contactId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({ lead: data });
  } catch (error) {
    logger.error("GET /api/leads failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load lead" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/leads
 * Body: { contact_id, name?, status? }
 * Atomic upsert on (org_id, contact_id) — returns existing row if already present.
 * Two browser tabs auto-creating concurrently converge on the same lead.id.
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
    const parsed = createLeadSchema.safeParse(body);
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

    const { data: contact } = await supabase
      .from("contacts")
      .select("id, org_id")
      .eq("id", parsed.data.contact_id)
      .maybeSingle();
    if (!contact || contact.org_id !== orgMember.org_id) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("leads")
      .upsert(
        {
          org_id: orgMember.org_id,
          contact_id: parsed.data.contact_id,
          name: parsed.data.name ?? null,
          status: parsed.data.status ?? "New",
        },
        { onConflict: "org_id,contact_id", ignoreDuplicates: false },
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ lead: data });
  } catch (error) {
    logger.error("POST /api/leads failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create lead",
      },
      { status: 500 },
    );
  }
}
