"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReportBuilder } from "@/components/analytics/ReportBuilder";
import { logger } from "@/lib/logger";
import { t, getLocale } from "@/lib/i18n";

interface SavedReport {
  id: string;
  name: string;
  profile_ids: string[];
  metrics: string[];
  start_date: string;
  end_date: string;
  created_at: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics/reports");
      const data = await res.json();
      setReports(data.reports ?? []);
    } catch (err) {
      logger.error("Load reports failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          {t("analytics.reports_title", getLocale())}
        </h1>
        <p className="text-muted-foreground">
          {t("analytics.reports_description", getLocale())}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("analytics.saved_reports", getLocale())}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">
              {t("analytics.loading_reports", getLocale())}
            </p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("analytics.no_reports", getLocale())}
            </p>
          ) : (
            <ul className="divide-y">
              {reports.map((report) => (
                <li
                  key={report.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{report.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {report.start_date} → {report.end_date} ·{" "}
                      {report.profile_ids.length} profile
                      {report.profile_ids.length === 1 ? "" : "s"} ·{" "}
                      {report.metrics.length} metric
                      {report.metrics.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={`/api/analytics/reports/${report.id}/export?format=csv`}
                      >
                        CSV
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={`/api/analytics/reports/${report.id}/export?format=json`}
                      >
                        JSON
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={`/api/analytics/reports/${report.id}/export?format=html`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        HTML
                      </a>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ReportBuilder onSaved={load} />
    </div>
  );
}
