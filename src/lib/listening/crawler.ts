import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  ListeningQuery,
  ListeningMention,
  SentimentLabel,
} from "@/types/database";
import OpenAI from "openai";

export interface CrawlResult {
  queried: number;
  mentionsSaved: number;
  errors: string[];
}

interface RawMention {
  platform: string;
  platform_post_id: string;
  author_name: string | null;
  author_handle: string | null;
  content: string;
  engagement_count: number;
  url: string | null;
  posted_at: string | null;
}

// ── Sentiment ────────────────────────────────────────────────────────────────

const SENTIMENT_SYSTEM = `You are a sentiment analysis expert specializing in Indian social media content.
Analyze the sentiment of the provided text. It may be in English, Hindi, Hinglish, Tamil, Telugu, Bengali, Marathi, or other Indian languages.
Return ONLY valid JSON: {"score": <-1.0 to 1.0>, "label": "<positive|negative|neutral|mixed>", "language_detected": "<BCP-47 code>"}`;

async function analyzeSentiment(
  text: string,
): Promise<{
  score: number;
  label: SentimentLabel;
  language_detected: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { score: 0, label: "neutral", language_detected: "en" };

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SENTIMENT_SYSTEM },
        { role: "user", content: `Text: ${text.slice(0, 500)}` },
      ],
      temperature: 0,
      max_tokens: 80,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { score: 0, label: "neutral", language_detected: "en" };

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const score =
      typeof parsed.score === "number"
        ? Math.max(-1, Math.min(1, parsed.score))
        : 0;
    const validLabels: SentimentLabel[] = [
      "positive",
      "negative",
      "neutral",
      "mixed",
    ];
    const label = validLabels.includes(parsed.label as SentimentLabel)
      ? (parsed.label as SentimentLabel)
      : "neutral";
    const language_detected =
      typeof parsed.language_detected === "string"
        ? parsed.language_detected
        : "en";

    return { score, label, language_detected };
  } catch {
    return { score: 0, label: "neutral", language_detected: "en" };
  }
}

// ── Twitter API v2 ────────────────────────────────────────────────────────────

async function fetchTwitterMentions(
  query: Pick<ListeningQuery, "keywords" | "excluded_keywords" | "languages">,
): Promise<RawMention[]> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  if (!bearerToken) return [];

  const terms = query.keywords.join(" OR ");
  const excluded = query.excluded_keywords.map((k) => `-${k}`).join(" ");
  const searchQuery = [terms, excluded, "-is:retweet lang:en OR lang:hi"]
    .filter(Boolean)
    .join(" ");

  try {
    const url = new URL("https://api.twitter.com/2/tweets/search/recent");
    url.searchParams.set("query", searchQuery);
    url.searchParams.set("max_results", "50");
    url.searchParams.set(
      "tweet.fields",
      "created_at,public_metrics,author_id,lang",
    );
    url.searchParams.set("expansions", "author_id");
    url.searchParams.set("user.fields", "name,username");

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });

    if (!response.ok) {
      logger.error("Twitter search API error", { status: response.status });
      return [];
    }

    const data = (await response.json()) as {
      data?: Array<{
        id: string;
        text: string;
        created_at?: string;
        author_id?: string;
        public_metrics?: {
          like_count: number;
          retweet_count: number;
          reply_count: number;
        };
      }>;
      includes?: {
        users?: Array<{ id: string; name: string; username: string }>;
      };
    };

    const userMap = new Map<string, { name: string; username: string }>();
    for (const u of data.includes?.users ?? []) {
      userMap.set(u.id, { name: u.name, username: u.username });
    }

    return (data.data ?? []).map((tweet) => {
      const author = tweet.author_id ? userMap.get(tweet.author_id) : undefined;
      const metrics = tweet.public_metrics;
      return {
        platform: "twitter",
        platform_post_id: tweet.id,
        author_name: author?.name ?? null,
        author_handle: author ? `@${author.username}` : null,
        content: tweet.text,
        engagement_count:
          (metrics?.like_count ?? 0) +
          (metrics?.retweet_count ?? 0) +
          (metrics?.reply_count ?? 0),
        url: author
          ? `https://twitter.com/${author.username}/status/${tweet.id}`
          : null,
        posted_at: tweet.created_at ?? null,
      };
    });
  } catch (err) {
    logger.error("fetchTwitterMentions error", err);
    return [];
  }
}

// ── Instagram hashtag search ─────────────────────────────────────────────────

