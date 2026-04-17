"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n";

const OverviewDashboard = dynamic(
  () =>
    import("@/components/analytics/OverviewDashboard").then(
      (m) => m.OverviewDashboard,
    ),
  { loading: () => <Skeleton className="h-96 w-full" />, ssr: false },
);

export default function AnalyticsPage() {
  const locale = "en";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("analytics.title", locale)}</h1>
        <p className="text-muted-foreground">
          {t("analytics.description", locale)}
        </p>
      </div>
      <OverviewDashboard />
    </div>
  );
}
