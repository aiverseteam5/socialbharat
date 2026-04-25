/**
 * Agent orchestrator.
 *
 * Two entrypoints for V3 Phase 4A:
 *
 * - runWeeklyCycle(orgId): research → content. Writes one row to agent_plans
 *   with status 'pending_review' (if AGENT_HUMAN_APPROVAL=true) or 'approved'
 *   (if automation is full-auto). Does NOT create posts — that happens on
 *   explicit approval via /api/agent/plans/[id]/approve.
 *
 * - runInboxCycle(orgId): pulls open conversations missing a recent agent
 *   classification, runs the inbox agent in a single batch, and writes rows
 *   to agent_inbox_actions with status 'pending'. Humans send from UI.
 *
 * Both are safe to invoke from the cron worker — they use service-role
 * Supabase so RLS isn't required, and they respect per-org opt-in via
 * `organizations.opted_in_to_agent_automation` at the caller layer.
 */
import { createServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { buildBrandSystemPrompt, loadBrandVoice } from "./brand-voice";
import { runResearch } from "./research-agent";
import { createWeeklyPlan } from "./content-agent";
import { classifyAndDraft, type InboxMessageInput } from "./inbox-agent";
import type { AgentRunResult } from "./types";

interface OrgRow {
  id: string;
  industry: string | null;
  preferred_language: string | null;
  timezone: string | null;
}

function weekWindow(now: Date): { start: string; end: string } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

async function loadOrg(orgId: string): Promise<OrgRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, industry, preferred_language, timezone")
    .eq("id", orgId)
    .maybeSingle();
  if (error || !data) {
    logger.error("orchestrator: org lookup failed", error ?? undefined, {
      orgId,
    });
    return null;
  }
  return data as OrgRow;
}

