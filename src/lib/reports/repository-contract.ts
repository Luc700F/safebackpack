/**
 * The behaviour every report repository must show, whatever backs it.
 *
 * Both the in-memory store and the Postgres one run this same suite, so the
 * two cannot drift: anything the service relies on is proven against the real
 * database, not only against the convenient stand-in used in unit tests.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import type { NewReport, ReportRepository } from './repository';
import { BASE_RETENTION_DAYS } from './retention';

const NOW = new Date('2026-08-19T12:00:00.000Z');

export interface RepositoryHarness {
  repository: ReportRepository;
  /** Empties the store between tests. */
  reset: () => Promise<void>;
}

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

const publication = {
  publicPosition: { latitude: 13.757, longitude: 100.502 },
  publishedAt: NOW,
  expiresAt: new Date(NOW.getTime() + 90 * 24 * 60 * 60 * 1000),
};

export function describeReportRepository(
  name: string,
  createHarness: () => Promise<RepositoryHarness>,
): void {
  describe(name, () => {
    let repository: ReportRepository;
    let harness: RepositoryHarness;

    beforeEach(async () => {
      harness = await createHarness();
      repository = harness.repository;
      await harness.reset();
    });

    describe('create', () => {
      it('assigns an id and starts unpublished', async () => {
        const report = await repository.create(draft());

        expect(report.id).toBeTruthy();
        expect(report.status).toBe('pending_verification');
        expect(report.publicPosition).toBeNull();
        expect(report.publishedAt).toBeNull();
        expect(report.expiresAt).toBeNull();
        expect(report.flagCount).toBe(0);
        expect(report.confirmationCount).toBe(0);
      });

      it('gives each report its own id', async () => {
        const first = await repository.create(draft());
        const second = await repository.create(
          draft({ reporterEmailHash: 'c'.repeat(64), verificationTokenHash: 'd'.repeat(64) }),
        );

        expect(first.id).not.toBe(second.id);
      });

      it('keeps the position exactly as given', async () => {
        const report = await repository.create(draft());

        expect(report.position?.latitude).toBeCloseTo(13.7563, 5);
        expect(report.position?.longitude).toBeCloseTo(100.5018, 5);
      });

      it('stores a report with no name when it is anonymous', async () => {
        const report = await repository.create(
          draft({ publishAnonymously: true, reporterFirstName: null }),
        );

        expect(report.reporterFirstName).toBeNull();
        expect(report.reporterHomeCountry).toBe('CH');
      });

      it('stores the free-text label for the "other" category', async () => {
        const report = await repository.create(
          draft({ categoryId: 'other', customCategoryLabel: 'Stray dogs' }),
        );

        expect(report.customCategoryLabel).toBe('Stray dogs');
      });
    });

    describe('findById', () => {
      it('finds a report that exists', async () => {
        const created = await repository.create(draft());
        const found = await repository.findById(created.id);

        expect(found?.id).toBe(created.id);
        expect(found?.description).toBe(created.description);
      });

      it('returns null for an id nothing was stored under', async () => {
        expect(
          await repository.findById('00000000-0000-4000-8000-000000000000'),
        ).toBeNull();
      });
    });

    describe('findByVerificationTokenHash', () => {
      it('finds the report a token belongs to', async () => {
        const created = await repository.create(draft());
        const found = await repository.findByVerificationTokenHash(
          'b'.repeat(64),
        );

        expect(found?.id).toBe(created.id);
      });

      it('returns the reporter details needed to publish', async () => {
        await repository.create(draft());
        const found = await repository.findByVerificationTokenHash('b'.repeat(64));

        expect(found?.reporterEmailHash).toBe('a'.repeat(64));
        expect(found?.verificationExpiresAt).toBeInstanceOf(Date);
      });

      it('returns null for a hash nothing was stored under', async () => {
        await repository.create(draft());
        expect(
          await repository.findByVerificationTokenHash('c'.repeat(64)),
        ).toBeNull();
      });
    });

    describe('publish', () => {
      it('marks the report published and records the displaced position', async () => {
        const created = await repository.create(draft());
        const published = await repository.publish(created.id, publication);

        expect(published.status).toBe('published');
        expect(published.publicPosition?.latitude).toBeCloseTo(13.757, 5);
        expect(published.publishedAt?.getTime()).toBe(NOW.getTime());
        expect(published.expiresAt?.getTime()).toBe(
          publication.expiresAt.getTime(),
        );
      });

      it('clears the verification token, so a link cannot be used twice', async () => {
        const created = await repository.create(draft());
        await repository.publish(created.id, publication);

        expect(
          await repository.findByVerificationTokenHash('b'.repeat(64)),
        ).toBeNull();
      });

      it('leaves the exact position untouched', async () => {
        const created = await repository.create(draft());
        const published = await repository.publish(created.id, publication);

        expect(published.position?.latitude).toBeCloseTo(
          created.position!.latitude,
          5,
        );
      });

      it('persists the change rather than only returning it', async () => {
        const created = await repository.create(draft());
        await repository.publish(created.id, publication);

        expect((await repository.findById(created.id))?.status).toBe(
          'published',
        );
      });

      it('throws for an unknown report rather than failing silently', async () => {
        await expect(
          repository.publish('00000000-0000-4000-8000-000000000000', publication),
        ).rejects.toThrow();
      });
    });

    describe('findPublished', () => {
      const older = new Date(NOW.getTime() - 60 * 24 * 60 * 60 * 1000);
      const since = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);

      async function publish(
        overrides: Partial<NewReport>,
        publishedAt = NOW,
      ): Promise<string> {
        const created = await repository.create(draft(overrides));
        await repository.publish(created.id, { ...publication, publishedAt });
        return created.id;
      }

      it('returns a published report', async () => {
        const id = await publish({});

        const found = await repository.findPublished({
          occurredSince: since,
          limit: 10,
        });

        expect(found.map((r) => r.id)).toEqual([id]);
      });

      it('leaves out a report that was never published', async () => {
        await repository.create(draft());

        expect(
          await repository.findPublished({ occurredSince: since, limit: 10 }),
        ).toEqual([]);
      });

      it('leaves out an incident older than the window', async () => {
        await publish({ occurredAt: older });

        expect(
          await repository.findPublished({ occurredSince: since, limit: 10 }),
        ).toEqual([]);
      });

      it('judges by the day it happened, not the day it was published', async () => {
        // Filed today, about something well before the window. "Past week"
        // has to mean the past week of incidents, or a month-old robbery
        // shows up as news because the paperwork is new.
        await publish({ occurredAt: older }, NOW);

        expect(
          await repository.findPublished({ occurredSince: since, limit: 10 }),
        ).toEqual([]);
      });

      it('filters by category', async () => {
        const theft = await publish({ categoryId: 'theft' });
        await publish({
          categoryId: 'scam',
          reporterEmailHash: 'e'.repeat(64),
          verificationTokenHash: 'f'.repeat(64),
        });

        const found = await repository.findPublished({
          occurredSince: since,
          categories: ['theft'],
          limit: 10,
        });

        expect(found.map((r) => r.id)).toEqual([theft]);
      });

      it('treats an empty category list as no filter', async () => {
        await publish({});

        const found = await repository.findPublished({
          occurredSince: since,
          categories: [],
          limit: 10,
        });

        expect(found).toHaveLength(1);
      });

      it('filters by country', async () => {
        await publish({ countryCode: 'TH' });

        expect(
          await repository.findPublished({
            occurredSince: since,
            countryCode: 'CH',
            limit: 10,
          }),
        ).toEqual([]);
      });

      it('returns the most recent incident first', async () => {
        const old = await publish({
          reporterEmailHash: '1'.repeat(64),
          verificationTokenHash: '1'.repeat(64),
          occurredAt: new Date(NOW.getTime() - 5000),
        });
        const fresh = await publish({
          reporterEmailHash: '2'.repeat(64),
          verificationTokenHash: '2'.repeat(64),
          occurredAt: NOW,
        });

        const found = await repository.findPublished({
          occurredSince: since,
          limit: 10,
        });

        expect(found.map((r) => r.id)).toEqual([fresh, old]);
      });

      it('honours the limit', async () => {
        for (let i = 0; i < 4; i += 1) {
          await publish({
            reporterEmailHash: String(i).repeat(64),
            verificationTokenHash: `${i}${'a'.repeat(63)}`,
          });
        }

        expect(
          await repository.findPublished({ occurredSince: since, limit: 2 }),
        ).toHaveLength(2);
      });

      it('carries the displaced position, not the exact one', async () => {
        await publish({});

        const [found] = await repository.findPublished({
          occurredSince: since,
          limit: 10,
        });

        expect(found.publicPosition?.latitude).toBeCloseTo(13.757, 4);
        expect(found.publicPosition?.latitude).not.toBeCloseTo(13.7563, 4);
      });
    });

    describe('flags', () => {
      async function published(): Promise<string> {
        const created = await repository.create(draft());
        await repository.publish(created.id, publication);
        return created.id;
      }

      const flag = (reportId: string, reporterIpHash: string) => ({
        reportId,
        reason: 'inaccurate' as const,
        reporterIpHash,
        createdAt: NOW,
      });

      it('counts a reader objection', async () => {
        const id = await published();

        await expect(repository.addFlag(flag(id, 'reader-1'))).resolves.toBe(1);
        expect((await repository.findById(id))?.flagCount).toBe(1);
      });

      it('counts different readers separately', async () => {
        const id = await published();

        await repository.addFlag(flag(id, 'reader-1'));
        await expect(repository.addFlag(flag(id, 'reader-2'))).resolves.toBe(2);
      });

      it('counts one machine once, however often it presses', async () => {
        const id = await published();

        await repository.addFlag(flag(id, 'the-same-reader'));
        await expect(
          repository.addFlag(flag(id, 'the-same-reader')),
        ).resolves.toBe(1);
      });

      it('takes a flagged report off the map', async () => {
        const id = await published();
        await repository.hideAfterFlags(id);

        expect((await repository.findById(id))?.status).toBe('held_for_review');
      });

      it('does nothing when the report is already off the map', async () => {
        const id = await published();
        await repository.hideAfterFlags(id);

        await expect(repository.hideAfterFlags(id)).resolves.toBeUndefined();
      });

      it('throws when flagging a report that does not exist', async () => {
        await expect(
          repository.addFlag(flag('00000000-0000-4000-8000-000000000000', 'r')),
        ).rejects.toThrow();
      });
    });

    describe('anonymisation', () => {
      const expired = {
        ...publication,
        expiresAt: new Date(NOW.getTime() - 1000),
      };

      const retained = {
        categoryId: 'theft' as const,
        countryCode: 'TH',
        timeOfDayId: 'night' as const,
        cellLatitude: 13.7,
        cellLongitude: 100.5,
        month: '2026-08',
        confirmationCount: 0,
      };

      it('finds a report whose time on the map is up', async () => {
        const created = await repository.create(draft());
        await repository.publish(created.id, expired);

        const due = await repository.findDueForAnonymisation(NOW, 10);
        expect(due.map((r) => r.id)).toEqual([created.id]);
      });

      it('leaves a report that is still current alone', async () => {
        const created = await repository.create(draft());
        await repository.publish(created.id, publication);

        expect(await repository.findDueForAnonymisation(NOW, 10)).toEqual([]);
      });

      it('ignores a report that was never published', async () => {
        await repository.create(draft());
        expect(await repository.findDueForAnonymisation(NOW, 10)).toEqual([]);
      });

      it('returns at most the requested number', async () => {
        for (let i = 0; i < 3; i += 1) {
          const created = await repository.create(
            draft({
              reporterEmailHash: String(i).repeat(64),
              verificationTokenHash: `${i}${'e'.repeat(63)}`,
            }),
          );
          await repository.publish(created.id, expired);
        }

        expect(await repository.findDueForAnonymisation(NOW, 2)).toHaveLength(2);
      });

      it('erases every personal field', async () => {
        const created = await repository.create(draft());
        await repository.publish(created.id, expired);
        await repository.anonymise(created.id, retained, NOW);

        const after = await repository.findById(created.id);
        expect(after?.description).toBeNull();
        expect(after?.reporterFirstName).toBeNull();
        expect(after?.reporterEmail).toBeFalsy();
        expect(after?.reporterEmailHash).toBeNull();
        expect(after?.position).toBeNull();
        expect(after?.publicPosition).toBeNull();
      });

      it('keeps what a statistic is built from', async () => {
        const created = await repository.create(draft());
        await repository.publish(created.id, expired);
        await repository.anonymise(created.id, retained, NOW);

        const after = await repository.findById(created.id);
        expect(after?.status).toBe('archived');
        expect(after?.retained).toEqual(retained);
        expect(after?.anonymisedAt).toBeInstanceOf(Date);
        expect(after?.countryCode).toBe('TH');
        expect(after?.reporterHomeCountry).toBe('CH');
      });

      it('does not offer the same report twice', async () => {
        const created = await repository.create(draft());
        await repository.publish(created.id, expired);
        await repository.anonymise(created.id, retained, NOW);

        expect(await repository.findDueForAnonymisation(NOW, 10)).toEqual([]);
      });

      it('throws for an unknown report', async () => {
        await expect(
          repository.anonymise(
            '00000000-0000-4000-8000-000000000000',
            retained,
            NOW,
          ),
        ).rejects.toThrow();
      });
    });

    describe('deleting what was never published', () => {
      const MS_PER_DAY = 24 * 60 * 60 * 1000;
      const longAgo = new Date(
        NOW.getTime() - (BASE_RETENTION_DAYS + 1) * MS_PER_DAY,
      );

      it('finds a draft whose verification link has lapsed', async () => {
        const created = await repository.create(
          draft({ verificationExpiresAt: new Date(NOW.getTime() - 1000) }),
        );

        const due = await repository.findDueForDeletion(NOW, 10);
        expect(due.map((report) => report.id)).toEqual([created.id]);
      });

      it('leaves a draft whose link is still good', async () => {
        await repository.create(draft());

        expect(await repository.findDueForDeletion(NOW, 10)).toEqual([]);
      });

      it('finds a held report nobody reviewed in time', async () => {
        const created = await repository.create(
          draft({
            status: 'held_for_review',
            screeningDecision: 'hold',
            verificationExpiresAt: null,
            createdAt: longAgo,
          }),
        );

        const due = await repository.findDueForDeletion(NOW, 10);
        expect(due.map((report) => report.id)).toEqual([created.id]);
      });

      it('leaves a held report the queue may still reach', async () => {
        await repository.create(
          draft({
            status: 'held_for_review',
            screeningDecision: 'hold',
            verificationExpiresAt: null,
            createdAt: NOW,
          }),
        );

        expect(await repository.findDueForDeletion(NOW, 10)).toEqual([]);
      });

      it('never offers up a published report', async () => {
        const created = await repository.create(draft({ createdAt: longAgo }));
        await repository.publish(created.id, {
          ...publication,
          publishedAt: NOW,
        });

        expect(await repository.findDueForDeletion(NOW, 10)).toEqual([]);
      });

      it('honours the batch size', async () => {
        for (const suffix of ['1', '2', '3']) {
          await repository.create(
            draft({
              verificationExpiresAt: new Date(NOW.getTime() - 1000),
              reporterEmailHash: suffix.repeat(64),
              verificationTokenHash: suffix.repeat(64),
            }),
          );
        }

        expect(await repository.findDueForDeletion(NOW, 2)).toHaveLength(2);
      });

      it('removes the report for good', async () => {
        const created = await repository.create(
          draft({ verificationExpiresAt: new Date(NOW.getTime() - 1000) }),
        );

        await repository.deleteReport(created.id);

        expect(await repository.findById(created.id)).toBeNull();
        expect(await repository.findDueForDeletion(NOW, 10)).toEqual([]);
      });

      it('goes through even when rows hang off it', async () => {
        // Without `on delete cascade` Postgres refuses the delete outright and
        // the report stays, personal data and all. Asserting the confirmations
        // are gone afterwards would prove nothing: they read as empty either
        // way once the report has no id.
        const created = await repository.create(draft());
        await repository.addFlag({
          reportId: created.id,
          reason: 'inaccurate',
          reporterIpHash: 'c'.repeat(64),
          createdAt: NOW,
        });

        await expect(
          repository.deleteReport(created.id),
        ).resolves.toBeUndefined();
        expect(await repository.findById(created.id)).toBeNull();
      });

      it('throws for an unknown report', async () => {
        await expect(
          repository.deleteReport('00000000-0000-4000-8000-000000000000'),
        ).rejects.toThrow();
      });
    });
  });
}
