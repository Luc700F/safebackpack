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
      page.getByLabel('Search a country or a place'),
    ).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Footer' })).toBeVisible();
  });

  test('offers a way to file a report', async ({ page }) => {
    // Both the header and the footer link to it, deliberately.
    await expect(
      page.getByRole('navigation', { name: 'Main' }).getByRole('link', {
        name: 'Report an incident',
      }),
    ).toBeVisible();
  });

  test('says plainly when there is nothing to show', async ({ page }) => {
    // This run has no database, so the map is empty by design. That the list
    // renders real reports is covered by the ReportList component test.
    await page.getByRole('button', { name: 'List' }).click();

    await expect(
      page.getByText(/no reports match these filters/i).first(),
    ).toBeVisible({ timeout: 15_000 });
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
    await page.getByLabel('Search a country or a place').waitFor();

    expect(errors).toEqual([]);
  });
});

test.describe('site navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('offers the statistics, about and legal pages', async ({ page }) => {
    const footer = page.getByRole('navigation', { name: 'Footer' });

    for (const label of ['Statistics', 'About', 'Imprint', 'Privacy', 'Terms']) {
      await expect(footer.getByRole('link', { name: label })).toBeVisible();
    }
  });

  test('every footer page opens and names itself', async ({ page }) => {
    for (const [label, heading] of [
      ['Statistics', 'Statistics'],
      ['About', 'About'],
      ['Imprint', 'Imprint'],
      ['Privacy', 'Privacy'],
      ['Terms', 'Terms of use'],
    ]) {
      await page.goto('/');
      await page
        .getByRole('navigation', { name: 'Footer' })
        .getByRole('link', { name: label })
        .click();

      await expect(
        page.getByRole('heading', { level: 1, name: heading }),
      ).toBeVisible();
    }
  });

  test('switches between the map and the list', async ({ page }) => {
    await page.getByRole('button', { name: 'List' }).click();
    await expect(page.getByRole('button', { name: 'List' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('button', { name: 'Map' }).click();
    await expect(page.getByRole('button', { name: 'Map' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('filters to a country from the search box', async ({ page }) => {
    await page.getByLabel('Search a country or a place').fill('Thail');
    await page
      .getByRole('list', { name: 'Search results' })
      .getByRole('button', { name: /Thailand/ })
      .click();

    await expect(page).toHaveURL(/country=TH/);
    await expect(page.getByText(/showing thailand only/i)).toBeVisible();
  });
});
