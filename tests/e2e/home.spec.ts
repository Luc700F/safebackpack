import { expect, test } from '@playwright/test';

test.describe('home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows the map, the filters and the list', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: /know the risks/i }),
    ).toBeVisible();

    await expect(page.getByRole('group', { name: /how recent/i })).toBeVisible();
    await expect(
      page.getByRole('group', { name: /type of incident/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Reports in view' }),
    ).toBeVisible();
  });

  test('offers a way to file a report', async ({ page }) => {
    await expect(
      page.getByRole('link', { name: 'Report an incident' }),
    ).toBeVisible();
  });

  test('lists reports as text, not only as map pixels', async ({ page }) => {
    const list = page.getByRole('list').filter({ has: page.getByRole('listitem') });
    await expect(list.getByRole('listitem').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('keeps the chosen time span in the address bar', async ({ page }) => {
    await page.getByRole('button', { name: 'Past week' }).click();

    await expect(page).toHaveURL(/window=7d/);
    await expect(page.getByRole('button', { name: 'Past week' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('keeps the chosen categories in the address bar', async ({ page }) => {
    await page.getByRole('button', { name: 'Scam' }).click();

    await expect(page).toHaveURL(/categories=scam/);
    await expect(
      page.getByRole('button', { name: 'Show every category' }),
    ).toBeVisible();
  });

  test('restores the filters from a shared link', async ({ page }) => {
    await page.goto('/?window=7d&categories=theft');

    await expect(page.getByRole('button', { name: 'Past week' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(
      page.getByRole('button', { name: 'Pickpocketing or theft' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('falls back to a sensible view for a nonsense link', async ({ page }) => {
    await page.goto('/?window=banana&categories=arson');

    await expect(
      page.getByRole('heading', { name: 'Reports in view' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Past 3 months' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('says so when nothing matches instead of showing an empty page', async ({
    page,
  }) => {
    await page.goto('/?window=1d&categories=harassment');

    await expect(page.getByText(/no reports match these filters/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('has no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto('/');
    await page.getByRole('heading', { name: 'Reports in view' }).waitFor();

    expect(errors).toEqual([]);
  });
});
