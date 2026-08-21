// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';

import { RecordingEmailSender } from '../email/fake';
import { HeuristicScreener, PermissiveScreener } from '../moderation/screening';
import { distanceMetres, FUZZ_RADIUS_METRES } from '../geo/coordinates';
import { StaticCountryLocator } from '../geo/country-locator';
import { MemoryRateLimitStore } from '../security/rate-limit-store';
import { RateLimiter } from '../security/rate-limiter';
import { hashEmail } from '../verification/email-hash';
import { createRecognitionToken } from '../verification/recognition';
import { MemoryReportRepository } from './memory-repository';
import { BASE_RETENTION_DAYS } from './retention';
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
    // Most of these tests are about the report flow, not about screening.
    screener: new PermissiveScreener(),
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
    expect(
      distanceMetres(report.position!, report.publicPosition!),
    ).toBeLessThanOrEqual(FUZZ_RADIUS_METRES + 1);
    expect(
      distanceMetres(report.position!, report.publicPosition!),
    ).toBeGreaterThan(0);
  });

  it('sets the deletion date six months out', async () => {
    const token = await submitAndTakeToken();
    await service().verify(token);

    const [report] = repository.all();
    expect(report.expiresAt?.getTime()).toBe(
      NOW.getTime() + BASE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
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

describe('confirm', () => {
  const reporterHash = hashEmail('traveller@example.com', SECRET);
  const otherHash = hashEmail('someone.else@example.com', SECRET);

  async function publishedReport(): Promise<string> {
    await service().submit(submission(), { ipHash: 'ip1' });
    const url = new URL(/https:\/\/\S+/.exec(emailSender.lastMessage!.text)![0]);
    const outcome = await service().verify(url.searchParams.get('token')!);
    return outcome.status === 'published' ? outcome.reportId : '';
  }

  // Signed at the current clock: recognition lapses after 30 days, so a token
  // minted at the start of the test would be stale by the time a late
  // confirmation is made.
  function tokenFor(emailHash: string): string {
    return createRecognitionToken(emailHash, SECRET, clock);
  }

  it('records that a report still applies', async () => {
    const id = await publishedReport();

    const outcome = await service().confirm(id, 'still_valid', {
      recognitionToken: tokenFor(otherHash),
    });

    expect(outcome).toMatchObject({ status: 'recorded', confirmations: 1 });
  });

  it('counts the extension from the confirmation, not from publication', async () => {
    const id = await publishedReport();

    // Confirmed on day 50, so it should now run to day 80 rather than day 60.
    clock = new Date(NOW.getTime() + 50 * 24 * 60 * 60 * 1000);
    await service().confirm(id, 'still_valid', {
      recognitionToken: tokenFor(otherHash),
    });

    const report = (await repository.findById(id))!;
    expect(report.expiresAt!.getTime()).toBe(
      clock.getTime() + 30 * 24 * 60 * 60 * 1000,
    );
  });

  it('records when the report was last confirmed', async () => {
    const id = await publishedReport();

    clock = new Date(NOW.getTime() + 10 * 24 * 60 * 60 * 1000);
    await service().confirm(id, 'still_valid', {
      recognitionToken: tokenFor(otherHash),
    });

    expect((await repository.findById(id))!.lastConfirmedAt).toEqual(clock);
  });

  it('does not treat "no longer applies" as a confirmation', async () => {
    const id = await publishedReport();
    const before = (await repository.findById(id))!.expiresAt!.getTime();

    clock = new Date(NOW.getTime() + 50 * 24 * 60 * 60 * 1000);
    await service().confirm(id, 'no_longer_valid', {
      recognitionToken: tokenFor(otherHash),
    });

    const report = (await repository.findById(id))!;
    expect(report.lastConfirmedAt).toBeNull();
    expect(report.expiresAt!.getTime()).toBe(before);
  });

  it('does not extend anything when someone says it is over', async () => {
    const id = await publishedReport();
    const before = (await repository.findById(id))!.expiresAt!.getTime();

    await service().confirm(id, 'no_longer_valid', {
      recognitionToken: tokenFor(otherHash),
    });

    expect((await repository.findById(id))!.expiresAt!.getTime()).toBe(before);
  });

  it('retires the report once two people say it no longer applies', async () => {
    const id = await publishedReport();

    await service().confirm(id, 'no_longer_valid', {
      recognitionToken: tokenFor(otherHash),
    });
    const second = await service().confirm(id, 'no_longer_valid', {
      recognitionToken: tokenFor(hashEmail('third@example.com', SECRET)),
    });

    expect(second).toMatchObject({ status: 'recorded', retired: true });
    expect((await repository.findById(id))!.status).toBe('retired');
  });

  it('does not retire on a single dissenting voice', async () => {
    const id = await publishedReport();

    const outcome = await service().confirm(id, 'no_longer_valid', {
      recognitionToken: tokenFor(otherHash),
    });

    expect(outcome).toMatchObject({ retired: false });
    expect((await repository.findById(id))!.status).toBe('published');
  });

  it('refuses the reporter vouching for their own report', async () => {
    const id = await publishedReport();

    const outcome = await service().confirm(id, 'still_valid', {
      recognitionToken: tokenFor(reporterHash),
    });

    expect(outcome).toEqual({ status: 'refused', reason: 'own_report' });
  });

  it('refuses a second answer from the same person', async () => {
    const id = await publishedReport();
    const token = tokenFor(otherHash);

    await service().confirm(id, 'still_valid', { recognitionToken: token });
    const second = await service().confirm(id, 'no_longer_valid', {
      recognitionToken: token,
    });

    expect(second).toEqual({ status: 'refused', reason: 'already_confirmed' });
  });

  it.each([[undefined], [null], [''], ['garbage']])(
    'asks an unrecognised visitor to verify first, for token %p',
    async (recognitionToken) => {
      const id = await publishedReport();

      await expect(
        service().confirm(id, 'still_valid', {
          recognitionToken: recognitionToken as string | null | undefined,
        }),
      ).resolves.toEqual({ status: 'not_recognised' });
    },
  );

  it('ignores a token signed with the wrong secret', async () => {
    const id = await publishedReport();

    await expect(
      service().confirm(id, 'still_valid', {
        recognitionToken: createRecognitionToken(otherHash, 'forged', NOW),
      }),
    ).resolves.toEqual({ status: 'not_recognised' });
  });

  it('reports an unknown report rather than throwing', async () => {
    await expect(
      service().confirm('00000000-0000-4000-8000-000000000000', 'still_valid', {
        recognitionToken: tokenFor(otherHash),
      }),
    ).resolves.toEqual({ status: 'not_found' });
  });

  it('refuses to confirm a report that was never published', async () => {
    await service().submit(submission(), { ipHash: 'ip1' });
    const [draft] = repository.all();

    const outcome = await service().confirm(draft.id, 'still_valid', {
      recognitionToken: tokenFor(otherHash),
    });

    expect(outcome).toEqual({ status: 'not_found' });
  });

  it('never lets a chain of confirmations push a report past the ceiling', async () => {
    const id = await publishedReport();

    // Somebody confirms it every fortnight for half a year.
    for (let i = 1; i <= 12; i += 1) {
      clock = new Date(NOW.getTime() + i * 14 * 24 * 60 * 60 * 1000);
      await service().confirm(id, 'still_valid', {
        recognitionToken: tokenFor(hashEmail(`c${i}@example.com`, SECRET)),
      });
    }

    const report = (await repository.findById(id))!;
    const lifetimeDays =
      (report.expiresAt!.getTime() - report.publishedAt!.getTime()) /
      (24 * 60 * 60 * 1000);

    expect(lifetimeDays).toBe(90);
  });
});

describe('screening', () => {
  function screeningService() {
    return new ReportService({
      repository,
      emailSender,
      countryLocator: new StaticCountryLocator('TH'),
      rateLimiter: new RateLimiter(store, () => clock),
      screener: new HeuristicScreener(),
      secret: SECRET,
      siteUrl: 'https://safebackpack.app',
      clock: () => clock,
    });
  }

  const SUSPECT = submission({
    description:
      'A man called Peter Fischer took our money outside the station and never came back with the tickets.',
  }) as Record<string, unknown>;

  it('records the verdict with the report', async () => {
    await screeningService().submit(SUSPECT, { ipHash: 'ip1' });

    const [report] = repository.all();
    expect(report.screeningDecision).toBe('hold');
    expect(report.screeningReasons).toContain('appears to name a person');
  });

  it('still asks the reporter to confirm, so nothing looks rejected', async () => {
    const outcome = await screeningService().submit(SUSPECT, { ipHash: 'ip1' });

    expect(outcome.status).toBe('verification_sent');
  });

  it('holds it for review instead of publishing, even once confirmed', async () => {
    const subject = screeningService();
    await subject.submit(SUSPECT, { ipHash: 'ip1' });

    const url = new URL(/https:\/\/\S+/.exec(emailSender.lastMessage!.text)![0]);
    const outcome = await subject.verify(url.searchParams.get('token')!);

    expect(outcome.status).toBe('published');
    expect(repository.all()[0].status).toBe('held_for_review');
  });

  it('keeps a held report off the map', async () => {
    const subject = screeningService();
    await subject.submit(SUSPECT, { ipHash: 'ip1' });
    const url = new URL(/https:\/\/\S+/.exec(emailSender.lastMessage!.text)![0]);
    await subject.verify(url.searchParams.get('token')!);

    const visible = await subject.listPublished({ window: '90d' });
    expect(visible.reports).toEqual([]);
  });

  it('publishes an ordinary report as before', async () => {
    const subject = screeningService();
    await subject.submit(submission(), { ipHash: 'ip1' });
    const url = new URL(/https:\/\/\S+/.exec(emailSender.lastMessage!.text)![0]);
    await subject.verify(url.searchParams.get('token')!);

    expect(repository.all()[0].status).toBe('published');
  });

  it('does not let a recognised reporter skip screening', async () => {
    const emailHash = hashEmail('traveller@example.com', SECRET);

    const outcome = await screeningService().submit(SUSPECT, {
      ipHash: 'ip1',
      recognitionToken: createRecognitionToken(emailHash, SECRET, clock),
    });

    expect(outcome.status).toBe('published');
    expect(repository.all()[0].status).toBe('held_for_review');
  });
});

describe('moderation', () => {
  function screeningService() {
    return new ReportService({
      repository,
      emailSender,
      countryLocator: new StaticCountryLocator('TH'),
      rateLimiter: new RateLimiter(store, () => clock),
      screener: new HeuristicScreener(),
      secret: SECRET,
      siteUrl: 'https://safebackpack.app',
      clock: () => clock,
    });
  }

  const SUSPECT = submission({
    description:
      'A man called Peter Fischer took our money outside the station and never came back with the tickets.',
  }) as Record<string, unknown>;

  async function heldReport(): Promise<string> {
    const subject = screeningService();
    await subject.submit(SUSPECT, { ipHash: 'ip1' });
    const url = new URL(/https:\/\/\S+/.exec(emailSender.lastMessage!.text)![0]);
    await subject.verify(url.searchParams.get('token')!);
    return repository.all()[0].id;
  }

  it('lists what is waiting to be looked at', async () => {
    const id = await heldReport();

    const queue = await screeningService().listHeldForReview();

    expect(queue.map((report) => report.id)).toEqual([id]);
  });

  it('shows the moderator what the screener objected to', async () => {
    await heldReport();

    const [report] = await screeningService().listHeldForReview();

    expect(report.screeningReasons).toContain('appears to name a person');
    expect(report.description).toContain('Peter Fischer');
  });

  it('leaves published reports out of the queue', async () => {
    const subject = screeningService();
    await subject.submit(submission(), { ipHash: 'ip1' });
    const url = new URL(/https:\/\/\S+/.exec(emailSender.lastMessage!.text)![0]);
    await subject.verify(url.searchParams.get('token')!);

    expect(await subject.listHeldForReview()).toEqual([]);
  });

  it('puts an approved report on the map, screening verdict notwithstanding', async () => {
    const id = await heldReport();

    await expect(screeningService().approveHeld(id)).resolves.toEqual({
      status: 'done',
    });

    const report = (await repository.findById(id))!;
    expect(report.status).toBe('published');
    expect(report.publicPosition).not.toBeNull();
    expect(report.expiresAt).not.toBeNull();
  });

  it('blurs the position of an approved report like any other', async () => {
    const id = await heldReport();
    await screeningService().approveHeld(id);

    const report = (await repository.findById(id))!;
    expect(report.publicPosition).not.toEqual(report.position);
  });

  it('takes a rejected report out of the queue for good', async () => {
    const id = await heldReport();

    await expect(screeningService().rejectHeld(id)).resolves.toEqual({
      status: 'done',
    });

    expect((await repository.findById(id))!.status).toBe('rejected');
    expect(await screeningService().listHeldForReview()).toEqual([]);
  });

  it('keeps a rejected report off the map', async () => {
    const id = await heldReport();
    await screeningService().rejectHeld(id);

    const visible = await screeningService().listPublished({ window: '90d' });
    expect(visible.reports).toEqual([]);
  });

  it.each([['approveHeld'], ['rejectHeld']] as const)(
    '%s reports an unknown report rather than throwing',
    async (method) => {
      await expect(
        screeningService()[method]('00000000-0000-4000-8000-000000000000'),
      ).resolves.toEqual({ status: 'not_found' });
    },
  );

  it.each([['approveHeld'], ['rejectHeld']] as const)(
    '%s refuses a report that is not in the queue',
    async (method) => {
      const subject = screeningService();
      await subject.submit(submission(), { ipHash: 'ip1' });
      const draft = repository.all()[0];

      await expect(subject[method](draft.id)).resolves.toEqual({
        status: 'not_found',
      });
    },
  );
});
