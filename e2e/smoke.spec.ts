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

test.describe('branding — favicon and Mewtwo logo', () => {
  test('document has a favicon link whose href ends with favicon.png', async ({ page }) => {
    await page.goto('./');
    const href = await page.locator('link[rel="icon"]').getAttribute('href');
    expect(href).toBeTruthy();
    expect(href).toMatch(/favicon\.png$/);
  });

  test('favicon URL returns HTTP 200', async ({ page }) => {
    await page.goto('./');
    const href = await page.locator('link[rel="icon"]').getAttribute('href');
    expect(href).toBeTruthy();
    const response = await page.request.get(href!);
    expect(response.status()).toBe(200);
  });

  test('header renders a visible Mewtwo img whose src ends with mewtwo-sprite.gif', async ({ page }) => {
    await page.goto('./');
    const logo = page.locator('header img[alt="Mewtwo"]');
    await expect(logo).toBeVisible();
    const src = await logo.getAttribute('src');
    expect(src).toMatch(/mewtwo-sprite\.gif$/);
  });

  test('Mewtwo logo appears before the title text in the header', async ({ page }) => {
    await page.goto('./');
    const logo = page.locator('header img[alt="Mewtwo"]');
    const title = page.locator('header').getByText('PokeMMO Breeding Calculator');
    const logoBox = await logo.boundingBox();
    const titleBox = await title.boundingBox();
    expect(logoBox).toBeTruthy();
    expect(titleBox).toBeTruthy();
    // Logo's left edge should be to the left of the title's left edge
    expect(logoBox!.x).toBeLessThan(titleBox!.x);
  });
});
