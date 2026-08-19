// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';

import { RecordingEmailSender } from '../email/fake';
import { distanceMetres, FUZZ_RADIUS_METRES } from '../geo/coordinates';
import { StaticCountryLocator } from '../geo/country-locator';
import { MemoryRateLimitStore } from '../security/rate-limit-store';
import { RateLimiter } from '../security/rate-limiter';
import { hashEmail } from '../verification/email-hash';
import { createRecognitionToken } from '../verification/recognition';
import { MemoryReportRepository } from './memory-repository';
import { RETENTION_DAYS } from './retention';
import { ReportService } from './service';

const NOW = new Date('2026-08-19T12:00:00.000Z');
const SECRET = 'test-secret';
const BANGKOK = { latitude: 13.7563, longitude: 100.5018 };

function submission(overrides: Record<string, unknown> = {}): unknown {
  return {
    description:
      'Two men on a scooter grabbed my bag near the night market entrance and rode off towards the river.',
    categoryId: 'theft',
    latitude: BANGKOK.latitude,
    longitude: BANGKOK.longitude,
    timeOfDay: 'night',
    reporterFirstName: 'Luca',
    homeCountry: 'CH',
    email: 'traveller@example.com',
    publishAnonymously: false,
    ...overrides,
  };
}

let repository: MemoryReportRepository;
let emailSender: RecordingEmailSender;
let store: MemoryRateLimitStore;
let clock: Date;

function service(overrides: Record<string, unknown> = {}) {
  return new ReportService({
    repository,
    emailSender,
    countryLocator: new StaticCountryLocator('TH'),
    rateLimiter: new RateLimiter(store, () => clock),
    secret: SECRET,
    siteUrl: 'https://safebackpack.app',
    clock: () => clock,
    ...overrides,
  });
}

beforeEach(() => {
  repository = new MemoryReportRepository();
  emailSender = new RecordingEmailSender();
  store = new MemoryRateLimitStore(() => clock.getTime());
  clock = new Date(NOW);
});

describe('submit', () => {
  it('accepts a valid report and sends a verification email', async () => {
    const outcome = await service().submit(submission(), { ipHash: 'ip1' });

    expect(outcome.status).toBe('verification_sent');
    expect(emailSender.sent).toHaveLength(1);
    expect(emailSender.lastMessage?.to).toBe('traveller@example.com');
  });

  it('does not publish anything before the email is confirmed', async () => {
    await service().submit(submission(), { ipHash: 'ip1' });

    const [report] = repository.all();
    expect(report.status).toBe('pending_verification');
    expect(report.publicPosition).toBeNull();
    expect(report.publishedAt).toBeNull();
  });

  it('derives the country on the server, ignoring anything the client sent', async () => {
    await service().submit(submission({ countryCode: 'XX' }), {
      ipHash: 'ip1',
    });

    expect(repository.all()[0].countryCode).toBe('TH');
  });

  it('rejects an invalid report without touching storage or email', async () => {
    const outcome = await service().submit(submission({ description: 'no' }), {
      ipHash: 'ip1',
    });

    expect(outcome.status).toBe('invalid');
    expect(repository.all()).toHaveLength(0);
    expect(emailSender.sent).toHaveLength(0);
  });

  it('refuses a position that belongs to no country', async () => {
    const outcome = await service({
      countryLocator: new StaticCountryLocator(null),
    }).submit(submission(), { ipHash: 'ip1' });

    expect(outcome.status).toBe('location_unknown');
    expect(repository.all()).toHaveLength(0);
  });

  it('drops the name when the reporter chose to stay anonymous', async () => {
    await service().submit(submission({ publishAnonymously: true }), {
      ipHash: 'ip1',
    });

    const [report] = repository.all();
    expect(report.reporterFirstName).toBeNull();
    expect(report.reporterHomeCountry).toBe('CH');
  });

  it('stores a keyed hash of the address, not just the address', async () => {
    await service().submit(submission(), { ipHash: 'ip1' });

    const [report] = repository.all();
    expect(report.reporterEmailHash).toBe(
      hashEmail('traveller@example.com', SECRET),
    );
    expect(report.reporterEmailHash).not.toContain('traveller');
  });

  it('reports an email failure instead of pretending it worked', async () => {
    emailSender.failOnce();

    const outcome = await service().submit(submission(), { ipHash: 'ip1' });

    expect(outcome.status).toBe('email_failed');
    expect(repository.all()[0].status).toBe('pending_verification');
  });
});

