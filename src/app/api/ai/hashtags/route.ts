import { generateHashtagsSchema } from "@/types/schemas";
import { createClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { NextRequest, NextResponse } from "next/server";

const AI_RATE_LIMIT_PER_HOUR = 20;

/**
 * POST /api/ai/hashtags
 * Generate relevant hashtags for social media content
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
    const parsed = generateHashtagsSchema.parse(body);

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 },
      );
    }

    const systemPrompt = `You are a hashtag expert for social media.
Generate relevant, trending, and high-performing hashtags for the given content and platform.
Focus on ${parsed.language} language hashtags when appropriate.
Return exactly ${parsed.count} hashtags as a comma-separated list without # symbols.`;

    const userPrompt = `Content: ${parsed.content}
Platform: ${parsed.platform}
Language: ${parsed.language}
Generate ${parsed.count} relevant hashtags.`;

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
        temperature: 0.5,
        max_tokens: 200,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const hashtagsText = data.choices[0]?.message?.content || "";
    const hashtags = hashtagsText
      .split(",")
      .map((tag: string) => tag.trim())
      .filter((tag: string) => tag.length > 0)
      .map((tag: string) => `#${tag}`);

    return NextResponse.json({
      hashtags: hashtags.slice(0, parsed.count),
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
          error instanceof Error
            ? error.message
            : "Failed to generate hashtags",
      },
      { status: 500 },
    );
  }
}
