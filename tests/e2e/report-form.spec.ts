import { expect, test, type Page } from '@playwright/test';

const DESCRIPTION =
  'Two men on a scooter grabbed my bag near the night market entrance and rode off towards the river.';

async function fillIncidentStep(page: Page) {
  await page.getByRole('radio', { name: /Pickpocketing or theft/ }).check();
  await page.getByRole('radio', { name: /Night/ }).check();
  await page.getByRole('textbox', { name: 'What happened' }).fill(DESCRIPTION);
  await page.getByRole('button', { name: 'Continue' }).click();
}

async function fillLocationStep(page: Page) {
  await page.getByRole('textbox', { name: 'Latitude' }).fill('13.75630');
  await page.getByRole('textbox', { name: 'Longitude' }).fill('100.50180');
  await page.getByRole('button', { name: 'Continue' }).click();
}

async function fillReporterStep(page: Page) {
  await page.getByRole('textbox', { name: 'First name' }).fill('Luca');
  await page.getByLabel('Home country').selectOption('CH');
  await page.getByRole('textbox', { name: 'Email address' }).fill(
    'traveller@example.com',
  );
  await page.getByRole('button', { name: 'Continue' }).click();
}

test.describe('filing a report', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/report');
  });

  test('walks through all four steps and asks for confirmation', async ({
    page,
  }) => {
    await expect(
      page.getByRole('heading', { name: 'What happened', level: 2 }),
    ).toBeVisible();

    await fillIncidentStep(page);
    await expect(
      page.getByRole('heading', { name: 'Where did it happen' }),
    ).toBeVisible();

    await fillLocationStep(page);
    await expect(
      page.getByRole('heading', { name: 'About you' }),
    ).toBeVisible();

    await fillReporterStep(page);
    await expect(
      page.getByRole('heading', { name: 'Review your report' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Publish this report' }).click();

    await expect(
      page.getByRole('heading', { name: 'Check your inbox' }),
    ).toBeVisible();
  });

  test('refuses to move on from an empty first step', async ({ page }) => {
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(
      page.getByRole('heading', { name: 'What happened', level: 2 }),
    ).toBeVisible();
    await expect(page.getByRole('alert').first()).toBeVisible();
  });

  test('asks for a custom label only for the free-text category', async ({
    page,
  }) => {
    const customLabel = page.getByRole('textbox', {
      name: 'What would you call it?',
    });
    await expect(customLabel).toBeHidden();

    await page.getByRole('radio', { name: /Something else/ }).check();
    await expect(customLabel).toBeVisible();
  });

  test('shows the review exactly as it will be published', async ({ page }) => {
    await fillIncidentStep(page);
    await fillLocationStep(page);
    await fillReporterStep(page);

    const summary = page.getByRole('definition');
    await expect(summary.filter({ hasText: DESCRIPTION })).toBeVisible();
    await expect(summary.filter({ hasText: 'Luca, Switzerland' })).toBeVisible();
    await expect(summary.filter({ hasText: 'blurred' })).toBeVisible();
  });

  test('says the name is withheld when publishing anonymously', async ({
    page,
  }) => {
    await fillIncidentStep(page);
    await fillLocationStep(page);
    await page.getByRole('textbox', { name: 'First name' }).fill('Luca');
    await page.getByLabel('Home country').selectOption('CH');
    await page
      .getByRole('textbox', { name: 'Email address' })
      .fill('traveller@example.com');
    await page.getByRole('checkbox', { name: /without my name/ }).check();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(
      page.getByRole('definition').filter({ hasText: 'Anonymous, Switzerland' }),
    ).toBeVisible();
  });

  test('lets the reporter go back and change an answer', async ({ page }) => {
    await fillIncidentStep(page);
    await page.getByRole('button', { name: 'Back' }).click();

    await expect(
      page.getByRole('textbox', { name: 'What happened' }),
    ).toHaveValue(DESCRIPTION);
  });

  test('reports no console errors along the way', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await fillIncidentStep(page);
    await fillLocationStep(page);
    await fillReporterStep(page);

    expect(errors).toEqual([]);
  });
});

test.describe('confirming a report', () => {
  test('does nothing until the visitor presses the button', async ({ page }) => {
    await page.goto('/verify?token=some-token');

    await expect(
      page.getByRole('heading', { name: 'Confirm your report' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Publish my report' }),
    ).toBeVisible();
  });

  test('explains a link that carries no token', async ({ page }) => {
    await page.goto('/verify');

    await expect(
      page.getByRole('heading', { name: 'Nothing to confirm' }),
    ).toBeVisible();
  });

  test('reports an unusable token instead of failing silently', async ({
    page,
  }) => {
    await page.goto('/verify?token=nonsense');
    await page.getByRole('button', { name: 'Publish my report' }).click();

    // The message appears once the request comes back, which under a parallel
    // run can take longer than the default wait.
    await expect(page.getByRole('alert').first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
