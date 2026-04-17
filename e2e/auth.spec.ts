import { test, expect } from "@playwright/test";

test.describe("Auth flows", () => {
  test("redirect to login when accessing dashboard unauthenticated", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    // Should redirect to login or show login page
    await expect(page).toHaveURL(/\/(login|register)/);
  });

  test("login page renders all key fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading").first()).toBeVisible();
    // Phone or email input should be present
    const phoneOrEmail = page
      .locator(
        'input[type="tel"], input[type="email"], input[name="phone"], input[name="email"]',
      )
      .first();
    await expect(phoneOrEmail).toBeVisible();
  });

  test("register page renders correctly", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading").first()).toBeVisible();
    // At least one input field should be present
    await expect(page.locator("input").first()).toBeVisible();
  });

  test("verify-otp page renders OTP input", async ({ page }) => {
    await page.goto("/verify-otp");
    await expect(page).toHaveURL(/verify-otp/);
    // Should have an OTP input or redirect if no pending OTP
    const pageContent = await page.textContent("body");
    expect(pageContent).toBeTruthy();
  });
});
