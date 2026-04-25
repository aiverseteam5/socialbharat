import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/ratelimit";
import {
  getAnthropicClient,
  ANTHROPIC_MODEL,
  extractText,
} from "@/lib/agents/anthropic-client";
import { buildBrandSystemPrompt } from "@/lib/agents/brand-voice";
import type { BrandVoice } from "@/lib/agents/types";

const bodySchema = z.object({
  tone: z.string().default("friendly"),
  coreValues: z.string().default(""),
  avoid: z.string().default(""),
  exampleCaptions: z.string().default(""),
  primaryLanguage: z.string().nullable().default(null),
  targetAudience: z.string().default(""),
  prompt: z
    .string()
    .min(1)
    .max(500)
    .default("Write a 40-word Instagram caption introducing our brand."),
});

const AI_RATE_LIMIT_PER_HOUR = 10;

/**
 * POST /api/ai/test-brand-voice
 *
 * Lets the /settings/brand-voice editor preview how Claude will respond with
 * the given brand-voice configuration applied. Rate-limited harder than the
 * main generate route (10/hr) because each call is on-demand and cheaper per
 * UI action to abuse.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!member) {
    return NextResponse.json(
      { error: "No organization found" },
      { status: 403 },
    );
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("plan")
    .eq("id", member.org_id)
    .single();
  if (!org || org.plan === "free") {
    return NextResponse.json(
      { error: "Upgrade to access AI features" },
      { status: 403 },
    );
  }

  const rl = await checkAiRateLimit(user.id, AI_RATE_LIMIT_PER_HOUR);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(AI_RATE_LIMIT_PER_HOUR),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rl.reset),
        },
      },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const voice: BrandVoice = {
    orgId: member.org_id,
    tone: parsed.data.tone,
    coreValues: parsed.data.coreValues,
    avoid: parsed.data.avoid,
    exampleCaptions: parsed.data.exampleCaptions,
    primaryLanguage: parsed.data.primaryLanguage,
    targetAudience: parsed.data.targetAudience,
  };
  const systemPrompt = buildBrandSystemPrompt(voice);

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: "user", content: parsed.data.prompt }],
  });

  return NextResponse.json({
    content: extractText(response.content),
    systemPrompt,
  });
}
