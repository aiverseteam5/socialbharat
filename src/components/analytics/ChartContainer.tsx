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

/* Brand-aligned palette */
const PALETTE = [
  "#FF6B00" /* brand saffron */,
  "#1a1a2e" /* brand dark */,
  "#3b82f6" /* blue */,
  "#10b981" /* emerald */,
  "#f59e0b" /* amber */,
  "#8b5cf6" /* violet */,
];

const GRID_COLOR = "#e2e8f0";
const AXIS_COLOR = "#94a3b8";
const AXIS_FONT_SIZE = 11;

/* Custom tooltip */
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      {label && <p className="font-semibold text-slate-700 mb-1.5">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ background: p.color }}
          />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-medium text-slate-800 tabular-nums">
            {Number(p.value).toLocaleString("en-IN")}
          </span>
        </div>
      ))}
    </div>
  );
}

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
        className="flex items-center justify-center border border-dashed border-slate-200 rounded-lg text-sm text-slate-400"
        style={{ height }}
      >
        {t("analytics.no_data", getLocale())}
      </div>
    );
  }

  const axisProps = {
    stroke: AXIS_COLOR,
    fontSize: AXIS_FONT_SIZE,
    tickLine: false,
    axisLine: { stroke: GRID_COLOR },
  };

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
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: "#64748b" }}
          />
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="78%"
            strokeWidth={2}
            stroke="#fff"
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
        <BarChart
          data={data}
          margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
          barCategoryGap="30%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={GRID_COLOR}
            vertical={false}
          />
          <XAxis dataKey={xKey} {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f1f5f9" }} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: "#64748b" }}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name ?? s.key}
              fill={s.color ?? PALETTE[i % PALETTE.length]}
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
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
          <defs>
            {series.map((s, i) => {
              const color = s.color ?? PALETTE[i % PALETTE.length];
              return (
                <linearGradient
                  key={s.key}
                  id={`grad-${s.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={GRID_COLOR}
            vertical={false}
          />
          <XAxis dataKey={xKey} {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: "#64748b" }}
          />
          {series.map((s, i) => {
            const color = s.color ?? PALETTE[i % PALETTE.length];
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name ?? s.key}
                stroke={color}
                strokeWidth={2}
                fill={`url(#grad-${s.key})`}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  /* line (default) */
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={GRID_COLOR}
          vertical={false}
        />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, color: "#64748b" }}
        />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name ?? s.key}
            stroke={s.color ?? PALETTE[i % PALETTE.length]}
            dot={false}
            strokeWidth={2}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
