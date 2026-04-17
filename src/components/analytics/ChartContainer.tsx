"use client";

import { t, getLocale } from "@/lib/i18n";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ChartType = "line" | "bar" | "area" | "pie";

export interface ChartSeriesConfig {
  key: string;
  name?: string;
  color?: string;
}

export interface ChartContainerProps<T extends Record<string, unknown>> {
  data: T[];
  type: ChartType;
  xKey: string;
  series: ChartSeriesConfig[];
  height?: number;
}

const PALETTE = [
  "#f97316",
  "#16a34a",
  "#2563eb",
  "#a855f7",
  "#e11d48",
  "#0ea5e9",
];

export function ChartContainer<T extends Record<string, unknown>>({
  data,
  type,
  xKey,
  series,
  height = 280,
}: ChartContainerProps<T>) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center border border-dashed rounded-md text-sm text-muted-foreground"
        style={{ height }}
      >
        {t("analytics.no_data", getLocale())}
      </div>
    );
  }

  if (type === "pie") {
    const first = series[0];
    if (!first) return null;
    const pieData = data.map((d, i) => ({
      name: String(d[xKey] ?? ""),
      value: Number(d[first.key] ?? 0),
      color: PALETTE[i % PALETTE.length],
    }));
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Tooltip />
          <Legend />
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="80%"
          >
            {pieData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey={xKey} stroke="#64748b" fontSize={12} />
          <YAxis stroke="#64748b" fontSize={12} />
          <Tooltip />
          <Legend />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name ?? s.key}
              fill={s.color ?? PALETTE[i % PALETTE.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === "area") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={data}
          margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey={xKey} stroke="#64748b" fontSize={12} />
          <YAxis stroke="#64748b" fontSize={12} />
          <Tooltip />
          <Legend />
          {series.map((s, i) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name ?? s.key}
              stroke={s.color ?? PALETTE[i % PALETTE.length]}
              fill={s.color ?? PALETTE[i % PALETTE.length]}
              fillOpacity={0.2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey={xKey} stroke="#64748b" fontSize={12} />
        <YAxis stroke="#64748b" fontSize={12} />
        <Tooltip />
        <Legend />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name ?? s.key}
            stroke={s.color ?? PALETTE[i % PALETTE.length]}
            dot={false}
            strokeWidth={2}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
