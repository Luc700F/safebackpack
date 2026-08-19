// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { MemoryReportRepository } from './memory-repository';
import { describeReportRepository } from './repository-contract';

const repository = new MemoryReportRepository();

describeReportRepository('MemoryReportRepository', async () => ({
  repository,
  reset: async () => repository.clear(),
}));

describe('MemoryReportRepository, beyond the shared contract', () => {
  it('hands out copies, so a caller cannot mutate stored state', async () => {
    const store = new MemoryReportRepository();
    const created = await store.create({
      status: 'pending_verification',
      categoryId: 'theft',
      customCategoryLabel: null,
      description: 'A description long enough to be a real report about theft.',
      timeOfDay: 'night',
      position: { latitude: 13.7563, longitude: 100.5018 },
      countryCode: 'TH',
      reporterFirstName: 'Luca',
      reporterHomeCountry: 'CH',
      publishAnonymously: false,
      reporterEmail: 'traveller@example.com',
      reporterEmailHash: 'a'.repeat(64),
      verificationTokenHash: 'b'.repeat(64),
      verificationExpiresAt: new Date(),
      occurredAt: new Date(),
      createdAt: new Date(),
    });

    created.description = 'tampered';

    expect((await store.findById(created.id))?.description).not.toBe('tampered');
  });
});
