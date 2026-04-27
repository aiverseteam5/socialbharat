import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "@/lib/format-relative-time";

// Wednesday 2026-04-15 12:00:00 UTC
const NOW = new Date("2026-04-15T12:00:00Z").getTime();

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

describe("formatRelativeTime", () => {
  it("returns empty string for null/undefined/invalid", () => {
    expect(formatRelativeTime(null, NOW)).toBe("");
    expect(formatRelativeTime(undefined, NOW)).toBe("");
    expect(formatRelativeTime("not-a-date", NOW)).toBe("");
  });

  it("'Just now' when under one minute", () => {
    expect(formatRelativeTime(iso(NOW - 30_000), NOW)).toBe("Just now");
    expect(formatRelativeTime(iso(NOW - 59_000), NOW)).toBe("Just now");
  });

  it("'{n}m ago' between 1 and 59 minutes", () => {
    expect(formatRelativeTime(iso(NOW - 60_000), NOW)).toBe("1m ago");
    expect(formatRelativeTime(iso(NOW - 30 * 60_000), NOW)).toBe("30m ago");
    expect(formatRelativeTime(iso(NOW - 59 * 60_000), NOW)).toBe("59m ago");
  });

  it("'{n}h ago' for same calendar day, ≥1 hour back", () => {
    expect(formatRelativeTime(iso(NOW - 60 * 60_000), NOW)).toBe("1h ago");
    expect(formatRelativeTime(iso(NOW - 5 * 60 * 60_000), NOW)).toBe("5h ago");
  });

  it("'Yesterday' for the previous calendar day", () => {
    const yesterday = new Date("2026-04-14T15:00:00Z").getTime();
    expect(formatRelativeTime(iso(yesterday), NOW)).toBe("Yesterday");
  });

  it("weekday name within last 7 days but not yesterday", () => {
    // 2026-04-12 was a Sunday
    const sunday = new Date("2026-04-12T10:00:00Z").getTime();
    expect(formatRelativeTime(iso(sunday), NOW)).toBe("Sunday");
  });

  it("'DD MMM' for dates older than 7 days", () => {
    const old = new Date("2026-03-12T10:00:00Z").getTime();
    expect(formatRelativeTime(iso(old), NOW)).toBe("12 Mar");
  });
});
