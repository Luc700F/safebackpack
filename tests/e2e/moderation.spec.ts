import { expect, test } from '@playwright/test';

const PASSWORD = 'end-to-end-moderation-password';

test.describe('the moderation queue', () => {
  test('asks for a password before showing anything', async ({ page }) => {
    await page.goto('/admin');

    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('list')).toBeHidden();
  });

  test('refuses a wrong password', async ({ page }) => {
    await page.goto('/admin');
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // The message appears once the request comes back, which under a parallel
    // run can take longer than the default wait.
    // The message itself, not the role: Next.js keeps a route announcer in the
    // page that also carries role="alert", so the generic locator matches two
    // elements and Playwright refuses to guess between them.
    await expect(page.getByText('That password is not right.')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('shows the queue once signed in', async ({ page }) => {
    await page.goto('/admin');
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // This run has no database, so nothing is waiting — which is the state
    // the screen has to handle without looking broken.
    await expect(page.getByText(/nothing waiting/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  test('signs out again', async ({ page }) => {
    await page.goto('/admin');
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page
      .getByRole('button', { name: 'Sign out' })
      .click({ timeout: 15_000 });

    await expect(page.getByLabel('Password')).toBeVisible({ timeout: 15_000 });
  });

  test('is kept out of search results', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('/admin');
  });
});

test.describe('the moderation endpoints', () => {
  test('refuse to list anything without a session', async ({ request }) => {
    const response = await request.get('/api/v1/admin/reports');

    expect(response.status()).toBe(401);
  });

  test('refuse to decide anything without a session', async ({
    request,
    baseURL,
  }) => {
    const response = await request.post(
      '/api/v1/admin/reports/00000000-0000-4000-8000-000000000000',
      {
        headers: { 'content-type': 'application/json', origin: baseURL! },
        data: { action: 'approve' },
      },
    );

    expect(response.status()).toBe(401);
  });

  test('refuse a wrong password', async ({ request, baseURL }) => {
    const response = await request.post('/api/v1/admin/session', {
      headers: { 'content-type': 'application/json', origin: baseURL! },
      data: { password: 'not-the-password' },
    });

    expect(response.status()).toBe(401);
  });

  test('say the same thing for a wrong password as for none', async ({
    request,
    baseURL,
  }) => {
    const wrong = await request.post('/api/v1/admin/session', {
      headers: { 'content-type': 'application/json', origin: baseURL! },
      data: { password: 'not-the-password' },
    });
    const missing = await request.post('/api/v1/admin/session', {
      headers: { 'content-type': 'application/json', origin: baseURL! },
      data: {},
    });

    expect((await wrong.json()).error.message).toBe(
      (await missing.json()).error.message,
    );
  });

  test('mark the session cookie HttpOnly', async ({ request, baseURL }) => {
    const response = await request.post('/api/v1/admin/session', {
      headers: { 'content-type': 'application/json', origin: baseURL! },
      data: { password: PASSWORD },
    });

    expect(response.headers()['set-cookie']).toContain('HttpOnly');
  });
});
