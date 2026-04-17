import { test, expect } from "@playwright/test";

test.describe("Inbox — unauthenticated redirects", () => {
  test("inbox page redirects to login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/inbox");
    await expect(page).toHaveURL(/\/(login|register)/);
  });

  test("conversation detail page redirects to login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/inbox/test-conversation-id");
    await expect(page).toHaveURL(/\/(login|register)/);
  });
});
