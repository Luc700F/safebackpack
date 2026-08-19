import { describe, expect, it } from 'vitest';

import { NotPublishedError, toPublicReport } from './public-report';
import type { StoredReport } from './repository';

const NOW = new Date('2026-08-19T12:00:00.000Z');

function stored(overrides: Partial<StoredReport> = {}): StoredReport {
  return {
    id: 'report-1',
    status: 'published',
    categoryId: 'theft',
    customCategoryLabel: null,
    description: 'A description long enough to be a real report about a theft.',
    timeOfDay: 'night',
    position: { latitude: 13.7563, longitude: 100.5018 },
    publicPosition: { latitude: 13.757, longitude: 100.502 },
    countryCode: 'TH',
    reporterFirstName: 'Luca',
    reporterHomeCountry: 'CH',
    publishAnonymously: false,
    reporterEmail: 'traveller@example.com',
    reporterEmailHash: 'a'.repeat(64),
    verificationTokenHash: null,
    verificationExpiresAt: null,
    occurredAt: NOW,
    createdAt: NOW,
    publishedAt: NOW,
    expiresAt: new Date(NOW.getTime() + 90 * 24 * 60 * 60 * 1000),
    flagCount: 0,
    confirmationCount: 3,
    lastConfirmedAt: null,
    retained: null,
    anonymisedAt: null,
    ...overrides,
  };
}

describe('toPublicReport', () => {
  it('carries what a reader needs', () => {
    expect(toPublicReport(stored())).toMatchObject({
      id: 'report-1',
      categoryId: 'theft',
      timeOfDay: 'night',
      countryCode: 'TH',
      reporterFirstName: 'Luca',
      reporterHomeCountry: 'CH',
      confirmations: 3,
    });
  });

  it('publishes the displaced position, never the exact one', () => {
    const publicReport = toPublicReport(stored());

    expect(publicReport.latitude).toBe(13.757);
    expect(publicReport.longitude).toBe(100.502);
    expect(publicReport.latitude).not.toBe(13.7563);
  });

  it('has no field at all for the exact position', () => {
    const serialised = JSON.stringify(toPublicReport(stored()));

    expect(serialised).not.toContain('13.7563');
    expect(serialised).not.toContain('100.5018');
  });

  it('never carries the email address or its hash', () => {
    const serialised = JSON.stringify(toPublicReport(stored()));

    expect(serialised).not.toContain('traveller@example.com');
    expect(serialised).not.toContain('a'.repeat(64));
  });

  it('withholds the name when the reporter asked for that', () => {
    const publicReport = toPublicReport(
      stored({ publishAnonymously: true, reporterFirstName: null }),
    );

    expect(publicReport.reporterFirstName).toBeNull();
    expect(publicReport.reporterHomeCountry).toBe('CH');
  });

  it('withholds the name even if one was left in the row', () => {
    const publicReport = toPublicReport(
      stored({ publishAnonymously: true, reporterFirstName: 'Luca' }),
    );

    expect(publicReport.reporterFirstName).toBeNull();
  });

  it('carries when it was last confirmed, so a reader can judge it', () => {
    const confirmed = new Date('2026-08-18T09:00:00.000Z');

    expect(
      toPublicReport(stored({ lastConfirmedAt: confirmed })).lastConfirmedAt,
    ).toBe('2026-08-18T09:00:00.000Z');
  });

  it('says null when nobody has confirmed it', () => {
    expect(toPublicReport(stored()).lastConfirmedAt).toBeNull();
  });

  it('carries the heatmap weight of the category', () => {
    expect(toPublicReport(stored({ categoryId: 'robbery' })).severity).toBe(1);
    expect(toPublicReport(stored({ categoryId: 'scam' })).severity).toBe(0.3);
  });

  it.each([
    ['pending_verification'],
    ['screening'],
    ['held_for_review'],
    ['rejected'],
    ['retired'],
    ['archived'],
  ])('refuses to serialise a report in status %s', (status) => {
    expect(() =>
      toPublicReport(stored({ status: status as StoredReport['status'] })),
    ).toThrowError(NotPublishedError);
  });

  it('refuses a report with no displaced position', () => {
    expect(() => toPublicReport(stored({ publicPosition: null }))).toThrowError(
      NotPublishedError,
    );
  });

  it('refuses an anonymised report whose description is gone', () => {
    expect(() => toPublicReport(stored({ description: null }))).toThrowError(
      NotPublishedError,
    );
  });
});
