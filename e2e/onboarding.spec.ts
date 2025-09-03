import { test, expect } from '@playwright/test';

// Minimal smoke test for onboarding flow: checks sign-in UI renders.
// Note: This test does not perform real auth; it verifies routing/UI renders.

test.describe('Onboarding smoke', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/auth/login');

    // Assert core form controls exist
    await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
  });

  test('sign-up page renders', async ({ page }) => {
    await page.goto('/auth/sign-up');

    await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Repeat Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign up/i })).toBeVisible();
  });
});

