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

    // Wait for the client to take over before typing anything. The map is
    // loaded only in the browser, so its canvas appearing proves hydration
    // ran — and a keystroke sent before that goes nowhere, which is what made
    // the country search test fail under parallel load.
    await page.locator('.maplibregl-map').waitFor({ timeout: 30_000 });
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

    // "Thailand Country", not /Thailand/. The looser pattern also matched the
    // place suggestions — "Bangkok, Thailand" — which arrive from the geocoder
    // a third of a second later and rebuild the list underneath the click.
    // That made this test fail about one run in three.
    await page
      .getByRole('list', { name: 'Search results' })
      .getByRole('button', { name: 'Thailand Country' })
      .click();

    await expect(page).toHaveURL(/country=TH/);
    await expect(page.getByText(/showing thailand only/i)).toBeVisible();
  });

  test('tells a country apart from a place with the same name', async ({
    page,
  }) => {
    await page.getByLabel('Search a country or a place').fill('Thail');

    const results = page.getByRole('list', { name: 'Search results' });
    await expect(
      results.getByRole('button', { name: 'Thailand Country' }),
    ).toBeVisible();
  });
});

test.describe('legal pages', () => {
  test('the imprint names a person and a postal address', async ({ page }) => {
    await page.goto('/imprint');

    await expect(page.getByText('Luca Fries')).toBeVisible();
    await expect(page.getByText('Lindenstrasse 13')).toBeVisible();
    await expect(page.getByText('Switzerland')).toBeVisible();
  });

  test('the imprint offers a way to object to a report', async ({ page }) => {
    await page.goto('/imprint');

    await expect(
      page.getByRole('link', { name: 'hello@safebackpack.app' }).first(),
    ).toBeVisible();
  });

  test('the privacy notice names who is responsible', async ({ page }) => {
    await page.goto('/privacy');

    await expect(
      page.getByRole('heading', { name: 'Who is responsible' }),
    ).toBeVisible();
    await expect(page.getByText(/Luca Fries, Lindenstrasse 13/)).toBeVisible();
  });

  test('the privacy notice says where to complain', async ({ page }) => {
    await page.goto('/privacy');

    await expect(
      page.getByRole('link', { name: /Data Protection and Information/ }),
    ).toBeVisible();
  });

  test('both say plainly that no lawyer has checked them', async ({ page }) => {
    for (const path of ['/imprint', '/privacy']) {
      await page.goto(path);
      await expect(page.getByText(/Reviewed by a lawyer\? Not yet/)).toBeVisible();
    }
  });
});
