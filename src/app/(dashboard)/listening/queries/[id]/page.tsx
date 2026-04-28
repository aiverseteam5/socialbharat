"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { t, getLocale } from "@/lib/i18n";
import { logger } from "@/lib/logger";

interface ListeningQuery {
  id: string;
  name: string;
  keywords: string[];
  excluded_keywords: string[];
  platforms: string[];
  languages: string[];
  is_active: boolean;
  created_at: string;
}

interface Mention {
  id: string;
  platform: string;
  author_name: string | null;
  author_handle: string | null;
  content: string | null;
  sentiment_label: "positive" | "negative" | "neutral" | "mixed" | null;
  sentiment_score: number | null;
  url: string | null;
  posted_at: string | null;
  engagement_count: number;
}

interface TrendData {
  time_series: Array<{
    date: string;
    count: number;
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  }>;
  top_keywords: Array<{ keyword: string; count: number }>;
  sentiment_distribution: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  };
  total_mentions: number;
  spikes: string[];
}

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  created_at: string;
  is_read: boolean;
}

interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-800",
  negative: "bg-red-100 text-red-800",
  neutral: "bg-gray-100 text-gray-800",
  mixed: "bg-yellow-100 text-yellow-800",
};

const PLATFORM_ICONS: Record<string, string> = {
  twitter: "𝕏",
  instagram: "📸",
  facebook: "f",
  youtube: "▶",
};

