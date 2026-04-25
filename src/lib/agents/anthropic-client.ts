/**
 * Anthropic Claude client + helpers.
 *
 * Single model across research/content/inbox agents for cost predictability.
 * Pinned to `claude-sonnet-4-6` — last verified 2026-04-24.
 *
 * We intentionally do NOT use LangChain. Anthropic's SDK has first-class tool
 * use and the orchestrator loop is ~30 LOC; LangChain would be an unused dep.
 */
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

export const ANTHROPIC_MODEL = "claude-sonnet-4-6";

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return _client;
}

/**
 * Test hook — resets the cached client so tests can mock the constructor.
 */
export function _resetAnthropicClientForTests(): void {
  _client = null;
}

/**
 * Extract the text blocks from an Anthropic message response.
 * Multi-block responses (text + tool_use) are flattened — only text returned.
 */
export function extractText(
  content: Anthropic.Messages.ContentBlock[],
): string {
  return content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/**
 * Parse a JSON object out of a Claude text response. Claude sometimes wraps
 * JSON in ```json fences or adds prose before/after; this strips that and
 * attempts a single retry on parse failure by locating the first `{...}` span.
 */
export function parseJsonFromResponse<T>(text: string): T {
  // Strip markdown code fences if present.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fence?.[1] ?? text).trim();
  try {
    return JSON.parse(candidate) as T;
  } catch {
    // Fallback: locate first { ... last } span.
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1)) as T;
    }
    throw new Error(
      `Claude response was not valid JSON: ${text.slice(0, 200)}`,
    );
  }
}
