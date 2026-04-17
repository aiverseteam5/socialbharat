import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AnalyticsMetricKey } from "@/types/schemas";
import { logger } from "@/lib/logger";

interface MetricsRow {
  social_profile_id: string;
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

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(
  headers: string[],
  rows: Array<Record<string, unknown>>,
): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      return NextResponse.json({ error: "Invalid report id" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: report, error: reportError } = await supabase
      .from("analytics_reports")
      .select("*")
      .eq("id", id)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const format = (searchParams.get("format") || "csv").toLowerCase();

    if (!["csv", "json", "html"].includes(format)) {
      return NextResponse.json(
        {
          error:
            "Unsupported format. Use csv, json, or html. PDF export requires puppeteer which is not available on Vercel Edge — render the html response and print to PDF client-side.",
        },
        { status: 400 },
      );
    }

    const profileIds: string[] = report.profile_ids ?? [];
    const metrics: AnalyticsMetricKey[] = report.metrics ?? [];

    const { data: profiles } = await supabase
      .from("social_profiles")
      .select("id, platform, profile_name")
      .in("id", profileIds);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p] as const));

    const { data: metricsRows, error: metricsError } = await supabase
      .from("profile_metrics")
      .select(
        "social_profile_id, metric_date, followers_count, impressions, reach, engagements, engagement_rate, clicks, shares, comments, likes",
      )
      .in("social_profile_id", profileIds)
      .gte("metric_date", report.start_date)
      .lte("metric_date", report.end_date)
      .order("metric_date", { ascending: true });

    if (metricsError) throw metricsError;

    const rows = ((metricsRows ?? []) as MetricsRow[]).map((r) => {
      const profile = profileMap.get(r.social_profile_id);
      const out: Record<string, unknown> = {
        date: r.metric_date,
        profile: profile?.profile_name ?? r.social_profile_id,
        platform: profile?.platform ?? "",
      };
      for (const key of metrics) {
        out[key] = r[key as keyof MetricsRow];
      }
      return out;
    });

    if (format === "json") {
      return NextResponse.json({ report, rows });
    }

    if (format === "csv") {
      const headers = ["date", "profile", "platform", ...metrics];
      const csv = toCsv(headers, rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${report.name.replace(/[^\w-]/g, "_")}.csv"`,
        },
      });
    }

    // HTML fallback — can be printed to PDF client-side. PDF generation on
    // the server would need puppeteer/chromium, which is not available on
    // the Vercel Edge runtime, so we stop at HTML and document the gap.
    const escapeHtml = (s: string) =>
      s.replace(/[&<>"']/g, (c) =>
        c === "&"
          ? "&amp;"
          : c === "<"
            ? "&lt;"
            : c === ">"
              ? "&gt;"
              : c === '"'
                ? "&quot;"
                : "&#39;",
      );

    const headers = ["date", "profile", "platform", ...metrics];
    const thead = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
    const tbody = rows
      .map(
        (row) =>
          `<tr>${headers
            .map((h) => `<td>${escapeHtml(String(row[h] ?? ""))}</td>`)
            .join("")}</tr>`,
      )
      .join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(report.name)}</title><style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px 10px;text-align:left;font-size:13px}th{background:#f4f4f5}h1{font-size:20px;margin-bottom:4px}</style></head><body><h1>${escapeHtml(report.name)}</h1><p>${escapeHtml(report.start_date)} — ${escapeHtml(report.end_date)}</p><table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></body></html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    logger.error("GET /api/analytics/reports/[id]/export failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to export report",
      },
      { status: 500 },
    );
  }
}