function SentimentBadge({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SENTIMENT_COLORS[label] ?? "bg-gray-100 text-gray-800"}`}
    >
      {label}
    </span>
  );
}

export default function QueryDetailPage() {
  const params = useParams();
  const queryId = params.id as string;
  const locale = getLocale();

  const [query, setQuery] = useState<ListeningQuery | null>(null);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [alerts] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMentions, setLoadingMentions] = useState(false);

  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const loadQuery = useCallback(async () => {
    try {
      const res = await fetch(`/api/listening/queries/${queryId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { query: ListeningQuery };
      setQuery(data.query);
    } catch (err) {
      logger.error("loadQuery error", err);
    }
  }, [queryId]);

  const loadMentions = useCallback(async () => {
    setLoadingMentions(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: "25",
      });
      if (sentimentFilter !== "all") params.set("sentiment", sentimentFilter);
      if (platformFilter !== "all") params.set("platform", platformFilter);

      const res = await fetch(
        `/api/listening/queries/${queryId}/results?${params.toString()}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        mentions: Mention[];
        pagination: Pagination;
      };
      setMentions(data.mentions ?? []);
      setPagination(data.pagination);
    } catch (err) {
      logger.error("loadMentions error", err);
    } finally {
      setLoadingMentions(false);
    }
  }, [queryId, page, sentimentFilter, platformFilter]);

  const loadTrends = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/listening/trends?query_id=${queryId}&days=30`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as TrendData;
      setTrends(data);
    } catch (err) {
      logger.error("loadTrends error", err);
    }
  }, [queryId]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadQuery(), loadMentions(), loadTrends()]);
      setLoading(false);
    };
    void init();
  }, [loadQuery, loadMentions, loadTrends]);

  useEffect(() => {
    void loadMentions();
  }, [loadMentions]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!query) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {t("listening.query_not_found", locale)}
        </p>
        <Link href="/listening">
          <Button variant="outline" className="mt-4">
            {t("listening.back_to_listening", locale)}
          </Button>
        </Link>
      </div>
    );
  }

  const sentimentDist = trends?.sentiment_distribution ?? {
    positive: 0,
    negative: 0,
    neutral: 0,
    mixed: 0,
  };
  const total =
    sentimentDist.positive +
    sentimentDist.negative +
    sentimentDist.neutral +
    sentimentDist.mixed;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/listening"
              className="text-sm text-muted-foreground hover:underline"
            >
              {t("listening.title", locale)}
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium">{query.name}</span>
          </div>
          <h1 className="text-2xl font-bold">{query.name}</h1>
          <div className="flex flex-wrap gap-1 mt-2">
            {query.keywords.map((k) => (
              <Badge key={k} variant="secondary">
                {k}
              </Badge>
            ))}
            {!query.is_active && (
              <Badge variant="destructive">
                {t("listening.inactive", locale)}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">
            {trends?.total_mentions ?? 0} {t("listening.mentions", locale)}
          </Badge>
        </div>
      </div>

      {/* Crisis alerts */}
      {alerts.filter((a) => a.type === "crisis_alert").length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-800">
              ⚠️ {t("listening.crisis_alerts", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts
              .filter((a) => a.type === "crisis_alert")
              .map((a) => (
                <div key={a.id} className="text-sm text-red-700">
                  <span className="font-medium">
                    {new Date(a.created_at).toLocaleString("en-IN")}
                  </span>
                  : {a.body}
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Sentiment + Volume */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {t("listening.sentiment_breakdown", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(["positive", "negative", "neutral", "mixed"] as const).map(
              (label) => {
                const count = sentimentDist[label];
                const pct =
                  total > 0 ? ((count / total) * 100).toFixed(1) : "0";
                return (
                  <div key={label} className="flex items-center gap-2 mb-2">
                    <div
                      className={`w-3 h-3 rounded-full ${label === "positive" ? "bg-emerald-500" : label === "negative" ? "bg-red-500" : label === "mixed" ? "bg-yellow-500" : "bg-gray-400"}`}
                    />
                    <span className="text-sm capitalize w-16">{label}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${label === "positive" ? "bg-emerald-500" : label === "negative" ? "bg-red-500" : label === "mixed" ? "bg-yellow-500" : "bg-gray-400"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs w-16 text-right">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              },
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {t("listening.volume_over_time", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trends && trends.time_series.length > 0 ? (
              <div className="flex items-end gap-0.5 h-28">
                {trends.time_series.map((day) => {
                  const max = Math.max(
                    ...trends.time_series.map((d) => d.count),
                    1,
                  );
                  return (
                    <div
                      key={day.date}
                      className="flex-1 flex flex-col items-center group relative"
                    >
                      <div className="hidden group-hover:block absolute bottom-full mb-1 text-xs bg-popover border rounded px-1 py-0.5 whitespace-nowrap z-10">
                        {day.date}: {day.count}
                      </div>
                      <div
                        className={`w-full rounded-t ${trends.spikes?.includes(day.date) ? "bg-red-500" : "bg-blue-500"}`}
                        style={{
                          height: `${(day.count / max) * 96}px`,
                          minHeight: day.count > 0 ? "4px" : "0",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("listening.no_data", locale)}
              </p>
            )}
            {trends?.spikes && trends.spikes.length > 0 && (
              <p className="text-xs text-red-600 mt-2">
                ⚠️ {t("listening.spikes_detected", locale)}:{" "}
                {trends.spikes.join(", ")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mentions with filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm">
              {t("listening.mentions_feed", locale)}
            </CardTitle>
            <div className="flex gap-2">
              <Select
                value={sentimentFilter}
                onValueChange={(v) => {
                  setSentimentFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue
                    placeholder={t("listening.filter_sentiment", locale)}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("listening.all_sentiments", locale)}
                  </SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={platformFilter}
                onValueChange={(v) => {
                  setPlatformFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue
                    placeholder={t("listening.filter_platform", locale)}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("listening.all_platforms", locale)}
                  </SelectItem>
                  <SelectItem value="twitter">Twitter / X</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingMentions ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : mentions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("listening.no_mentions", locale)}
            </p>
          ) : (
            mentions.map((mention) => (
              <div key={mention.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono">
                      {PLATFORM_ICONS[mention.platform] ?? mention.platform}
                    </span>
                    {mention.author_name && (
                      <span className="text-sm font-medium">
                        {mention.author_name}
                      </span>
                    )}
                    {mention.author_handle && (
                      <span className="text-xs text-muted-foreground">
                        {mention.author_handle}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <SentimentBadge label={mention.sentiment_label} />
                    {mention.engagement_count > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ♥ {mention.engagement_count}
                      </span>
                    )}
                    {mention.posted_at && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(mention.posted_at).toLocaleString("en-IN")}
                      </span>
                    )}
                    {mention.url && (
                      <a
                        href={mention.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View
                      </a>
                    )}
                  </div>
                </div>
                {mention.content && (
                  <p className="text-sm">{mention.content}</p>
                )}
              </div>
            ))
          )}

          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1 || loadingMentions}
              >
                {t("common.previous", locale)}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t("common.page", locale)} {page} / {pagination.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= pagination.total_pages || loadingMentions}
              >
                {t("common.next", locale)}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
