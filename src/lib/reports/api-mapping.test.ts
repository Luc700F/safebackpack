import { describe, expect, it } from 'vitest';

import { submitOutcomeToResult, verifyOutcomeToResult } from './api-mapping';

describe('submitOutcomeToResult', () => {
  it('answers 201 and asks the reporter to check their inbox', () => {
    const result = submitOutcomeToResult({
      status: 'verification_sent',
      reportId: 'r1',
    });

    expect(result.status).toBe(201);
    expect(result.body).toEqual({
      data: { reportId: 'r1', verificationRequired: true },
    });
  });

  it('answers 201 without an inbox detour for a recognised reporter', () => {
    const result = submitOutcomeToResult({
      status: 'published',
      reportId: 'r1',
      recognitionToken: 'token',
    });

    expect(result.body).toEqual({
      data: { reportId: 'r1', verificationRequired: false },
    });
  });

  it('never leaks the recognition token into the body', () => {
    const result = submitOutcomeToResult({
      status: 'published',
      reportId: 'r1',
      recognitionToken: 'secret-token',
    });

    expect(JSON.stringify(result.body)).not.toContain('secret-token');
  });

  it('passes field errors through for the form to show', () => {
    const result = submitOutcomeToResult({
      status: 'invalid',
      errors: { description: 'Too short.' },
    });

    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      error: { code: 'validation_failed', fields: { description: 'Too short.' } },
    });
  });

  it('turns a rate limit into 429 with a wait in whole seconds', () => {
    const result = submitOutcomeToResult({
      status: 'rate_limited',
      retryAfterMs: 90_500,
    });

    expect(result.status).toBe(429);
    expect(result.retryAfterSeconds).toBe(91);
  });

  it('explains a position that belongs to no country', () => {
    const result = submitOutcomeToResult({ status: 'location_unknown' });

    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ error: { code: 'location_unknown' } });
  });

  it('admits an email failure rather than claiming success', () => {
    const result = submitOutcomeToResult({ status: 'email_failed' });

    expect(result.status).toBe(500);
    expect(result.body).toMatchObject({ error: { code: 'email_failed' } });
  });
});

describe('verifyOutcomeToResult', () => {
  it('answers 200 with the published report', () => {
    expect(verifyOutcomeToResult({
      status: 'published',
      reportId: 'r1',
      recognitionToken: 'token',
    })).toMatchObject({ status: 200, body: { data: { reportId: 'r1' } } });
  });

  it('distinguishes an expired link from an invalid one', () => {
    expect(verifyOutcomeToResult({ status: 'expired' }).body).toMatchObject({
      error: { code: 'expired_token' },
    });
    expect(verifyOutcomeToResult({ status: 'invalid_token' }).body).toMatchObject(
      { error: { code: 'invalid_token' } },
    );
  });

  it('suggests that an invalid link may simply have been used already', () => {
    const body = verifyOutcomeToResult({ status: 'invalid_token' }).body;
    expect(JSON.stringify(body)).toMatch(/already have been used/);
  });
});
