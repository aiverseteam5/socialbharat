import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { t, getLocale } from "@/lib/i18n";

export interface MetricCardProps {
  label: string;
  value: number;
  previousValue?: number;
  format?: "number" | "percent";
  suffix?: string;
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return Math.round(n).toLocaleString("en-IN");
}

function formatValue(value: number, format: "number" | "percent"): string {
  if (format === "percent") {
    return `${Number(value ?? 0).toFixed(2)}%`;
  }
  return formatNumber(value);
}

function percentChange(current: number, previous?: number): number | null {
  if (previous === undefined || previous === null) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function MetricCard({
  label,
  value,
  previousValue,
  format = "number",
  suffix,
}: MetricCardProps) {
  const change = percentChange(value, previousValue);
  const direction =
    change === null || change === 0 ? "flat" : change > 0 ? "up" : "down";

  const TrendIcon =
    direction === "up"
      ? ArrowUpRight
      : direction === "down"
        ? ArrowDownRight
        : Minus;

  const trendColor =
    direction === "up"
      ? "text-green-600"
      : direction === "down"
        ? "text-red-600"
        : "text-muted-foreground";

  return (
    <Card>
      <CardContent className="p-5 space-y-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold">
            {formatValue(value, format)}
          </span>
          {suffix && (
            <span className="text-sm text-muted-foreground">{suffix}</span>
          )}
        </div>
        {change !== null && (
          <div className={cn("flex items-center gap-1 text-xs", trendColor)}>
            <TrendIcon className="h-3.5 w-3.5" />
            <span>
              {change > 0 ? "+" : ""}
              {change.toFixed(1)}%{" "}
              {t("analytics.vs_previous_period", getLocale())}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
