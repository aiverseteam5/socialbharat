import { describe, it, expect } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

describe("robots.ts", () => {
  it("allows all user agents at the site root", () => {
    const rules = robots();
    const rule = Array.isArray(rules.rules) ? rules.rules[0] : rules.rules;
    expect(rule?.userAgent).toBe("*");
    expect(rule?.allow).toBe("/");
  });

  it("disallows dashboard and API routes", () => {
    const rules = robots();
    const rule = Array.isArray(rules.rules) ? rules.rules[0] : rules.rules;
    const disallow = rule?.disallow;
    const list = Array.isArray(disallow)
      ? disallow
      : disallow
        ? [disallow]
        : [];
    expect(list).toEqual(
      expect.arrayContaining([
        "/api/",
        "/dashboard",
        "/inbox",
        "/publishing",
        "/settings",
        "/analytics",
        "/login",
        "/register",
      ]),
    );
  });

  it("points sitemap to /sitemap.xml on the configured site URL", () => {
    const rules = robots();
    expect(rules.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});

describe("sitemap.ts", () => {
  it("includes public marketing + legal routes", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.some((u) => u.endsWith("/"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/pricing"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/privacy"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/terms"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/data-deletion"))).toBe(true);
  });

  it("excludes protected routes from the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.some((u) => u.includes("/dashboard"))).toBe(false);
    expect(urls.some((u) => u.includes("/inbox"))).toBe(false);
    expect(urls.some((u) => u.includes("/settings"))).toBe(false);
  });

  it("uses https URLs in production-style config", () => {
    const entries = sitemap();
    for (const entry of entries) {
      expect(entry.url.startsWith("http")).toBe(true);
    }
  });
});
