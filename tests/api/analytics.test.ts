import { describe, it, expect } from "vitest";
import { resolveDateRange, previousPeriod } from "@/lib/analytics-range";
import { saveReportSchema, analyticsQuerySchema } from "@/types/schemas";

describe("analytics-range", () => {
  describe("resolveDateRange", () => {
    it("returns explicit dates when both are provided", () => {
      const range = resolveDateRange("2026-01-01", "2026-01-31");
      expect(range).toEqual({ start: "2026-01-01", end: "2026-01-31" });
    });

    it("rejects malformed input and falls back to defaults", () => {
      const range = resolveDateRange("not-a-date", "2026-04-17");
      expect(range.end).toBe("2026-04-17");
      // default 30-day window ending on 2026-04-17
      expect(range.start).toBe("2026-03-19");
    });

    it("defaults to last 30 days ending today when nothing is provided", () => {
      const range = resolveDateRange(undefined, undefined);
      expect(range.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(range.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const start = new Date(`${range.start}T00:00:00Z`);
      const end = new Date(`${range.end}T00:00:00Z`);
      const days = Math.round((end.getTime() - start.getTime()) / 86400000);
      expect(days).toBe(29);
    });

    it("honors custom default window size", () => {
      const range = resolveDateRange(null, "2026-04-17", 7);
      expect(range).toEqual({ start: "2026-04-11", end: "2026-04-17" });
    });
  });

  describe("previousPeriod", () => {
    it("returns a preceding window of equal length", () => {
      const prev = previousPeriod({ start: "2026-04-01", end: "2026-04-07" });
      expect(prev).toEqual({ start: "2026-03-25", end: "2026-03-31" });
    });

    it("handles single-day ranges", () => {
      const prev = previousPeriod({ start: "2026-04-17", end: "2026-04-17" });
      expect(prev).toEqual({ start: "2026-04-16", end: "2026-04-16" });
    });
  });
});

describe("analytics schemas", () => {
  describe("saveReportSchema", () => {
    it("requires at least one profile and metric", () => {
      expect(() =>
        saveReportSchema.parse({
          name: "Test",
          profile_ids: [],
          metrics: ["followers_count"],
          start_date: "2026-04-01",
          end_date: "2026-04-30",
        }),
      ).toThrow();

      expect(() =>
        saveReportSchema.parse({
          name: "Test",
          profile_ids: ["123e4567-e89b-12d3-a456-426614174000"],
          metrics: [],
          start_date: "2026-04-01",
          end_date: "2026-04-30",
        }),
      ).toThrow();
    });

    it("rejects unknown metric keys", () => {
      expect(() =>
        saveReportSchema.parse({
          name: "Test",
          profile_ids: ["123e4567-e89b-12d3-a456-426614174000"],
          metrics: ["sentiment"],
          start_date: "2026-04-01",
          end_date: "2026-04-30",
        }),
      ).toThrow();
    });

    it("accepts a valid report config", () => {
      const out = saveReportSchema.parse({
        name: "April rollup",
        profile_ids: ["123e4567-e89b-12d3-a456-426614174000"],
        metrics: ["followers_count", "impressions", "engagement_rate"],
        start_date: "2026-04-01",
        end_date: "2026-04-30",
      });
      expect(out.metrics).toHaveLength(3);
    });

    it("rejects malformed dates", () => {
      expect(() =>
        saveReportSchema.parse({
          name: "Test",
          profile_ids: ["123e4567-e89b-12d3-a456-426614174000"],
          metrics: ["followers_count"],
          start_date: "04/01/2026",
          end_date: "2026-04-30",
        }),
      ).toThrow();
    });
  });

  describe("analyticsQuerySchema", () => {
    it("accepts absent query params", () => {
      const out = analyticsQuerySchema.parse({});
      expect(out).toEqual({});
    });

    it("rejects non-ISO dates", () => {
      expect(() =>
        analyticsQuerySchema.parse({ start_date: "April 1" }),
      ).toThrow();
    });
  });
});
