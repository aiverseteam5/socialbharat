import { OverviewDashboard } from "@/components/analytics/OverviewDashboard";
import { t, getLocale } from "@/lib/i18n";

export default function AnalyticsPage() {
  const locale = getLocale();
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
