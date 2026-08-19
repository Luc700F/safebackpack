// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryReportRepository } from './memory-repository';
import type { NewReport } from './repository';

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
    ...overrides,
  };
}

let repository: MemoryReportRepository;

beforeEach(() => {
  repository = new MemoryReportRepository();
});

describe('create', () => {
  it('assigns an id and starts unpublished', async () => {
    const report = await repository.create(draft());

    expect(report.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(report.publicPosition).toBeNull();
    expect(report.publishedAt).toBeNull();
    expect(report.expiresAt).toBeNull();
    expect(report.flagCount).toBe(0);
  });

  it('gives each report its own id', async () => {
    const first = await repository.create(draft());
    const second = await repository.create(draft());
    expect(first.id).not.toBe(second.id);
  });
});

describe('findById', () => {
  it('finds a report that exists', async () => {
    const created = await repository.create(draft());
    expect((await repository.findById(created.id))?.id).toBe(created.id);
  });

  it('returns null for an unknown id', async () => {
    expect(await repository.findById('missing')).toBeNull();
  });
});

describe('findByVerificationTokenHash', () => {
  it('finds the report a token belongs to', async () => {
    const created = await repository.create(draft());
    const found = await repository.findByVerificationTokenHash('b'.repeat(64));
    expect(found?.id).toBe(created.id);
  });

  it('returns null for an unknown hash', async () => {
    await repository.create(draft());
    expect(await repository.findByVerificationTokenHash('c'.repeat(64))).toBeNull();
  });
});

describe('publish', () => {
  const details = {
    publicPosition: { latitude: 13.757, longitude: 100.502 },
    publishedAt: NOW,
    expiresAt: new Date(NOW.getTime() + 180 * 24 * 60 * 60 * 1000),
  };

  it('marks the report published and records the displaced position', async () => {
    const created = await repository.create(draft());
    const published = await repository.publish(created.id, details);

    expect(published.status).toBe('published');
    expect(published.publicPosition).toEqual(details.publicPosition);
    expect(published.expiresAt).toEqual(details.expiresAt);
  });

  it('clears the verification token, so a link cannot be reused', async () => {
    const created = await repository.create(draft());
    await repository.publish(created.id, details);

    expect(
      await repository.findByVerificationTokenHash('b'.repeat(64)),
    ).toBeNull();
  });

  it('keeps the exact position untouched', async () => {
    const created = await repository.create(draft());
    const published = await repository.publish(created.id, details);

    expect(published.position).toEqual(created.position);
  });

  it('throws for an unknown report rather than failing silently', async () => {
    await expect(repository.publish('missing', details)).rejects.toThrowError(
      /No such report/,
    );
  });
});

describe('isolation', () => {
  it('hands out copies, so a caller cannot mutate stored state', async () => {
    const created = await repository.create(draft());
    created.description = 'tampered';

    expect((await repository.findById(created.id))?.description).not.toBe(
      'tampered',
    );
  });

  it('clears everything on demand', async () => {
    await repository.create(draft());
    repository.clear();
    expect(repository.all()).toHaveLength(0);
  });
});
