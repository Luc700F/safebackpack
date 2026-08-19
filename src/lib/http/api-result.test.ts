import { describe, expect, it } from 'vitest';

import { type ApiErrorCode, failure, success } from './api-result';

describe('success', () => {
  it('wraps the payload under data', () => {
    expect(success({ id: 'r1' })).toEqual({
      status: 200,
      body: { data: { id: 'r1' } },
    });
  });

  it('accepts a different status, for a created resource', () => {
    expect(success({ id: 'r1' }, 201).status).toBe(201);
  });
});

describe('failure', () => {
  it('carries a machine-readable code and a human sentence', () => {
    const result = failure('not_found', 'No such report.');

    expect(result.body).toEqual({
      error: { code: 'not_found', message: 'No such report.' },
    });
  });

  it('omits the fields key when there are none', () => {
    const result = failure('internal_error', 'Something went wrong.');
    expect('fields' in (result.body as { error: object }).error).toBe(false);
  });

  it('passes per-field messages through for a form to display', () => {
    const result = failure('validation_failed', 'Please check the form.', {
      fields: { description: 'Too short.' },
    });

    expect(result.body).toMatchObject({
      error: { fields: { description: 'Too short.' } },
    });
  });

  it('carries a retry hint for a rate limit', () => {
    expect(
      failure('rate_limited', 'Too many reports.', { retryAfterSeconds: 120 })
        .retryAfterSeconds,
    ).toBe(120);
  });

  it.each<[ApiErrorCode, number]>([
    ['validation_failed', 400],
    ['location_unknown', 400],
    ['malformed_request', 400],
    ['not_found', 404],
    ['invalid_token', 410],
    ['expired_token', 410],
    ['rate_limited', 429],
    ['email_failed', 500],
    ['internal_error', 500],
  ])('answers %s with HTTP %i', (code, status) => {
    expect(failure(code, 'message').status).toBe(status);
  });

  it('lets a caller override the status deliberately', () => {
    expect(failure('not_found', 'gone', { status: 410 }).status).toBe(410);
  });
});
