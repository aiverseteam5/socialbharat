import { test, expect } from "@playwright/test";

test.describe("Publishing — unauthenticated redirects", () => {
  test("compose page redirects to login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/publishing/compose");
    await expect(page).toHaveURL(/\/(login|register)/);
  });

  test("drafts page redirects to login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/publishing/drafts");
    await expect(page).toHaveURL(/\/(login|register)/);
  });

  test("calendar page redirects to login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/publishing/calendar");
    await expect(page).toHaveURL(/\/(login|register)/);
  });
});
