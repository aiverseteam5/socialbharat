import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const STATUS_VALUES = ["New", "Interested", "Hot", "Paid", "Lost"] as const;
type LeadStatus = (typeof STATUS_VALUES)[number];

const PAGE_SIZE = 200;
const Q_MAX = 64;

interface LeadRow {
  id: string;
  org_id: string;
  contact_id: string;
  name: string | null;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  contact: {
    id: string;
    display_name: string | null;
    platform_user_id: string;
  } | null;
}

interface ConvRow {
  id: string;
  contact_id: string;
  last_message_at: string | null;
}

interface MsgRow {
  conversation_id: string;
  content: string | null;
  created_at: string;
}

/**
 * GET /api/leads/list?status=&q=&from=&to=
 *
 * Kanban data source. RLS scopes rows to caller's org.
 *  - status: exact match on lead_status enum
 *  - q: any-of search on lead.name | contact.display_name | contact.platform_user_id
 *  - from / to: ISO date filter on leads.created_at
 *
 * Returns each lead joined with its contact + the latest conversation summary
 * (id, last_message_at, last_message_preview) for that contact, used by the
 * Kanban card to render preview + relative time.
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

    const sp = new URL(request.url).searchParams;
    const statusParam = sp.get("status");
    const qParam = sp.get("q");
    const fromParam = sp.get("from");
    const toParam = sp.get("to");

    const status: LeadStatus | null =
      statusParam && (STATUS_VALUES as readonly string[]).includes(statusParam)
        ? (statusParam as LeadStatus)
        : null;

    // Sanitize q: strip PostgREST .or() reserved chars (commas, parens, dots)
    // and cap length. Phone digits, latin/CJK/Devanagari letters, and spaces
    // are preserved.
    const q = qParam
      ? qParam
          .slice(0, Q_MAX)
          .replace(/[,()*%]/g, "")
          .trim()
      : "";

    let query = supabase
      .from("leads")
      .select(
        "id, org_id, contact_id, name, status, notes, created_at, updated_at, " +
          "contact:contacts!contact_id (id, display_name, platform_user_id)",
      )
      .order("updated_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (status) query = query.eq("status", status);
    if (fromParam) query = query.gte("created_at", fromParam);
    if (toParam) query = query.lte("created_at", toParam);

    if (q) {
      // Find contact ids in caller's org matching display_name OR phone
      // (RLS already scopes contacts to the caller's org).
      const { data: matched } = await supabase
        .from("contacts")
        .select("id")
        .or(`display_name.ilike.%${q}%,platform_user_id.ilike.%${q}%`);
      const matchedIds = (matched ?? []).map((m) => m.id);

      const orParts = [`name.ilike.%${q}%`];
      if (matchedIds.length > 0) {
        orParts.push(`contact_id.in.(${matchedIds.join(",")})`);
      }
      query = query.or(orParts.join(","));
    }

    const { data, error } = await query;
    if (error) throw error;

    const leads = ((data ?? []) as unknown as LeadRow[]).filter(
      (l) => l.contact !== null,
    );

    if (leads.length === 0) {
      return NextResponse.json({ leads: [] });
    }

    // Latest conversation per contact
    const contactIds = Array.from(new Set(leads.map((l) => l.contact_id)));
    const { data: convData } = await supabase
      .from("conversations")
      .select("id, contact_id, last_message_at")
      .in("contact_id", contactIds)
      .order("last_message_at", { ascending: false });

    const latestByContact = new Map<string, ConvRow>();
    for (const c of (convData ?? []) as ConvRow[]) {
      if (!latestByContact.has(c.contact_id))
        latestByContact.set(c.contact_id, c);
    }

    // Latest message preview per latest conversation
    const convIds = Array.from(latestByContact.values()).map((c) => c.id);
    const latestMsgByConv = new Map<string, MsgRow>();
    if (convIds.length > 0) {
      const { data: msgData } = await supabase
        .from("messages")
        .select("conversation_id, content, created_at")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false });
      for (const m of (msgData ?? []) as MsgRow[]) {
        if (!latestMsgByConv.has(m.conversation_id))
          latestMsgByConv.set(m.conversation_id, m);
      }
    }

    const enriched = leads.map((l) => {
      const conv = latestByContact.get(l.contact_id);
      const msg = conv ? latestMsgByConv.get(conv.id) : undefined;
      return {
        ...l,
        latest_conversation_id: conv?.id ?? null,
        last_message_at: conv?.last_message_at ?? null,
        last_message_preview: msg?.content ?? null,
      };
    });

    return NextResponse.json({ leads: enriched });
  } catch (error) {
    logger.error("GET /api/leads/list failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list leads",
      },
      { status: 500 },
    );
  }
}
