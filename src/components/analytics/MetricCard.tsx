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
  accentColor?: string;
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
  if (format === "percent") return `${Number(value ?? 0).toFixed(2)}%`;
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
  accentColor = "bg-brand-500",
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
      ? "text-emerald-600 bg-emerald-50"
      : direction === "down"
        ? "text-red-500 bg-red-50"
        : "text-slate-400 bg-slate-50";

  return (
    <Card className="relative overflow-hidden shadow-card hover:shadow-card-hover transition-shadow duration-200">
      {/* Left accent bar */}
      <span className={cn("absolute left-0 top-0 bottom-0 w-1", accentColor)} />
      <CardContent className="pl-6 pr-5 py-5 space-y-2">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-900 tabular-nums">
            {formatValue(value, format)}
          </span>
          {suffix && <span className="text-sm text-slate-400">{suffix}</span>}
        </div>
        {change !== null && (
          <div
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5",
              trendColor,
            )}
          >
            <TrendIcon className="h-3 w-3" />
            <span>
              {change > 0 ? "+" : ""}
              {change.toFixed(1)}%{" "}
              <span className="font-normal opacity-70">
                {t("analytics.vs_previous_period", getLocale())}
              </span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
