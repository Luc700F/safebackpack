// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryReportRepository } from './memory-repository';
import type { NewReport } from './repository';
import { runRetention } from './retention-job';

const NOW = new Date('2026-08-19T12:00:00.000Z');

function draft(overrides: Partial<NewReport> = {}): NewReport {
  return {
    status: 'pending_verification',
    categoryId: 'theft',
    customCategoryLabel: null,
    description: 'A description long enough to be a real report about a theft.',
    timeOfDay: 'night',
    position: { latitude: 13.7563, longitude: 100.5018 },
    countryCode: 'TH',
    reporterFirstName: 'Luca',
    reporterHomeCountry: 'CH',
    publishAnonymously: false,
    reporterEmail: 'traveller@example.com',
    reporterEmailHash: 'a'.repeat(64),
    verificationTokenHash: 'b'.repeat(64),
    verificationExpiresAt: new Date(NOW.getTime() + 30 * 60 * 1000),
    occurredAt: NOW,
    createdAt: NOW,
    screeningDecision: 'publish' as const,
    screeningReasons: [],
    ...overrides,
  };
}

let repository: MemoryReportRepository;

async function publishedReport(expiresAt: Date, overrides: Partial<NewReport> = {}) {
  const created = await repository.create(draft(overrides));
  await repository.publish(created.id, {
    publicPosition: { latitude: 13.757, longitude: 100.502 },
    publishedAt: new Date('2026-05-01T00:00:00.000Z'),
    expiresAt,
  });
  return created.id;
}

const expired = new Date(NOW.getTime() - 1000);
const current = new Date(NOW.getTime() + 86_400_000);

beforeEach(() => {
  repository = new MemoryReportRepository();
});

describe('runRetention', () => {
  it('does nothing when there is nothing to do', async () => {
    expect(await runRetention(repository, NOW)).toEqual({
      anonymised: 0,
      failures: [],
    });
  });

  it('anonymises an expired report', async () => {
    const id = await publishedReport(expired);

    const result = await runRetention(repository, NOW);

    expect(result.anonymised).toBe(1);
    expect((await repository.findById(id))?.status).toBe('archived');
  });

  it('leaves a current report untouched', async () => {
    const id = await publishedReport(current);

    await runRetention(repository, NOW);

    expect((await repository.findById(id))?.status).toBe('published');
    expect((await repository.findById(id))?.description).not.toBeNull();
  });

  it('strips every personal field from what it processes', async () => {
    const id = await publishedReport(expired);

    await runRetention(repository, NOW);
    const after = await repository.findById(id);

    expect(after?.description).toBeNull();
    expect(after?.reporterFirstName).toBeNull();
    expect(after?.reporterEmail).toBeNull();
    expect(after?.reporterEmailHash).toBeNull();
    expect(after?.position).toBeNull();
    expect(after?.publicPosition).toBeNull();
  });

  it('retains the coarse facts a statistic needs', async () => {
    const id = await publishedReport(expired);

    await runRetention(repository, NOW);
    const after = await repository.findById(id);

    expect(after?.retained).toEqual({
      categoryId: 'theft',
      countryCode: 'TH',
      timeOfDayId: 'night',
      cellLatitude: 13.7,
      cellLongitude: 100.5,
      month: '2026-05',
      confirmationCount: 0,
    });
  });

  it('works through a backlog larger than one batch', async () => {
    for (let i = 0; i < 7; i += 1) {
      await publishedReport(expired, {
        reporterEmailHash: String(i).repeat(64),
        verificationTokenHash: `${i}${'e'.repeat(63)}`,
      });
    }

    expect((await runRetention(repository, NOW, 2)).anonymised).toBe(7);
  });

  it('is safe to run twice', async () => {
    await publishedReport(expired);

    await runRetention(repository, NOW);
    expect((await runRetention(repository, NOW)).anonymised).toBe(0);
  });

  it('keeps going when one report cannot be processed', async () => {
    const broken = await publishedReport(expired, {
      reporterEmailHash: 'c'.repeat(64),
      verificationTokenHash: 'f'.repeat(64),
    });
    await publishedReport(expired);

    // A row with no position cannot produce a retained summary.
    const stored = await repository.findById(broken);
    await repository.publish(broken, {
      publicPosition: { latitude: 0, longitude: 0 },
      publishedAt: stored!.publishedAt!,
      expiresAt: expired,
    });
    repository.corrupt(broken, { position: null });

    const result = await runRetention(repository, NOW);

    expect(result.anonymised).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].id).toBe(broken);
  });

  it('stops rather than looping forever on rows it cannot process', async () => {
    const id = await publishedReport(expired);
    repository.corrupt(id, { position: null });

    const result = await runRetention(repository, NOW, 1);

    expect(result.anonymised).toBe(0);
    expect(result.failures).toHaveLength(1);
  });
});