export async function runWeeklyCycle(orgId: string): Promise<AgentRunResult> {
  const started = Date.now();
  const supabase = createServiceClient();

  const org = await loadOrg(orgId);
  if (!org) {
    return {
      kind: "weekly_content",
      orgId,
      createdIds: [],
      steps: 0,
      durationMs: Date.now() - started,
    };
  }

  const voice = await loadBrandVoice(supabase, orgId);
  const systemPrompt = buildBrandSystemPrompt(voice);

  // Available platforms come from the org's connected social_profiles.
  const { data: profiles } = await supabase
    .from("social_profiles")
    .select("platform")
    .eq("org_id", orgId)
    .eq("is_active", true);

  const platforms = Array.from(
    new Set((profiles ?? []).map((p: { platform: string }) => p.platform)),
  );
  if (platforms.length === 0) {
    logger.info("orchestrator: skipping weekly cycle — no connected profiles", {
      orgId,
    });
    return {
      kind: "weekly_content",
      orgId,
      createdIds: [],
      steps: 0,
      durationMs: Date.now() - started,
    };
  }

  const research = await runResearch({
    supabase,
    industry: org.industry ?? "general",
    language: voice?.primaryLanguage ?? org.preferred_language ?? "en",
    audience: voice?.targetAudience ?? "Indian consumers",
    systemPrompt,
  });

  const { start, end } = weekWindow(new Date());

  const plan = await createWeeklyPlan({
    systemPrompt,
    research,
    weekStart: start,
    weekEnd: end,
    platforms,
    postsPerWeek: 5,
  });

  const status = env.AGENT_HUMAN_APPROVAL ? "pending_review" : "approved";

  const { data: inserted, error: insertErr } = await supabase
    .from("agent_plans")
    .insert({
      org_id: orgId,
      kind: "weekly_content",
      status,
      week_start: start,
      week_end: end,
      plan,
      research,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    logger.error(
      "orchestrator: failed to insert agent_plan",
      insertErr ?? undefined,
      {
        orgId,
      },
    );
    throw new Error("Failed to persist agent plan");
  }

  logger.info("orchestrator: weekly plan created", {
    orgId,
    planId: inserted.id,
    status,
    postCount: plan.posts.length,
  });

  return {
    kind: "weekly_content",
    orgId,
    createdIds: [inserted.id],
    steps: 2, // research + content
    durationMs: Date.now() - started,
  };
}

export async function runInboxCycle(orgId: string): Promise<AgentRunResult> {
  const started = Date.now();
  const supabase = createServiceClient();

  const org = await loadOrg(orgId);
  if (!org) {
    return {
      kind: "inbox_replies",
      orgId,
      createdIds: [],
      steps: 0,
      durationMs: Date.now() - started,
    };
  }

  const voice = await loadBrandVoice(supabase, orgId);
  const systemPrompt = buildBrandSystemPrompt(voice);

  // Pull open conversations where we don't already have a pending/sent
  // agent_inbox_action in the last 24h. Simple approach: fetch open rows,
  // exclude any with an action row since yesterday.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: recentActions } = await supabase
    .from("agent_inbox_actions")
    .select("conversation_id")
    .eq("org_id", orgId)
    .gte("created_at", since);

  const skipIds = new Set(
    (recentActions ?? []).map(
      (r: { conversation_id: string }) => r.conversation_id,
    ),
  );

  const { data: conversations, error: convErr } = await supabase
    .from("conversations")
    .select("id, platform, type, language_detected, last_message_at")
    .eq("org_id", orgId)
    .eq("status", "open")
    .order("last_message_at", { ascending: false })
    .limit(20);

  if (convErr) {
    logger.error("orchestrator: conversations query failed", convErr, {
      orgId,
    });
    throw convErr;
  }

  const candidates = (conversations ?? []).filter((c) => !skipIds.has(c.id));
  if (candidates.length === 0) {
    return {
      kind: "inbox_replies",
      orgId,
      createdIds: [],
      steps: 0,
      durationMs: Date.now() - started,
    };
  }

  // Fetch the latest message per candidate conversation.
  const ids = candidates.map((c) => c.id);
  const { data: messages } = await supabase
    .from("messages")
    .select("conversation_id, content, created_at")
    .in("conversation_id", ids)
    .order("created_at", { ascending: false });

  const latestByConv = new Map<string, string>();
  for (const m of messages ?? []) {
    if (!latestByConv.has(m.conversation_id)) {
      latestByConv.set(m.conversation_id, m.content ?? "");
    }
  }

  const batch: InboxMessageInput[] = candidates
    .map((c) => ({
      conversationId: c.id,
      platform: c.platform,
      type: c.type,
      detectedLanguage: c.language_detected,
      latestMessage: latestByConv.get(c.id) ?? "",
    }))
    .filter((m) => m.latestMessage.length > 0)
    .slice(0, 10);

  if (batch.length === 0) {
    return {
      kind: "inbox_replies",
      orgId,
      createdIds: [],
      steps: 0,
      durationMs: Date.now() - started,
    };
  }

  const classifications = await classifyAndDraft({
    systemPrompt,
    messages: batch,
  });

  if (classifications.length === 0) {
    return {
      kind: "inbox_replies",
      orgId,
      createdIds: [],
      steps: 1,
      durationMs: Date.now() - started,
    };
  }

  const rows = classifications.map((c) => ({
    org_id: orgId,
    conversation_id: c.conversationId,
    intent: c.intent,
    sentiment: c.sentiment,
    urgency: c.urgency,
    draft_reply: c.draftReply,
    flags: c.flags ?? [],
    status: "pending" as const,
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from("agent_inbox_actions")
    .insert(rows)
    .select("id");

  if (insertErr) {
    logger.error("orchestrator: insert agent_inbox_actions failed", insertErr, {
      orgId,
    });
    throw insertErr;
  }

  const createdIds = (inserted ?? []).map((r: { id: string }) => r.id);

  logger.info("orchestrator: inbox cycle complete", {
    orgId,
    batchSize: batch.length,
    actionsCreated: createdIds.length,
  });

  return {
    kind: "inbox_replies",
    orgId,
    createdIds,
    steps: 1,
    durationMs: Date.now() - started,
  };
}
