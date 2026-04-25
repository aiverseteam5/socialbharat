/**
 * Brand-voice helpers.
 *
 * Loads the active brand_voice row for an org and turns it into a system-prompt
 * fragment that every agent (research, content, inbox) prepends to its prompt.
 *
 * When no brand voice is configured the default fragment keeps the agent on
 * safe, India-first ground so orgs get reasonable output on day zero.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrandVoice } from "./types";
import { logger } from "@/lib/logger";

export async function loadBrandVoice(
  supabase: SupabaseClient,
  orgId: string,
): Promise<BrandVoice | null> {
  const { data, error } = await supabase
    .from("brand_voices")
    .select(
      "id, org_id, tone, core_values, avoid, example_captions, primary_language, target_audience",
    )
    .eq("org_id", orgId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    logger.warn("brand-voice: load failed", { orgId, error: error.message });
    return null;
  }
  if (!data) return null;

  return {
    id: data.id,
    orgId: data.org_id,
    tone: data.tone ?? "friendly",
    coreValues: data.core_values ?? "",
    avoid: data.avoid ?? "",
    exampleCaptions: data.example_captions ?? "",
    primaryLanguage: data.primary_language ?? null,
    targetAudience: data.target_audience ?? "",
  };
}

export function getDefaultSystemPrompt(): string {
  return [
    "You are SocialBharat's content assistant — an India-first social media AI.",
    "Default to warm, approachable tone. Prefer clear English with Hinglish",
    "sprinkled only where it feels natural. Always stay respectful of Indian",
    "culture, regional diversity, and festival context.",
    "",
    "Hard rules:",
    "- Never use slurs, communally charged language, or political attack copy.",
    "- Never invent product claims, prices, or guarantees.",
    "- Keep captions tight — under 2200 characters for Instagram, under 280",
    "  for Twitter/X, under 1300 for LinkedIn unless explicitly asked.",
    "- Hashtags belong at the end, not mid-sentence.",
  ].join("\n");
}

export function buildBrandSystemPrompt(voice: BrandVoice | null): string {
  const base = getDefaultSystemPrompt();
  if (!voice) return base;

  const lines: string[] = [base, "", "Brand voice for this org:"];
  lines.push(`- Tone: ${voice.tone}`);
  if (voice.targetAudience) {
    lines.push(`- Audience: ${voice.targetAudience}`);
  }
  if (voice.primaryLanguage) {
    lines.push(`- Primary language: ${voice.primaryLanguage}`);
  }
  if (voice.coreValues) {
    lines.push(`- Core values: ${voice.coreValues}`);
  }
  if (voice.avoid) {
    lines.push(`- Avoid: ${voice.avoid}`);
  }
  if (voice.exampleCaptions) {
    lines.push("", "On-brand example captions (match this style):");
    lines.push(voice.exampleCaptions);
  }
  return lines.join("\n");
}
