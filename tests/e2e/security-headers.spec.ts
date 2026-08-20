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

test.describe('content security policy', () => {
  test('is sent on a page, with a nonce', async ({ request }) => {
    const policy = (await request.get('/')).headers()['content-security-policy'];

    expect(policy).toBeTruthy();
    expect(policy).toMatch(/script-src [^;]*'nonce-[^']+'/);
    expect(policy).toContain("'strict-dynamic'");
  });

  test('forbids framing, plugins and stray base tags', async ({ request }) => {
    const policy = (await request.get('/')).headers()['content-security-policy'];

    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
  });

  test('allows the map its tiles and nothing else', async ({ request }) => {
    const policy = (await request.get('/')).headers()['content-security-policy'];

    expect(policy).toContain('connect-src \'self\' https://tiles.openfreemap.org');
    expect(policy).not.toContain('*');
  });

  test('gives every page a different nonce', async ({ request }) => {
    const first = (await request.get('/')).headers()['content-security-policy'];
    const second = (await request.get('/')).headers()['content-security-policy'];

    expect(first).not.toBe(second);
  });
});

test.describe('cross-site requests', () => {
  test('refuses a report submitted from somebody else’s page', async ({
    request,
    baseURL,
  }) => {
    const response = await request.post('/api/v1/reports', {
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      data: { description: 'x' },
    });

    expect(response.status()).toBe(403);
    expect((await response.json()).error.message).toMatch(/did not come from/i);
    expect(baseURL).toBeTruthy();
  });

  test('accepts one from our own pages', async ({ request, baseURL }) => {
    const response = await request.post('/api/v1/reports', {
      headers: { 'content-type': 'application/json', origin: baseURL! },
      data: { description: 'too short' },
    });

    // Rejected for being an invalid report, not for where it came from.
    expect(response.status()).toBe(400);
    expect((await response.json()).error.code).toBe('validation_failed');
  });

  test('leaves reading the map open to anyone', async ({ request }) => {
    const response = await request.get('/api/v1/reports?window=7d', {
      headers: { origin: 'https://evil.example' },
    });

    expect(response.status()).toBe(200);
  });
});
