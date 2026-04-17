"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MetricCard } from "./MetricCard";
import { ChartContainer } from "./ChartContainer";
import { logger } from "@/lib/logger";
import { t, getLocale } from "@/lib/i18n";

interface OverviewTotals {
  followers: number;
  impressions: number;
  reach: number;
  engagements: number;
  clicks: number;
  engagement_rate: number;
}

interface TopPost {
  post_id: string;
  content: string;
  published_at: string | null;
  impressions: number;
  engagements: number;
  likes: number;
  comments: number;
  shares: number;
}

interface OverviewResponse {
  range: { start: string; end: string };
  totals: OverviewTotals;
  previous: OverviewTotals;
  top_posts: TopPost[];
  profile_count: number;
}

interface SeriesPoint {
  metric_date: string;
  followers_count: number;
  engagements: number;
  impressions: number;
  reach: number;
}

interface ProfileOption {
  id: string;
  platform: string;
  profile_name: string | null;
}

const RANGE_OPTIONS: Array<{ label: string; days: number }> = [
  { label: t("analytics.last_7_days", getLocale()), days: 7 },
  { label: t("analytics.last_30_days", getLocale()), days: 30 },
  { label: t("analytics.last_90_days", getLocale()), days: 90 },
];

function rangeToParams(days: number) {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return {
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  };
}

export function OverviewDashboard() {
  const [rangeDays, setRangeDays] = useState(30);
  const [profileId, setProfileId] = useState<string>("all");
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/connectors/profiles")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setProfiles(data.profiles ?? []);
      })
      .catch((err) => {
        logger.error("Failed to load profiles for analytics", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = rangeToParams(rangeDays);
    const qs = new URLSearchParams(params).toString();

    const overviewUrl = `/api/analytics/overview?${qs}`;
    const seriesUrl =
      profileId === "all"
        ? null
        : `/api/analytics/profiles/${profileId}/metrics?${qs}`;

    Promise.all([
      fetch(overviewUrl).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error("Failed to load overview")),
      ),
      seriesUrl
        ? fetch(seriesUrl).then((r) =>
            r.ok
              ? r.json()
              : Promise.reject(new Error("Failed to load profile series")),
          )
        : Promise.resolve({ series: [] }),
    ])
      .then(([overviewData, seriesData]) => {
        if (cancelled) return;
        setOverview(overviewData);
        setSeries(seriesData.series ?? []);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rangeDays, profileId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-red-600">
          {error ?? t("analytics.unable_to_load", getLocale())}
        </CardContent>
      </Card>
    );
  }

  const seriesForGrowth = series.length > 0 ? series : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <Select value={profileId} onValueChange={(v) => setProfileId(v)}>
            <SelectTrigger className="w-[240px]">
              <SelectValue
                placeholder={t("analytics.all_profiles", getLocale())}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("analytics.all_profiles", getLocale())}
              </SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.profile_name ?? p.platform} ({p.platform})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(rangeDays)}
            onValueChange={(v) => setRangeDays(parseInt(v, 10))}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.days} value={String(opt.days)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          {overview.range.start} → {overview.range.end} ·{" "}
          {overview.profile_count} profile
          {overview.profile_count === 1 ? "" : "s"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label={t("analytics.followers", getLocale())}
          value={overview.totals.followers}
          previousValue={overview.previous.followers}
        />
        <MetricCard
          label={t("analytics.impressions", getLocale())}
          value={overview.totals.impressions}
          previousValue={overview.previous.impressions}
        />
        <MetricCard
          label={t("analytics.engagement_rate", getLocale())}
          value={overview.totals.engagement_rate}
          previousValue={overview.previous.engagement_rate}
          format="percent"
        />
        <MetricCard
          label={t("analytics.reach", getLocale())}
          value={overview.totals.reach}
          previousValue={overview.previous.reach}
        />
        <MetricCard
          label={t("analytics.clicks", getLocale())}
          value={overview.totals.clicks}
          previousValue={overview.previous.clicks}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("analytics.followers_growth", getLocale())}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              data={seriesForGrowth as unknown as Record<string, unknown>[]}
              type="line"
              xKey="metric_date"
              series={[
                {
                  key: "followers_count",
                  name: t("analytics.followers", getLocale()),
                  color: "#2563eb",
                },
              ]}
            />
            {seriesForGrowth.length === 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                {t("analytics.pick_profile", getLocale())}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("analytics.engagement_chart", getLocale())}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              data={seriesForGrowth as unknown as Record<string, unknown>[]}
              type="bar"
              xKey="metric_date"
              series={[
                {
                  key: "engagements",
                  name: t("analytics.engagements", getLocale()),
                  color: "#f97316",
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("analytics.top_posts", getLocale())}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overview.top_posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("analytics.no_post_metrics", getLocale())}
            </p>
          ) : (
            <ul className="space-y-3">
              {overview.top_posts.map((post) => (
                <li
                  key={post.post_id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b last:border-b-0 pb-3 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{post.content}</p>
                    {post.published_at && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(post.published_at).toLocaleDateString(
                          "en-IN",
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>
                      Impr. {post.impressions.toLocaleString("en-IN")}
                    </span>
                    <span>Eng. {post.engagements.toLocaleString("en-IN")}</span>
                    <span>♥ {post.likes.toLocaleString("en-IN")}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
