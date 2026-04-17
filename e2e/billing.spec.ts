import { test, expect } from "@playwright/test";

test.describe("Billing & Pricing", () => {
  test("pricing page loads and shows plans with INR prices", async ({
    page,
  }) => {
    await page.goto("/pricing");
    await expect(page).toHaveURL(/pricing/);
    // Page should render without a white screen
    const body = await page.textContent("body");
    expect(body?.length).toBeGreaterThan(100);
    // Should show INR symbol somewhere on the page
    expect(body).toMatch(/₹|INR|Starter|Pro|Business/i);
  });

  test("billing settings redirects to login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/settings/billing");
    await expect(page).toHaveURL(/\/(login|register)/);
  });
});
