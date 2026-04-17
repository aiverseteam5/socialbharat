"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ANALYTICS_METRIC_KEYS } from "@/types/schemas";
import { logger } from "@/lib/logger";
import { t, getLocale } from "@/lib/i18n";

interface ProfileOption {
  id: string;
  platform: string;
  profile_name: string | null;
}

interface PreviewRow {
  metric_date: string;
  followers_count: number;
  impressions: number;
  reach: number;
  engagements: number;
  engagement_rate: number;
  clicks: number;
  shares: number;
  comments: number;
  likes: number;
}

const METRIC_LABELS: Record<(typeof ANALYTICS_METRIC_KEYS)[number], string> = {
  followers_count: t("analytics.followers", getLocale()),
  impressions: t("analytics.impressions", getLocale()),
  reach: t("analytics.reach", getLocale()),
  engagements: t("analytics.engagements", getLocale()),
  engagement_rate: t("analytics.engagement_rate", getLocale()),
  clicks: t("analytics.clicks", getLocale()),
  shares: t("analytics.shares", getLocale()),
  comments: t("analytics.comments", getLocale()),
  likes: t("analytics.likes", getLocale()),
};

function defaultDate(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export interface ReportBuilderProps {
  onSaved?: () => void;
}

export function ReportBuilder({ onSaved }: ReportBuilderProps) {
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [name, setName] = useState("");
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    "followers_count",
    "impressions",
    "engagement_rate",
  ]);
  const [startDate, setStartDate] = useState(defaultDate(29));
  const [endDate, setEndDate] = useState(defaultDate(0));
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/connectors/profiles")
      .then((r) => r.json())
      .then((data) => setProfiles(data.profiles ?? []))
      .catch((err) => logger.error("Load profiles failed", err));
  }, []);

  const toggleProfile = (id: string) => {
    setSelectedProfileIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleMetric = (key: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  };

  const loadPreview = async () => {
    if (selectedProfileIds.length === 0) {
      setPreview([]);
      return;
    }
    setLoadingPreview(true);
    try {
      const firstId = selectedProfileIds[0];
      if (!firstId) {
        setPreview([]);
        return;
      }
      const qs = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      }).toString();
      const res = await fetch(
        `/api/analytics/profiles/${firstId}/metrics?${qs}`,
      );
      const data = await res.json();
      setPreview(data.series ?? []);
    } catch (err) {
      logger.error("Load preview failed", err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const save = async () => {
    setError(null);
    if (!name.trim()) {
      setError(t("analytics.report_name_required", getLocale()));
      return;
    }
    if (selectedProfileIds.length === 0) {
      setError(t("analytics.select_one_profile", getLocale()));
      return;
    }
    if (selectedMetrics.length === 0) {
      setError(t("analytics.select_one_metric", getLocale()));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/analytics/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          profile_ids: selectedProfileIds,
          metrics: selectedMetrics,
          start_date: startDate,
          end_date: endDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save report");
      }
      setName("");
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save report");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("analytics.build_report", getLocale())}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="report-name">
            {t("analytics.report_name", getLocale())}
          </Label>
          <Input
            id="report-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("analytics.report_name_placeholder", getLocale())}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="start-date">
              {t("analytics.start_date", getLocale())}
            </Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end-date">
              {t("analytics.end_date", getLocale())}
            </Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("analytics.profiles_label", getLocale())}</Label>
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("analytics.connect_profile", getLocale())}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {profiles.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 p-2 border rounded-md cursor-pointer"
                >
                  <Checkbox
                    checked={selectedProfileIds.includes(p.id)}
                    onCheckedChange={() => toggleProfile(p.id)}
                  />
                  <span className="text-sm">
                    {p.profile_name ?? p.platform}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({p.platform})
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>{t("analytics.metrics_label", getLocale())}</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ANALYTICS_METRIC_KEYS.map((key) => (
              <label
                key={key}
                className="flex items-center gap-2 p-2 border rounded-md cursor-pointer"
              >
                <Checkbox
                  checked={selectedMetrics.includes(key)}
                  onCheckedChange={() => toggleMetric(key)}
                />
                <span className="text-sm">{METRIC_LABELS[key]}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={loadPreview}
            disabled={loadingPreview || selectedProfileIds.length === 0}
          >
            {loadingPreview
              ? t("analytics.previewing", getLocale())
              : t("analytics.preview", getLocale())}
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving
              ? t("analytics.saving_report", getLocale())
              : t("analytics.save_report", getLocale())}
          </Button>
        </div>

        {preview.length > 0 && (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("analytics.date", getLocale())}</TableHead>
                  {selectedMetrics.map((m) => (
                    <TableHead key={m}>
                      {METRIC_LABELS[m as keyof typeof METRIC_LABELS] ?? m}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.slice(0, 10).map((row) => (
                  <TableRow key={row.metric_date}>
                    <TableCell>{row.metric_date}</TableCell>
                    {selectedMetrics.map((m) => (
                      <TableCell key={m}>
                        {String(row[m as keyof PreviewRow] ?? 0)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {preview.length > 10 && (
              <p className="p-3 text-xs text-muted-foreground border-t">
                {t("analytics.showing_rows", getLocale())
                  .replace("{n}", "10")
                  .replace("{total}", String(preview.length))}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