async function fetchInstagramMentions(
  query: Pick<ListeningQuery, "keywords">,
): Promise<RawMention[]> {
  const accessToken = process.env.META_IG_SEARCH_TOKEN;
  const igUserId = process.env.META_IG_USER_ID;
  if (!accessToken || !igUserId) return [];

  const mentions: RawMention[] = [];

  for (const keyword of query.keywords.slice(0, 5)) {
    const tag = keyword.replace(/^#/, "").replace(/\s+/g, "");
    try {
      // Step 1: get hashtag ID
      const tagRes = await fetch(
        `https://graph.facebook.com/v18.0/ig_hashtag_search?user_id=${igUserId}&q=${encodeURIComponent(tag)}&access_token=${accessToken}`,
      );
      if (!tagRes.ok) continue;
      const tagData = (await tagRes.json()) as { data?: Array<{ id: string }> };
      const hashtagId = tagData.data?.[0]?.id;
      if (!hashtagId) continue;

      // Step 2: fetch recent media for hashtag
      const mediaRes = await fetch(
        `https://graph.facebook.com/v18.0/${hashtagId}/recent_media?user_id=${igUserId}&fields=id,caption,media_type,timestamp,permalink,like_count,comments_count&access_token=${accessToken}`,
      );
      if (!mediaRes.ok) continue;
      const mediaData = (await mediaRes.json()) as {
        data?: Array<{
          id: string;
          caption?: string;
          timestamp?: string;
          permalink?: string;
          like_count?: number;
          comments_count?: number;
        }>;
      };

      for (const item of mediaData.data ?? []) {
        mentions.push({
          platform: "instagram",
          platform_post_id: item.id,
          author_name: null,
          author_handle: null,
          content: item.caption ?? "",
          engagement_count: (item.like_count ?? 0) + (item.comments_count ?? 0),
          url: item.permalink ?? null,
          posted_at: item.timestamp ?? null,
        });
      }
    } catch (err) {
      logger.error("fetchInstagramMentions error", { keyword, err });
    }
  }

  return mentions;
}

// ── Main crawl function ───────────────────────────────────────────────────────

export async function crawlMentionsForQuery(
  queryId: string,
): Promise<{ saved: number; errors: string[] }> {
  const supabase = await createClient();
  const errors: string[] = [];

  const { data: query, error: qErr } = await supabase
    .from("listening_queries")
    .select("*")
    .eq("id", queryId)
    .eq("is_active", true)
    .single();

  if (qErr || !query) {
    return { saved: 0, errors: ["Query not found or inactive"] };
  }

  const typedQuery = query as ListeningQuery;

  const [twitterMentions, instagramMentions] = await Promise.all([
    typedQuery.platforms.includes("twitter")
      ? fetchTwitterMentions(typedQuery)
      : Promise.resolve([]),
    typedQuery.platforms.includes("instagram")
      ? fetchInstagramMentions(typedQuery)
      : Promise.resolve([]),
  ]);

  const allMentions = [...twitterMentions, ...instagramMentions];

  // Deduplicate against already-stored mentions
  const { data: existing } = await supabase
    .from("listening_mentions")
    .select("platform_post_id, platform")
    .eq("query_id", queryId)
    .in(
      "platform_post_id",
      allMentions.map((m) => m.platform_post_id),
    );

  const existingSet = new Set(
    (existing ?? []).map((e) => `${e.platform}:${e.platform_post_id}`),
  );
  const newMentions = allMentions.filter(
    (m) => !existingSet.has(`${m.platform}:${m.platform_post_id}`),
  );

  if (newMentions.length === 0) return { saved: 0, errors };

  // Analyze sentiment for each new mention
  const enriched: Omit<ListeningMention, "id" | "fetched_at">[] =
    await Promise.all(
      newMentions.map(async (m) => {
        const sentiment = m.content
          ? await analyzeSentiment(m.content)
          : {
              score: 0,
              label: "neutral" as SentimentLabel,
              language_detected: "en",
            };
        return {
          query_id: queryId,
          platform: m.platform,
          platform_post_id: m.platform_post_id,
          author_name: m.author_name,
          author_handle: m.author_handle,
          content: m.content,
          sentiment_score: sentiment.score,
          sentiment_label: sentiment.label,
          language_detected: sentiment.language_detected,
          engagement_count: m.engagement_count,
          url: m.url,
          posted_at: m.posted_at,
        };
      }),
    );

  const { error: insertErr } = await supabase
    .from("listening_mentions")
    .insert(enriched);
  if (insertErr) {
    errors.push(`Insert error: ${insertErr.message}`);
    return { saved: 0, errors };
  }

  return { saved: enriched.length, errors };
}

export async function crawlAllActiveQueries(): Promise<CrawlResult> {
  const supabase = await createClient();

  const { data: queries, error } = await supabase
    .from("listening_queries")
    .select("id")
    .eq("is_active", true);

  if (error) {
    return { queried: 0, mentionsSaved: 0, errors: [error.message] };
  }

  const allErrors: string[] = [];
  let totalSaved = 0;

  for (const q of queries ?? []) {
    const result = await crawlMentionsForQuery(q.id);
    totalSaved += result.saved;
    allErrors.push(...result.errors);
  }

  return {
    queried: (queries ?? []).length,
    mentionsSaved: totalSaved,
    errors: allErrors,
  };
}
