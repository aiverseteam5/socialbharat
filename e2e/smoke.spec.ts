import { test, expect } from '@playwright/test';

test.describe('Smoke Test', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SocialBharat/i);
  });
});