describe('abuse limits', () => {
  it('stops one address after three reports in a day', async () => {
    const subject = service();

    for (let i = 0; i < 3; i += 1) {
      const outcome = await subject.submit(submission(), { ipHash: `ip${i}` });
      expect(outcome.status).toBe('verification_sent');
    }

    const outcome = await subject.submit(submission(), { ipHash: 'ip9' });
    expect(outcome.status).toBe('rate_limited');
  });

  it('stops one network address after ten reports, across addresses', async () => {
    const subject = service();

    for (let i = 0; i < 10; i += 1) {
      await subject.submit(submission({ email: `t${i}@example.com` }), {
        ipHash: 'shared-hostel-wifi',
      });
    }

    const outcome = await subject.submit(
      submission({ email: 'fresh@example.com' }),
      { ipHash: 'shared-hostel-wifi' },
    );
    expect(outcome.status).toBe('rate_limited');
  });

  it('tells the caller how long to wait', async () => {
    const subject = service();
    for (let i = 0; i < 3; i += 1) {
      await subject.submit(submission(), { ipHash: `ip${i}` });
    }

    const outcome = await subject.submit(submission(), { ipHash: 'ip9' });
    expect(
      outcome.status === 'rate_limited' && outcome.retryAfterMs,
    ).toBeGreaterThan(0);
  });

  it('lets the reporter through again the next day', async () => {
    const subject = service();
    for (let i = 0; i < 3; i += 1) {
      await subject.submit(submission(), { ipHash: `ip${i}` });
    }

    clock = new Date(NOW.getTime() + 25 * 60 * 60 * 1000);

    const outcome = await subject.submit(submission(), { ipHash: 'ip9' });
    expect(outcome.status).toBe('verification_sent');
  });
});

describe('recognised reporters', () => {
  const emailHash = hashEmail('traveller@example.com', SECRET);

  it('publishes immediately, without a second verification email', async () => {
    const outcome = await service().submit(submission(), {
      ipHash: 'ip1',
      recognitionToken: createRecognitionToken(emailHash, SECRET, NOW),
    });

    expect(outcome.status).toBe('published');
    expect(emailSender.sent).toHaveLength(0);
    expect(repository.all()[0].status).toBe('published');
  });

  it('ignores a token belonging to a different address', async () => {
    const otherHash = hashEmail('someone.else@example.com', SECRET);

    const outcome = await service().submit(submission(), {
      ipHash: 'ip1',
      recognitionToken: createRecognitionToken(otherHash, SECRET, NOW),
    });

    expect(outcome.status).toBe('verification_sent');
  });

  it('ignores a token signed with the wrong secret', async () => {
    const outcome = await service().submit(submission(), {
      ipHash: 'ip1',
      recognitionToken: createRecognitionToken(emailHash, 'forged', NOW),
    });

    expect(outcome.status).toBe('verification_sent');
  });

  it('ignores a token that has lapsed', async () => {
    const token = createRecognitionToken(emailHash, SECRET, NOW);
    clock = new Date(NOW.getTime() + 31 * 24 * 60 * 60 * 1000);

    const outcome = await service().submit(submission(), {
      ipHash: 'ip1',
      recognitionToken: token,
    });

    expect(outcome.status).toBe('verification_sent');
  });

  it.each([[undefined], [null], [''], ['garbage']])(
    'falls back to verification for token %p',
    async (recognitionToken) => {
      const outcome = await service().submit(submission(), {
        ipHash: 'ip1',
        recognitionToken: recognitionToken as string | null | undefined,
      });

      expect(outcome.status).toBe('verification_sent');
    },
  );
});

describe('verify', () => {
  async function submitAndTakeToken(): Promise<string> {
    await service().submit(submission(), { ipHash: 'ip1' });
    const url = new URL(
      /https:\/\/\S+/.exec(emailSender.lastMessage!.text)![0],
    );
    return url.searchParams.get('token')!;
  }

  it('publishes the report the link belongs to', async () => {
    const token = await submitAndTakeToken();

    const outcome = await service().verify(token);

    expect(outcome.status).toBe('published');
    expect(repository.all()[0].status).toBe('published');
  });

  it('hands back a recognition token so the next report skips the inbox', async () => {
    const token = await submitAndTakeToken();

    const outcome = await service().verify(token);

    expect(outcome.status === 'published' && outcome.recognitionToken).toBeTruthy();
  });

  it('publishes a displaced position, never the exact one', async () => {
    const token = await submitAndTakeToken();
    await service().verify(token);

    const [report] = repository.all();
    expect(report.publicPosition).not.toEqual(report.position);
    expect(distanceMetres(report.position, report.publicPosition!)).toBeLessThanOrEqual(
      FUZZ_RADIUS_METRES + 1,
    );
    expect(distanceMetres(report.position, report.publicPosition!)).toBeGreaterThan(0);
  });

  it('sets the deletion date six months out', async () => {
    const token = await submitAndTakeToken();
    await service().verify(token);

    const [report] = repository.all();
    expect(report.expiresAt?.getTime()).toBe(
      NOW.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
  });

  it('refuses a link that has already been used', async () => {
    const token = await submitAndTakeToken();
    const subject = service();

    await subject.verify(token);
    const second = await subject.verify(token);

    expect(second.status).toBe('invalid_token');
  });

  it('refuses a link past its expiry, leaving the report unpublished', async () => {
    const token = await submitAndTakeToken();
    clock = new Date(NOW.getTime() + 31 * 60 * 1000);

    const outcome = await service().verify(token);

    expect(outcome.status).toBe('expired');
    expect(repository.all()[0].status).toBe('pending_verification');
  });

  it.each([[''], ['nonsense'], [null], [undefined], [42], [{}]])(
    'refuses %p without throwing',
    async (token) => {
      await expect(service().verify(token)).resolves.toEqual({
        status: 'invalid_token',
      });
    },
  );

  it('does not accept a token belonging to no report', async () => {
    await submitAndTakeToken();
    const outcome = await service().verify('a'.repeat(43));
    expect(outcome.status).toBe('invalid_token');
  });
});
