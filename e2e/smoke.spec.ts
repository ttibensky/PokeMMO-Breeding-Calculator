import { test, expect } from '@playwright/test';

test('app title is visible', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('PokeMMO Breeding Calculator')).toBeVisible();
});

test('clicking Projects nav link shows Projects heading', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Projects').click();
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
});
