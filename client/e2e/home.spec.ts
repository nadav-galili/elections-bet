import { test, expect } from '@playwright/test';

test('landing page shows the Hebrew app name and CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('תחזית בחירות')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'נחשו את תוצאות הבחירות' })).toBeVisible();
});
