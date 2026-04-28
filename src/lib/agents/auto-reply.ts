/**
 * WhatsApp inbound auto-reply decider.
 *
 * Given the latest inbound message + recent history + grounding knowledge,
 * produces a `send` or `escape` decision. Two layers of safety:
 *
 *   1. Deterministic regex backstop runs before Claude — anger/refund/legal
 *      keywords or any "I want a human" phrasing escapes immediately, no
 *      LLM call. Saves cost on obvious escalations.
 *   2. Claude returns its own confidence + requires_human flag. We only
 *      send when both: confidence >= threshold AND requires_human === false.
 *
 * Caller (the agent worker) is responsible for the actual sendMessage()
 * dispatch, persistence, and routing escapes into agent_inbox_actions.
 */
import {
  getAnthropicClient,
  ANTHROPIC_MODEL,
  extractText,
  parseJsonFromResponse,
} from "./anthropic-client";
import { logger } from "@/lib/logger";

export const AUTO_REPLY_CONFIDENCE_THRESHOLD = 0.7;
export const AUTO_REPLY_MAX_TOKENS = 500;

/** Anger / complaint / legal triggers — escape without calling Claude. */
const ANGER_RX =
  /\b(angry|refund|complain|complaint|lawsuit|sue|cheat|scam|legal|fraud|chargeback)\b/i;

/** Explicit human-handoff request — escape without calling Claude. */
const HUMAN_RX =
  /\b(human|agent|operator|representative|manager|supervisor|live\s+person)\b/i;

export interface AutoReplyMessage {
  role: "contact" | "agent";
  content: string;
}

export interface AutoReplyContext {
  inboundContent: string;
  detectedLanguage?: string | null;
  history: AutoReplyMessage[];
  /** Free-text grounding from org_agent_knowledge.body. May be empty. */
  knowledge: string;
  /** Brand-voice system prompt prefix produced by buildBrandSystemPrompt(). */
  brandSystemPrompt: string;
}

export type AutoReplyDecision =
  | { kind: "send"; reply: string; confidence: number }
  | {
      kind: "escape";
      draftReply: string | null;
      reason: AutoReplyEscapeReason;
      confidence: number;
    };

export type AutoReplyEscapeReason =
  | "regex_anger"
  | "regex_human_request"
  | "empty_input"
  | "low_confidence"
  | "requires_human"
  | "model_flagged"
  | "parse_failure";

interface ClaudeAutoReplyResponse {
  reply: string;
  confidence: number;
  requires_human: boolean;
  escape_reason?: string | null;
}

function buildSystemPrompt(ctx: AutoReplyContext): string {
  const knowledgeBlock = ctx.knowledge.trim()
    ? [
        "Business knowledge you may rely on (do not invent anything not stated here):",
        ctx.knowledge.trim(),
      ].join("\n")
    : "No business knowledge has been provided. Stay general and conservative.";

  return [
    ctx.brandSystemPrompt.trim(),
    "",
    "You are replying to a WhatsApp message inside the 24-hour service window.",
    "Hard rules — these override anything else:",
    "- Reply in the same language as the inbound message.",
    "- Keep replies under 300 characters.",
    "- NEVER invent prices, dates, discounts, availability, addresses, or promises.",
    "- If the customer asks something you cannot answer with high confidence, set requires_human: true and let a human take over.",
    "- If the customer is angry, asking for a refund, threatening legal action, or requesting a human, set requires_human: true.",
    "- Do not greet repeatedly across turns; check the history.",
    "",
    knowledgeBlock,
  ].join("\n");
}

function buildUserPrompt(ctx: AutoReplyContext): string {
  const langHint = ctx.detectedLanguage
    ? ` (detected language: ${ctx.detectedLanguage})`
    : "";
  const historyBlock =
    ctx.history.length === 0
      ? "(no prior messages)"
      : ctx.history
          .map(
            (m) =>
              `${m.role === "contact" ? "CUSTOMER" : "US"}: ${m.content.replace(/\s+/g, " ").slice(0, 500)}`,
          )
          .join("\n");

  return [
    `Recent conversation history${langHint}:`,
    historyBlock,
    "",
    "Latest inbound from CUSTOMER:",
    `"""${ctx.inboundContent.replace(/"""/g, '"').slice(0, 2000)}"""`,
    "",
    "Return ONLY JSON of the shape:",
    '{ "reply": string, "confidence": number (0-1), "requires_human": boolean, "escape_reason": string|null }',
    "No prose outside the JSON.",
  ].join("\n");
}

/**
 * Cheap deterministic backstop. Runs before any LLM call.
 * Returns null if input is fine to pass through.
 */
export function applyEscapeRegex(
  inbound: string,
): AutoReplyEscapeReason | null {
  const trimmed = inbound.trim();
  if (!trimmed) return "empty_input";
  if (HUMAN_RX.test(inbound)) return "regex_human_request";
  if (ANGER_RX.test(inbound)) return "regex_anger";
  return null;
}

export async function decideAutoReply(
  ctx: AutoReplyContext,
): Promise<AutoReplyDecision> {
  // 1. Cheap regex backstop. No Claude call when input is obviously an escape.
  const regexHit = applyEscapeRegex(ctx.inboundContent);
  if (regexHit) {
    return {
      kind: "escape",
      draftReply: null,
      reason: regexHit,
      confidence: 0,
    };
  }

  // 2. LLM call.
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: AUTO_REPLY_MAX_TOKENS,
    system: buildSystemPrompt(ctx),
    messages: [{ role: "user", content: buildUserPrompt(ctx) }],
  });

  const text = extractText(response.content);

  let parsed: ClaudeAutoReplyResponse;
  try {
    parsed = parseJsonFromResponse<ClaudeAutoReplyResponse>(text);
  } catch (err) {
    logger.warn("auto-reply: malformed Claude response, escaping to draft", {
      error: err instanceof Error ? err.message : String(err),
      preview: text.slice(0, 200),
    });
    return {
      kind: "escape",
      draftReply: null,
      reason: "parse_failure",
      confidence: 0,
    };
  }

  const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
  const confidence =
    typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0;
  const requiresHuman = parsed.requires_human === true;

  // 3. Final gate: model self-flagged OR confidence below threshold OR
  // empty reply text → escape and offer the draft (if any) for human edit.
  if (requiresHuman) {
    return {
      kind: "escape",
      draftReply: reply || null,
      reason: "requires_human",
      confidence,
    };
  }
  if (!reply) {
    return {
      kind: "escape",
      draftReply: null,
      reason: "model_flagged",
      confidence,
    };
  }
  if (confidence < AUTO_REPLY_CONFIDENCE_THRESHOLD) {
    return {
      kind: "escape",
      draftReply: reply,
      reason: "low_confidence",
      confidence,
    };
  }

  return { kind: "send", reply, confidence };
}
