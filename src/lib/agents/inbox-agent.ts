/**
 * Inbox sub-agent.
 *
 * Batch-classifies open conversations (up to 10 at a time) and drafts replies.
 * One Claude call per batch keeps cost down. The returned classifications get
 * persisted by the orchestrator to agent_inbox_actions; a human approves or
 * edits via /ai-agent/inbox before `draft_reply` ever reaches the platform.
 *
 * We do NOT send replies from this layer — the send path stays in the regular
 * inbox UI/API, which already has platform-specific dispatch logic.
 */
import {
  getAnthropicClient,
  ANTHROPIC_MODEL,
  extractText,
  parseJsonFromResponse,
} from "./anthropic-client";
import type { InboxClassification } from "./types";
import { logger } from "@/lib/logger";

export interface InboxMessageInput {
  conversationId: string;
  platform: string;
  latestMessage: string;
  type?: string; // 'message' | 'comment' | 'mention' | 'review'
  detectedLanguage?: string | null;
}

const MAX_BATCH = 10;

function buildUserPrompt(messages: InboxMessageInput[]): string {
  const items = messages
    .map((m, idx) => {
      const langHint = m.detectedLanguage
        ? ` (lang: ${m.detectedLanguage})`
        : "";
      return [
        `[${idx + 1}] id=${m.conversationId} platform=${m.platform} type=${m.type ?? "message"}${langHint}`,
        `"""${m.latestMessage.replace(/"""/g, '"')}"""`,
      ].join("\n");
    })
    .join("\n\n");

  return [
    "Classify each inbox message and draft a reply.",
    "",
    messages.length === 1 ? "Message:" : `Messages (${messages.length} total):`,
    "",
    items,
    "",
    "For each message return an object with:",
    "- conversationId: the id shown above",
    '- intent: one of "question" | "complaint" | "lead" | "spam" | "thanks" | "other"',
    '- sentiment: one of "positive" | "neutral" | "negative"',
    '- urgency: one of "low" | "normal" | "high"',
    '- draftReply: one short reply in the same language as the message. null if intent is "spam".',
    '- flags: array of short strings such as "escalate", "needs_policy_review", "promo_requested". [] if none.',
    "",
    'Return ONLY JSON of the shape: { "classifications": [ ...objects... ] }',
    "No prose outside the JSON.",
  ].join("\n");
}

export async function classifyAndDraft(params: {
  systemPrompt: string;
  messages: InboxMessageInput[];
}): Promise<InboxClassification[]> {
  if (params.messages.length === 0) return [];
  if (params.messages.length > MAX_BATCH) {
    logger.warn("inbox-agent: batch too large, truncating", {
      requested: params.messages.length,
      max: MAX_BATCH,
    });
  }
  const batch = params.messages.slice(0, MAX_BATCH);

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2000,
    system: params.systemPrompt,
    messages: [{ role: "user", content: buildUserPrompt(batch) }],
  });

  const text = extractText(response.content);
  const parsed = parseJsonFromResponse<{
    classifications: InboxClassification[];
  }>(text);

  if (!parsed.classifications || !Array.isArray(parsed.classifications)) {
    throw new Error("inbox-agent: response missing classifications array");
  }

  // Map Claude's response back onto the requested ids so callers can't
  // accidentally mis-attribute a reply to a different conversation.
  const byId = new Map<string, InboxClassification>();
  for (const c of parsed.classifications) {
    if (c.conversationId) byId.set(c.conversationId, c);
  }

  return batch
    .map((m) => byId.get(m.conversationId))
    .filter((c): c is InboxClassification => Boolean(c));
}
