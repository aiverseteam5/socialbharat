/**
 * Resolve a date range for analytics queries.
 * Defaults: last 30 days ending today (UTC).
 */
export interface ResolvedDateRange {
  start: string;
  end: string;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function resolveDateRange(
  start?: string | null,
  end?: string | null,
  defaultDays = 30,
): ResolvedDateRange {
  const today = new Date();
  const endStr = end && isIsoDate(end) ? end : today.toISOString().slice(0, 10);

  if (start && isIsoDate(start)) {
    return { start, end: endStr };
  }

  const endDate = new Date(`${endStr}T00:00:00.000Z`);
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - (defaultDays - 1));

  return {
    start: startDate.toISOString().slice(0, 10),
    end: endStr,
  };
}

export function previousPeriod(range: ResolvedDateRange): ResolvedDateRange {
  const start = new Date(`${range.start}T00:00:00.000Z`);
  const end = new Date(`${range.end}T00:00:00.000Z`);
  const days = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 86400000) + 1,
  );
  const prevEnd = new Date(start);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - (days - 1));

  return {
    start: prevStart.toISOString().slice(0, 10),
    end: prevEnd.toISOString().slice(0, 10),
  };
}
