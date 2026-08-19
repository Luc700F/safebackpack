import { describe, expect, it } from 'vitest';

import {
  VERIFICATION_SUBJECT,
  buildVerificationEmail,
} from './verification';

const INPUT = {
  to: 'traveller@example.com',
  firstName: 'Luca',
  verificationUrl: 'https://safebackpack.app/verify?token=abc123',
  expiryMinutes: 30,
};

describe('buildVerificationEmail', () => {
  it('addresses the message to the reporter', () => {
    expect(buildVerificationEmail(INPUT).to).toBe('traveller@example.com');
  });

  it('uses a subject that says what it is', () => {
    expect(buildVerificationEmail(INPUT).subject).toBe(VERIFICATION_SUBJECT);
  });

  it('always carries a plain-text alternative', () => {
    const message = buildVerificationEmail(INPUT);
    expect(message.text.length).toBeGreaterThan(0);
    expect(message.text).toContain(INPUT.verificationUrl);
  });

  it('greets the reporter by name', () => {
    const message = buildVerificationEmail(INPUT);
    expect(message.text).toContain('Hi Luca');
    expect(message.html).toContain('Hi Luca');
  });

  it('falls back to a plain greeting without a name', () => {
    const message = buildVerificationEmail({ ...INPUT, firstName: undefined });
    expect(message.text).toContain('Hi,');
  });

  it.each([[''], ['   ']])('falls back when the name is %p', (firstName) => {
    expect(buildVerificationEmail({ ...INPUT, firstName }).text).toContain(
      'Hi,',
    );
  });

  it('states how long the link lasts and that it is single use', () => {
    const message = buildVerificationEmail(INPUT);
    expect(message.text).toContain('30 minutes');
    expect(message.text).toMatch(/used once/);
  });

  it('tells an unwitting recipient that ignoring it is safe', () => {
    expect(buildVerificationEmail(INPUT).text).toMatch(/ignore this message/i);
  });

  it('offers the raw link as well as the button', () => {
    const message = buildVerificationEmail(INPUT);
    const occurrences = message.html.split(INPUT.verificationUrl).length - 1;
    expect(occurrences).toBe(2);
  });

  it('carries no tracking pixel or remote image', () => {
    expect(buildVerificationEmail(INPUT).html).not.toMatch(/<img/i);
  });
});

describe('escaping', () => {
  it('escapes markup in the reporter name', () => {
    const message = buildVerificationEmail({
      ...INPUT,
      firstName: '<script>alert(1)</script>',
    });

    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&lt;script&gt;');
  });

  it('escapes an ampersand in the link so the URL survives', () => {
    const message = buildVerificationEmail({
      ...INPUT,
      verificationUrl: 'https://safebackpack.app/verify?token=a&next=b',
    });

    expect(message.html).toContain('token=a&amp;next=b');
  });

  it('escapes a quote that would otherwise break out of the href', () => {
    const message = buildVerificationEmail({
      ...INPUT,
      firstName: 'Luca" onmouseover="alert(1)',
    });

    expect(message.html).not.toContain('onmouseover="alert(1)"');
  });
});

describe('link safety', () => {
  it.each([
    ['javascript:alert(1)'],
    ['data:text/html,<script>alert(1)</script>'],
    ['file:///etc/passwd'],
  ])('refuses to send %p as the confirm link', (verificationUrl) => {
    expect(() =>
      buildVerificationEmail({ ...INPUT, verificationUrl }),
    ).toThrowError(/Refusing to send/);
  });

  it('rejects a value that is not a URL at all', () => {
    expect(() =>
      buildVerificationEmail({ ...INPUT, verificationUrl: 'not a url' }),
    ).toThrowError(/not a valid URL/);
  });

  it('accepts a plain http link, for local development', () => {
    expect(() =>
      buildVerificationEmail({
        ...INPUT,
        verificationUrl: 'http://localhost:3000/verify?token=abc',
      }),
    ).not.toThrow();
  });
});
