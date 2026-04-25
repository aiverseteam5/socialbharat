"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { t, getLocale } from "@/lib/i18n";
import { logger } from "@/lib/logger";

interface ListeningQuery {
  id: string;
  name: string;
  keywords: string[];
  platforms: string[];
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

function MentionCard({ mention }: { mention: Mention }) {
  const postedAt = mention.posted_at
    ? new Date(mention.posted_at).toLocaleString("en-IN")
    : null;
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono">
            {PLATFORM_ICONS[mention.platform] ?? mention.platform}
          </span>
          {mention.author_name && (
            <span className="text-sm font-medium">{mention.author_name}</span>
          )}
          {mention.author_handle && (
            <span className="text-xs text-muted-foreground">
              {mention.author_handle}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SentimentBadge label={mention.sentiment_label} />
          {postedAt && (
            <span className="text-xs text-muted-foreground">{postedAt}</span>
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
        <p className="text-sm text-foreground line-clamp-3">
          {mention.content}
        </p>
      )}
    </div>
  );
}

function SentimentDonut({
  dist,
}: {
  dist: TrendData["sentiment_distribution"];
}) {
  const total = dist.positive + dist.negative + dist.neutral + dist.mixed;
  if (total === 0)
    return (
      <p className="text-sm text-muted-foreground">
        {t("listening.no_data", getLocale())}
      </p>
    );

  const pct = (n: number) => (total > 0 ? ((n / total) * 100).toFixed(1) : "0");

  return (
    <div className="space-y-2">
      {(["positive", "negative", "neutral", "mixed"] as const).map((label) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${label === "positive" ? "bg-emerald-500" : label === "negative" ? "bg-red-500" : label === "mixed" ? "bg-yellow-500" : "bg-gray-400"}`}
          />
          <span className="text-sm capitalize w-16">{label}</span>
          <div className="flex-1 bg-muted rounded-full h-2">
            <div
              className={`h-2 rounded-full ${label === "positive" ? "bg-emerald-500" : label === "negative" ? "bg-red-500" : label === "mixed" ? "bg-yellow-500" : "bg-gray-400"}`}
              style={{ width: `${pct(dist[label])}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-12 text-right">
            {pct(dist[label])}%
          </span>
        </div>
      ))}
    </div>
  );
}

function VolumeChart({ series }: { series: TrendData["time_series"] }) {
  if (series.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        {t("listening.no_data", getLocale())}
      </p>
    );

  const max = Math.max(...series.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-24">
      {series.map((day) => (
        <div
          key={day.date}
          className="flex-1 flex flex-col items-center gap-1 group relative"
        >
          <div className="hidden group-hover:block absolute bottom-full mb-1 text-xs bg-popover border rounded px-1 py-0.5 whitespace-nowrap z-10">
            {day.date}: {day.count} mentions
          </div>
          <div
            className="w-full bg-blue-500 rounded-t"
            style={{
              height: `${(day.count / max) * 80}px`,
              minHeight: day.count > 0 ? "4px" : "0",
            }}
          />
        </div>
      ))}
    </div>
  );
}

function KeywordCloud({ keywords }: { keywords: TrendData["top_keywords"] }) {
  if (keywords.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        {t("listening.no_data", getLocale())}
      </p>
    );
  const maxCount = Math.max(...keywords.map((k) => k.count), 1);
  return (
    <div className="flex flex-wrap gap-2">
      {keywords.map(({ keyword, count }) => {
        const size = 12 + Math.round((count / maxCount) * 12);
        return (
          <span
            key={keyword}
            className="text-blue-700 cursor-default"
            style={{ fontSize: `${size}px` }}
          >
            {keyword}
          </span>
        );
      })}
    </div>
  );
}

export default function ListeningPage() {
  const locale = getLocale();
  const [queries, setQueries] = useState<ListeningQuery[]>([]);
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [loadingQueries, setLoadingQueries] = useState(true);
  const [loadingMentions, setLoadingMentions] = useState(false);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [form, setForm] = useState({
    name: "",
    keywords: "",
    excluded_keywords: "",
    platforms: "twitter,instagram",
    languages: "en,hi",
  });

  const loadQueries = useCallback(async () => {
    setLoadingQueries(true);
    try {
      const res = await fetch("/api/listening/queries");
      if (!res.ok) throw new Error("Failed to load queries");
      const data = (await res.json()) as { queries: ListeningQuery[] };
      const fetchedQueries = data.queries ?? [];
      setQueries(fetchedQueries);
      if (!selectedQueryId && fetchedQueries.length > 0) {
        setSelectedQueryId(fetchedQueries[0]!.id);
      }
    } catch (err) {
      logger.error("loadQueries error", err);
    } finally {
      setLoadingQueries(false);
    }
  }, [selectedQueryId]);

  useEffect(() => {
    void loadQueries();
  }, [loadQueries]);

  useEffect(() => {
    if (!selectedQueryId) return;

    const loadMentions = async () => {
      setLoadingMentions(true);
      try {
        const res = await fetch(
          `/api/listening/queries/${selectedQueryId}/results?page_size=50`,
        );
        if (!res.ok) throw new Error("Failed to load mentions");
        const data = (await res.json()) as { mentions: Mention[] };
        setMentions(data.mentions ?? []);
      } catch (err) {
        logger.error("loadMentions error", err);
      } finally {
        setLoadingMentions(false);
      }
    };

    const loadTrends = async () => {
      setLoadingTrends(true);
      try {
        const res = await fetch(
          `/api/listening/trends?query_id=${selectedQueryId}&days=30`,
        );
        if (!res.ok) throw new Error("Failed to load trends");
        const data = (await res.json()) as TrendData;
        setTrends(data);
      } catch (err) {
        logger.error("loadTrends error", err);
      } finally {
        setLoadingTrends(false);
      }
    };

    void loadMentions();
    void loadTrends();
  }, [selectedQueryId]);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/listening/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          keywords: form.keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
          excluded_keywords: form.excluded_keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
          platforms: form.platforms
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean),
          languages: form.languages
            .split(",")
            .map((l) => l.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error ?? "Failed to create query");
      }
      setCreateOpen(false);
      setForm({
        name: "",
        keywords: "",
        excluded_keywords: "",
        platforms: "twitter,instagram",
        languages: "en,hi",
      });
      await loadQueries();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create query",
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full gap-4">
      {/* Sidebar */}
      <div className="w-64 shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t("listening.queries", locale)}
          </h2>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            {t("listening.create_query", locale)}
          </Button>
        </div>

        {loadingQueries ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : queries.length === 0 ? (
          <div className="text-sm text-muted-foreground p-4 border rounded-lg text-center">
            {t("listening.no_queries", locale)}
          </div>
        ) : (
          <div className="space-y-1">
            {queries.map((q) => (
              <button
                key={q.id}
                onClick={() => setSelectedQueryId(q.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedQueryId === q.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                <div className="font-medium truncate">{q.name}</div>
                <div className="text-xs opacity-70 truncate">
                  {q.keywords.slice(0, 3).join(", ")}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 min-w-0 space-y-4">
        {!selectedQueryId ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            {t("listening.select_query", locale)}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">
                {queries.find((q) => q.id === selectedQueryId)?.name ??
                  t("listening.title", locale)}
              </h1>
              <Link href={`/listening/queries/${selectedQueryId}`}>
                <Button variant="outline" size="sm">
                  {t("listening.view_details", locale)}
                </Button>
              </Link>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {t("listening.sentiment_breakdown", locale)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingTrends ? (
                    <Skeleton className="h-24 w-full" />
                  ) : trends ? (
                    <SentimentDonut dist={trends.sentiment_distribution} />
                  ) : null}
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {t("listening.volume_over_time", locale)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingTrends ? (
                    <Skeleton className="h-24 w-full" />
                  ) : trends ? (
                    <VolumeChart series={trends.time_series} />
                  ) : null}
                </CardContent>
              </Card>
            </div>

            {/* Keywords cloud */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {t("listening.trending_keywords", locale)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingTrends ? (
                  <Skeleton className="h-12 w-full" />
                ) : trends ? (
                  <KeywordCloud keywords={trends.top_keywords} />
                ) : null}
              </CardContent>
            </Card>

            {/* Mentions feed */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  {t("listening.mentions_feed", locale)}
                  {trends && (
                    <Badge variant="secondary">
                      {trends.total_mentions} {t("listening.total", locale)}
                    </Badge>
                  )}
                </CardTitle>
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
                  mentions.map((m) => <MentionCard key={m.id} mention={m} />)
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Create Query Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("listening.create_query", locale)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="query-name">
                {t("listening.query_name", locale)}
              </Label>
              <Input
                id="query-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder={t("listening.query_name_placeholder", locale)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="keywords">
                {t("listening.keywords", locale)}
              </Label>
              <Input
                id="keywords"
                value={form.keywords}
                onChange={(e) =>
                  setForm((f) => ({ ...f, keywords: e.target.value }))
                }
                placeholder={t("listening.keywords_placeholder", locale)}
              />
              <p className="text-xs text-muted-foreground">
                {t("listening.keywords_hint", locale)}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="excluded">
                {t("listening.excluded_keywords", locale)}
              </Label>
              <Input
                id="excluded"
                value={form.excluded_keywords}
                onChange={(e) =>
                  setForm((f) => ({ ...f, excluded_keywords: e.target.value }))
                }
                placeholder={t("listening.excluded_placeholder", locale)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="platforms">
                  {t("listening.platforms", locale)}
                </Label>
                <Input
                  id="platforms"
                  value={form.platforms}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, platforms: e.target.value }))
                  }
                  placeholder="twitter,instagram"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="languages">
                  {t("listening.languages", locale)}
                </Label>
                <Input
                  id="languages"
                  value={form.languages}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, languages: e.target.value }))
                  }
                  placeholder="en,hi"
                />
              </div>
            </div>
            {createError && (
              <p className="text-sm text-red-600">{createError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("common.cancel", locale)}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !form.name || !form.keywords}
            >
              {creating
                ? t("common.creating", locale)
                : t("common.create", locale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
