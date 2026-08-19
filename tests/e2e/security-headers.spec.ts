import { expect, test } from '@playwright/test';

/**
 * Guards the headers configured in next.config.ts. A regression here is
 * invisible in the UI, so it has to be caught by a test.
 */
test.describe('security headers', () => {
  test('are sent on every response', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(headers['strict-transport-security']).toContain('max-age=');
  });

  test('disable camera, microphone and payment access', async ({ request }) => {
    const response = await request.get('/');
    const permissionsPolicy = response.headers()['permissions-policy'] ?? '';

    expect(permissionsPolicy).toContain('camera=()');
    expect(permissionsPolicy).toContain('microphone=()');
    expect(permissionsPolicy).toContain('payment=()');
  });

  test('never leak the framework version', async ({ request }) => {
    const response = await request.get('/');
    expect(response.headers()['x-powered-by']).toBeUndefined();
  });
});
