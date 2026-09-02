import { describe, expect, it } from 'vitest';

import { HELD_REPORT_SUBJECT, buildHeldReportEmail } from './moderation';

const input = {
  to: 'hello@safebackpack.app',
  reasons: ['appears to name a person'],
  queueUrl: 'https://www.safebackpack.app/admin',
};

describe('buildHeldReportEmail', () => {
  it('is addressed to the operator, with a subject that says what it is', () => {
    const message = buildHeldReportEmail(input);

    expect(message.to).toBe('hello@safebackpack.app');
    expect(message.subject).toBe(HELD_REPORT_SUBJECT);
  });

  it('lists what the screener objected to', () => {
    const message = buildHeldReportEmail({
      ...input,
      reasons: ['contains a link', 'appears to name a person'],
    });

    expect(message.text).toContain('contains a link');
    expect(message.text).toContain('appears to name a person');
    expect(message.html).toContain('appears to name a person');
  });

  it('links to the queue', () => {
    expect(buildHeldReportEmail(input).text).toContain(
      'https://www.safebackpack.app/admin',
    );
  });

  it('says something even when no reason was recorded', () => {
    const message = buildHeldReportEmail({ ...input, reasons: [] });

    expect(message.text).toContain('no reason recorded');
  });

  it('escapes a reason before putting it in HTML', () => {
    // Screening reasons are written by us, not by a reporter. Escaping anyway
    // costs nothing and means a reason that later quotes matched text cannot
    // turn into markup in somebody's mail client.
    const message = buildHeldReportEmail({
      ...input,
      reasons: ['<script>alert(1)</script>'],
    });

    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&lt;script&gt;');
  });

  it('always carries a plain-text body', () => {
    expect(buildHeldReportEmail(input).text.length).toBeGreaterThan(0);
  });

  it('never carries the report itself', () => {
    // The point of the queue is that the description lives in one place.
    const message = buildHeldReportEmail(input);

    expect(message.text.toLowerCase()).not.toContain('description');
    expect(message.text).toContain('not in this email on purpose');
  });

  it('refuses a plaintext link', () => {
    expect(() =>
      buildHeldReportEmail({
        ...input,
        queueUrl: 'http://www.safebackpack.app/admin',
      }),
    ).toThrow(/plaintext/);
  });

  it('allows localhost, which has no TLS to offer', () => {
    expect(() =>
      buildHeldReportEmail({ ...input, queueUrl: 'http://localhost:3000/admin' }),
    ).not.toThrow();
  });

  it('refuses something that is not a link at all', () => {
    expect(() =>
      buildHeldReportEmail({ ...input, queueUrl: 'the admin page' }),
    ).toThrow(/usable link/);
  });
});
