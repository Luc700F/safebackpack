import { describe, expect, it } from 'vitest';

import { HeuristicScreener, PermissiveScreener } from './screening';

const screener = new HeuristicScreener();

const ORDINARY =
  'Two men on a scooter grabbed my bag near the night market entrance and rode off towards the river.';

async function decide(description: string) {
  return screener.screen({ description });
}

describe('HeuristicScreener', () => {
  it('publishes an ordinary report', async () => {
    await expect(decide(ORDINARY)).resolves.toEqual({
      decision: 'publish',
      reasons: [],
    });
  });

  it.each([
    ['We booked through https://cheap-tours.example and regretted it.'],
    ['Message me at traveller@example.com for details.'],
    ['The driver called +66 81 234 5678 to get help.'],
    ['Ask for cheaptours.com when you get there.'],
  ])('holds a report containing contact details: %s', async (description) => {
    const verdict = await decide(description);
    expect(verdict.decision).toBe('hold');
    expect(verdict.reasons.length).toBeGreaterThan(0);
  });

  it('holds a report that names a person', async () => {
    const verdict = await decide(
      'A man called Peter Fischer took our money and never came back.',
    );

    expect(verdict.decision).toBe('hold');
    expect(verdict.reasons).toContain('appears to name a person');
  });

  it('holds abusive language', async () => {
    const verdict = await decide(
      'The taxi driver was a complete bitch about the fare and drove off angrily.',
    );

    expect(verdict.decision).toBe('hold');
    expect(verdict.reasons).toContain('contains abusive language');
  });

  it('does not mistake a word containing a slur for the slur itself', async () => {
    await expect(
      decide(
        'The path along the scunthorpe canal is poorly lit and feels unsafe at night.',
      ),
    ).resolves.toMatchObject({ decision: 'publish' });
  });

  it('holds a report written mostly in capitals', async () => {
    const verdict = await decide(
      'THIS PLACE IS COMPLETELY UNSAFE AND NOBODY SHOULD EVER GO THERE AT ALL',
    );

    expect(verdict.reasons).toContain('written mostly in capitals');
  });

  it('does not object to a short phrase in capitals', async () => {
    await expect(
      decide(
        'The sign just said STOP and nothing else, which was not much help at the crossing.',
      ),
    ).resolves.toMatchObject({ decision: 'publish' });
  });

  it('screens the free-text category label as well as the description', async () => {
    await expect(
      screener.screen({
        description: ORDINARY,
        // A real top-level domain: `.example` is reserved for documentation
        // and is deliberately not in the list the screener watches for.
        customCategoryLabel: 'see badtours.com',
      }),
    ).resolves.toMatchObject({ decision: 'hold' });
  });

  it('gives every reason it found, not only the first', async () => {
    const verdict = await decide(
      'Contact bad@example.com or visit https://bad.example immediately.',
    );

    expect(verdict.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it('leaves ordinary reports alone', async () => {
    for (const description of [
      'Pickpockets work the crowd along the main road after dark, especially near the bars.',
      'The bus north was fine but the road is very winding and slow, allow extra time.',
    ]) {
      await expect(decide(description)).resolves.toMatchObject({
        decision: 'publish',
      });
    }
  });
});

describe('PermissiveScreener', () => {
  it('publishes anything, for tests about something else', async () => {
    await expect(
      new PermissiveScreener().screen(),
    ).resolves.toEqual({ decision: 'publish', reasons: [] });
  });
});
