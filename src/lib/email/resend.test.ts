// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { ResendEmailSender } from './resend';
import { EmailDeliveryError, type EmailMessage } from './types';

const MESSAGE: EmailMessage = {
  to: 'traveller@example.com',
  subject: 'Confirm your SafeBackpack report',
  text: 'Confirm here',
  html: '<p>Confirm here</p>',
};

function okResponse() {
  return new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 });
}

function sender(fetchImpl: typeof fetch) {
  return new ResendEmailSender({
    apiKey: 're_test_key',
    from: 'onboarding@resend.dev',
    fetchImpl,
  });
}

describe('construction', () => {
  it('refuses to exist without an API key', () => {
    expect(
      () => new ResendEmailSender({ apiKey: '', from: 'a@b.com' }),
    ).toThrowError(/without an API key/);
  });
});

describe('send', () => {
  it('posts the message to Resend', async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) => okResponse(),
    );
    await sender(fetchImpl as unknown as typeof fetch).send(MESSAGE);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init?.method).toBe('POST');
  });

  it('authenticates with the key as a bearer token', async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) => okResponse(),
    );
    await sender(fetchImpl as unknown as typeof fetch).send(MESSAGE);

    const [, init] = fetchImpl.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer re_test_key');
  });

  it('sends both the text and the HTML body', async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) => okResponse(),
    );
    await sender(fetchImpl as unknown as typeof fetch).send(MESSAGE);

    const [, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      from: 'onboarding@resend.dev',
      to: ['traveller@example.com'],
      subject: MESSAGE.subject,
      text: MESSAGE.text,
      html: MESSAGE.html,
    });
  });

  it('reports what Resend objected to', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: 'Domain not verified' }), {
          status: 403,
        }),
    );

    await expect(
      sender(fetchImpl as unknown as typeof fetch).send(MESSAGE),
    ).rejects.toThrowError(/Domain not verified/);
  });

  it('carries the HTTP status on the error', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('nope', { status: 422 }),
    );

    await expect(
      sender(fetchImpl as unknown as typeof fetch).send(MESSAGE),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('survives an error body that is not JSON', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('<html>gateway error</html>', { status: 502 }),
    );

    await expect(
      sender(fetchImpl as unknown as typeof fetch).send(MESSAGE),
    ).rejects.toThrowError(/HTTP 502/);
  });

  it('reports a network failure without leaking request details', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED 1.2.3.4:443');
    });

    const error = await sender(fetchImpl as unknown as typeof fetch)
      .send(MESSAGE)
      .catch((caught: Error) => caught);

    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect((error as Error).message).toBe('Could not reach Resend');
    expect((error as Error).message).not.toContain('1.2.3.4');
  });

  it('names a timeout for what it is', async () => {
    const fetchImpl = vi.fn(async () => {
      const error = new Error('timed out');
      error.name = 'TimeoutError';
      throw error;
    });

    await expect(
      sender(fetchImpl as unknown as typeof fetch).send(MESSAGE),
    ).rejects.toThrowError(/did not respond in time/);
  });

  it('never puts the API key into an error message', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: 'Unauthorized' }), {
          status: 401,
        }),
    );

    const error = await sender(fetchImpl as unknown as typeof fetch)
      .send(MESSAGE)
      .catch((caught: Error) => caught);

    expect((error as Error).message).not.toContain('re_test_key');
  });
});
