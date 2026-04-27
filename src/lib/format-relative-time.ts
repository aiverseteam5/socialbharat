/**
 * WhatsApp-style relative time formatter for conversation list timestamps.
 *
 * Boundaries:
 *  - < 1 min  → "Just now"
 *  - < 1 hour → "{n}m ago"
 *  - same calendar day → "{n}h ago"
 *  - previous calendar day → "Yesterday"
 *  - within last 7 days → weekday name ("Monday")
 *  - older → "DD MMM" ("12 Mar")
 *
 * `now` is injected for deterministic tests; defaults to Date.now().
 */
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatRelativeTime(
  iso: string | null | undefined,
  now: number = Date.now(),
): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";

  const diffMs = now - t;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;

  const target = new Date(t);
  const ref = new Date(now);

  const sameDay =
    target.getFullYear() === ref.getFullYear() &&
    target.getMonth() === ref.getMonth() &&
    target.getDate() === ref.getDate();
  if (sameDay) {
    const hrs = Math.floor(diffMs / 3_600_000);
    return `${hrs}h ago`;
  }

  const yesterday = new Date(ref);
  yesterday.setDate(ref.getDate() - 1);
  if (
    target.getFullYear() === yesterday.getFullYear() &&
    target.getMonth() === yesterday.getMonth() &&
    target.getDate() === yesterday.getDate()
  ) {
    return "Yesterday";
  }

  const sevenDaysAgo = new Date(ref);
  sevenDaysAgo.setDate(ref.getDate() - 7);
  if (target >= sevenDaysAgo) {
    return WEEKDAYS[target.getDay()]!;
  }

  const dd = String(target.getDate()).padStart(2, "0");
  return `${dd} ${MONTHS[target.getMonth()]!}`;
}
