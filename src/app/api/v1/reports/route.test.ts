// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { utcCalendarDate } from '@/lib/reports/incident-date';

const VALID = {
  description:
    'Two men on a scooter grabbed my bag near the night market entrance and rode off towards the river.',
  categoryId: 'theft',
  latitude: 13.7563,
  longitude: 100.5018,
  occurredOn: utcCalendarDate(new Date()),
  timeOfDay: 'night',
  reporterFirstName: 'Luca',
  homeCountry: 'CH',
  email: 'traveller@example.com',
  publishAnonymously: false,
};

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/v1/reports', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** Fresh modules per test, so the in-memory store does not leak between them. */
async function loadRoute() {
  vi.resetModules();
  return import('./route');
}

beforeEach(() => {
  vi.stubEnv('RECOGNITION_SECRET', 'test-secret');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
  vi.stubEnv('RESEND_API_KEY', '');
  vi.stubEnv('EMAIL_FROM', '');
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/v1/reports', () => {
  it('accepts a valid report and asks for email confirmation', async () => {
    const { POST } = await loadRoute();

    const response = await POST(post(VALID));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.verificationRequired).toBe(true);
    expect(body.data.reportId).toBeTruthy();
  });

  it('answers JSON', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post(VALID));

    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('rejects a body that is not JSON at all', async () => {
    const { POST } = await loadRoute();

    const response = await POST(post('not json'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('malformed_request');
  });

  it('reports validation problems per field', async () => {
    const { POST } = await loadRoute();

    const response = await POST(post({ ...VALID, description: 'short' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('validation_failed');
    expect(body.error.fields.description).toBeTruthy();
  });

  it('does not set a recognition cookie before the address is confirmed', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post(VALID));

    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('never echoes the submitted email address back', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post(VALID));

    expect(JSON.stringify(await response.json())).not.toContain(
      'traveller@example.com',
    );
  });

  it('stops a network address after ten reports and says how long to wait', async () => {
    const { POST } = await loadRoute();
    const headers = { 'x-forwarded-for': '203.0.113.7' };

    for (let i = 0; i < 10; i += 1) {
      await POST(post({ ...VALID, email: `t${i}@example.com` }, headers));
    }

    const response = await POST(
      post({ ...VALID, email: 'fresh@example.com' }, headers),
    );

    expect(response.status).toBe(429);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('treats different network addresses separately', async () => {
    const { POST } = await loadRoute();

    for (let i = 0; i < 10; i += 1) {
      await POST(
        post(
          { ...VALID, email: `t${i}@example.com` },
          { 'x-forwarded-for': '203.0.113.7' },
        ),
      );
    }

    const response = await POST(
      post(
        { ...VALID, email: 'fresh@example.com' },
        { 'x-forwarded-for': '203.0.113.8' },
      ),
    );

    expect(response.status).toBe(201);
  });

  it('ignores an address a caller appended to the forwarded header', async () => {
    const { POST } = await loadRoute();

    for (let i = 0; i < 10; i += 1) {
      await POST(
        post(
          { ...VALID, email: `t${i}@example.com` },
          { 'x-forwarded-for': '203.0.113.7' },
        ),
      );
    }

    // Same real client, but pretending to be someone else further down the chain.
    const response = await POST(
      post(
        { ...VALID, email: 'fresh@example.com' },
        { 'x-forwarded-for': '203.0.113.7, 8.8.8.8' },
      ),
    );

    expect(response.status).toBe(429);
  });
});

describe('POST /api/v1/reports/verify', () => {
  async function loadBoth() {
    vi.resetModules();
    const reports = await import('./route');
    const verify = await import('./verify/route');
    const { getRecordedEmails } = await import('@/lib/container');
    return { reports, verify, getRecordedEmails };
  }

  function verifyRequest(body: unknown): Request {
    return new Request('http://localhost:3000/api/v1/reports/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  it('publishes the report behind a valid link and sets the cookie', async () => {
    const { reports, verify, getRecordedEmails } = await loadBoth();

    await reports.POST(post(VALID));
    const sent = getRecordedEmails()!.lastMessage!;
    const token = new URL(/http:\/\/\S+/.exec(sent.text)![0]).searchParams.get(
      'token',
    );

    const response = await verify.POST(verifyRequest({ token }));

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('sb_recognition=');
  });

  it('marks the recognition cookie HttpOnly and same-site', async () => {
    const { reports, verify, getRecordedEmails } = await loadBoth();

    await reports.POST(post(VALID));
    const sent = getRecordedEmails()!.lastMessage!;
    const token = new URL(/http:\/\/\S+/.exec(sent.text)![0]).searchParams.get(
      'token',
    );

    const response = await verify.POST(verifyRequest({ token }));
    const cookie = response.headers.get('set-cookie')!;

    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=lax');
  });

  it('refuses a link that has already been used', async () => {
    const { reports, verify, getRecordedEmails } = await loadBoth();

    await reports.POST(post(VALID));
    const sent = getRecordedEmails()!.lastMessage!;
    const token = new URL(/http:\/\/\S+/.exec(sent.text)![0]).searchParams.get(
      'token',
    );

    await verify.POST(verifyRequest({ token }));
    const second = await verify.POST(verifyRequest({ token }));

    expect(second.status).toBe(410);
    expect((await second.json()).error.code).toBe('invalid_token');
  });

  it.each([[{ token: '' }], [{ token: 'nonsense' }], [{}], [{ token: 42 }]])(
    'refuses %p',
    async (body) => {
      const { verify } = await loadBoth();
      const response = await verify.POST(verifyRequest(body));

      expect(response.status).toBe(410);
    },
  );

  it('rejects a body that is not JSON', async () => {
    const { verify } = await loadBoth();
    const response = await verify.POST(verifyRequest('not json'));

    expect(response.status).toBe(400);
  });
});
