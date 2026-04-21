import { generateContentSchema } from "@/types/schemas";
import { createClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { NextRequest, NextResponse } from "next/server";

const AI_RATE_LIMIT_PER_HOUR = 20;

/**
 * POST /api/ai/generate-content
 * Generate social media content using OpenAI GPT-4
 * Optimized for Indian social media context
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

    // Require active org membership — blocks anonymous billing abuse
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

    // Plan-tier gate — free plans cannot use AI features
    const { data: org } = await supabase
      .from("organizations")
      .select("plan")
      .eq("id", orgMember.org_id)
      .single();
    if (!org || org.plan === "free") {
      return NextResponse.json(
        { error: "Upgrade to access AI features" },
        { status: 403 },
      );
    }

    // Upstash rate limit — 20 requests per user per hour
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

    const body = await request.json();
    const parsed = generateContentSchema.parse(body);

    const { env } = await import("@/lib/env");
    const apiKey = env.OPENAI_API_KEY;

    // Build system prompt for Indian social media context
    const systemPrompt = `You are an expert social media content creator for the Indian market.
Your content should be culturally relevant, engaging, and optimized for the specified platform.
Consider Indian festivals, trends, and cultural nuances when generating content.
Use appropriate emojis and hashtags for the platform and language.
Keep the tone consistent with the requested tone (professional, casual, humorous, festive, hinglish, formal_hindi, regional_casual).
If festival_context is provided, incorporate that festival's themes and traditions naturally.`;

    const userPrompt = `Generate social media content for ${parsed.platform} in ${parsed.language} with a ${parsed.tone} tone.
Prompt: ${parsed.prompt}
${parsed.festival_context ? `Festival context: ${parsed.festival_context}` : ""}
${parsed.max_length ? `Max length: ${parsed.max_length} characters` : ""}
${parsed.include_hashtags ? "Include relevant hashtags at the end." : ""}
${parsed.include_emoji ? "Use appropriate emojis throughout." : ""}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const generatedContent = data.choices[0]?.message?.content || "";

    return NextResponse.json({
      content: generatedContent,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate content",
      },
      { status: 500 },
    );
  }
}
