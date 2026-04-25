/**
 * V3 Phase 4A — shared agent types.
 *
 * Kept small and server-only. The orchestrator, research-agent, content-agent,
 * inbox-agent, and API routes all import from here so request/response shapes
 * stay consistent.
 */

export interface BrandVoice {
  id?: string;
  orgId: string;
  tone: string;
  coreValues: string;
  avoid: string;
  exampleCaptions: string;
  primaryLanguage: string | null;
  targetAudience: string;
}

export interface FestivalHint {
  id: string;
  name: string;
  nameHi: string | null;
  date: string; // ISO YYYY-MM-DD
  regions: string[];
  suggestedHashtags: string[];
  contentIdeas: string[];
}

export interface TrendReport {
  summary: string;
  topics: Array<{
    topic: string;
    why: string;
    suggestedAngle: string;
  }>;
  /** When the report was generated — used for cache staleness. */
  generatedAt: string;
}

export interface PlanPostDraft {
  platforms: Array<
    "facebook" | "instagram" | "twitter" | "linkedin" | "youtube" | "whatsapp"
  >;
  caption: string;
  hashtags: string[];
  /** Suggested publish time in IST, ISO string. */
  suggestedAt: string;
  festivalId?: string | null;
  rationale?: string;
}

export interface WeeklyPlan {
  theme: string;
  summary: string;
  posts: PlanPostDraft[];
}

export type InboxIntent =
  | "question"
  | "complaint"
  | "lead"
  | "spam"
  | "thanks"
  | "other";
export type InboxSentiment = "positive" | "neutral" | "negative";
export type InboxUrgency = "low" | "normal" | "high";

export interface InboxClassification {
  conversationId: string;
  intent: InboxIntent;
  sentiment: InboxSentiment;
  urgency: InboxUrgency;
  draftReply: string | null;
  flags: string[];
}

export interface AgentRunResult {
  kind: "weekly_content" | "inbox_replies";
  orgId: string;
  /** IDs of rows created in agent_plans / agent_inbox_actions. */
  createdIds: string[];
  tokensUsed?: number;
  steps: number;
  durationMs: number;
}
