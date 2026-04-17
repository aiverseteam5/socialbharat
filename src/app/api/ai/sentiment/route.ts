import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sentimentAnalysisSchema } from "@/types/schemas";
import { logger } from "@/lib/logger";
import { ZodError } from "zod";
import OpenAI from "openai";

export interface SentimentResult {
  score: number;
  label: "positive" | "negative" | "neutral" | "mixed";
  language_detected: string;
}

const SYSTEM_PROMPT = `You are a sentiment analysis expert specializing in Indian social media content.
Analyze the sentiment of the provided text. It may be in English, Hindi, Hinglish (Hindi-English mix), Tamil, Telugu, Bengali, Marathi, or other Indian languages.
Return ONLY a valid JSON object with this exact shape:
{"score": <number between -1.0 and 1.0>, "label": "<positive|negative|neutral|mixed>", "language_detected": "<BCP-47 language code, e.g. en, hi, ta>"}
Where score: 1.0 = very positive, 0 = neutral, -1.0 = very negative.
Use "mixed" when there are significant positive and negative elements together.`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = sentimentAnalysisSchema.parse(body);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 503 },
      );
    }

    const openai = new OpenAI({ apiKey });

    const userMessage = parsed.language
      ? `Language hint: ${parsed.language}\n\nText: ${parsed.text}`
      : `Text: ${parsed.text}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0,
      max_tokens: 100,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: "Empty response from AI service" },
        { status: 502 },
      );
    }

    const parsed_result = JSON.parse(raw) as Record<string, unknown>;

    const score =
      typeof parsed_result.score === "number" ? parsed_result.score : 0;
    const label = (
      ["positive", "negative", "neutral", "mixed"].includes(
        parsed_result.label as string,
      )
        ? parsed_result.label
        : "neutral"
    ) as SentimentResult["label"];
    const language_detected =
      typeof parsed_result.language_detected === "string"
        ? parsed_result.language_detected
        : "en";

    const result: SentimentResult = {
      score: Math.max(-1, Math.min(1, score)),
      label,
      language_detected,
    };

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 },
      );
    }
    logger.error("POST /api/ai/sentiment failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
