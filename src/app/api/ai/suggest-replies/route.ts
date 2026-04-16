import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { suggestRepliesSchema } from "@/types/schemas";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

const AI_RATE_LIMIT_PER_HOUR = 20;

/**
 * POST /api/ai/suggest-replies
 * Generate 3 AI-suggested replies for an inbox conversation.
 * Uses conversation history + language hint. Produces Hinglish when
 * language='hi' or tone='hinglish'.
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
    const parsed = suggestRepliesSchema.parse(body);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 },
      );
    }

    const useHinglish = parsed.tone === "hinglish" || parsed.language === "hi";

    const systemPrompt = `You are an expert customer-engagement assistant for an Indian social-media management platform.
Given the recent conversation between a contact and the brand, generate exactly THREE distinct short reply options that an agent can send.
Rules:
- Keep each reply under 280 characters.
- Match the requested tone: ${parsed.tone}.
- ${useHinglish ? "Write in natural Hinglish (Roman-script Hindi mixed with English) — the kind real Indian users type on WhatsApp/Instagram." : `Respond in ${parsed.language}.`}
- Do not repeat the contact's question verbatim.
- Return ONLY a JSON array of three strings. No prose, no numbering, no markdown.`;

    const historyText = parsed.messages
      .map(
        (m) =>
          `${m.role === "contact" ? "Contact" : m.role === "agent" ? "Agent" : "System"}: ${m.content}`,
      )
      .join("\n");

    const userPrompt = `Conversation:\n${historyText}\n${parsed.context ? `\nExtra context: ${parsed.context}` : ""}\n\nReturn a JSON array of exactly 3 reply options.`;

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
        temperature: 0.6,
        max_tokens: 400,
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const raw = data.choices?.[0]?.message?.content ?? "[]";
    let suggestions: string[];
    try {
      const parsedJson = JSON.parse(raw);
      if (!Array.isArray(parsedJson)) throw new Error("not an array");
      suggestions = parsedJson.map((s: unknown) => String(s)).slice(0, 3);
    } catch {
      // Fallback: split on newlines if the model didn't return valid JSON.
      suggestions = raw
        .split(/\n+/)
        .map((s: string) => s.replace(/^[\d\-\*\.\s]+/, "").trim())
        .filter((s: string) => s.length > 0)
        .slice(0, 3);
    }

    return NextResponse.json({
      suggestions,
      conversation_id: parsed.conversation_id,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    logger.error("POST /api/ai/suggest-replies failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate reply suggestions",
      },
      { status: 500 },
    );
  }
}
