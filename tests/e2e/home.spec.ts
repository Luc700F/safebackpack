import { expect, test } from '@playwright/test';

test.describe('home page', () => {
  test('shows the map section and the category legend', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { level: 1, name: /know the risks/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Incident map' }),
    ).toBeVisible();

    const legend = page.getByRole('list', { name: 'Report categories' });
    await expect(legend.getByRole('listitem')).toHaveCount(7);
  });

  test('offers a way to file a report', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('link', { name: 'Report an incident' }),
    ).toBeVisible();
  });

  test('has no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto('/');
    expect(errors).toEqual([]);
  });
});
