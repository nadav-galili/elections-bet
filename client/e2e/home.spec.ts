import { test, expect } from '@playwright/test';

test('landing page shows the Hebrew app name and CTA', async ({ page }) => {
  await page.goto('/');
  // Header brand.
  await expect(page.getByText('בט בחירות')).toBeVisible();
  // Hero heading — "הבחירות" is a colored <span>, but the accessible name concatenates.
  await expect(page.getByRole('heading', { name: 'נחשו את תוצאות הבחירות' })).toBeVisible();
  // Signed-out CTA — also appears in the lower band, so assert the first match.
  await expect(page.getByRole('button', { name: 'התחברות כדי להתחיל' }).first()).toBeVisible();
});
