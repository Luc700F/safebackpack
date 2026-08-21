import { describe, expect, it, vi } from 'vitest';

import { StaticClassifier, type TextClassifier } from './classifier';
import { CompositeScreener } from './composite-screener';
import { HeuristicScreener, PermissiveScreener } from './screening';

const ORDINARY =
  'Two men on a scooter grabbed my bag near the night market entrance and rode off.';

describe('CompositeScreener', () => {
  it('publishes what both layers accept', async () => {
    const screener = new CompositeScreener(
      new HeuristicScreener(),
      new StaticClassifier(),
    );

    await expect(screener.screen({ description: ORDINARY })).resolves.toEqual({
      decision: 'publish',
      reasons: [],
    });
  });

  it('holds what the classifier objects to', async () => {
    const screener = new CompositeScreener(
      new HeuristicScreener(),
      new StaticClassifier({ concerning: true, reasons: ['reads as hateful'] }),
    );

    await expect(screener.screen({ description: ORDINARY })).resolves.toEqual({
      decision: 'hold',
      reasons: ['reads as hateful'],
    });
  });

  it('holds what the patterns object to, keeping their reasons', async () => {
    const screener = new CompositeScreener(
      new HeuristicScreener(),
      new StaticClassifier(),
    );

    const verdict = await screener.screen({
      description: 'Message me at traveller@example.com about it.',
    });

    expect(verdict.decision).toBe('hold');
    expect(verdict.reasons).toContain('contains an email address');
  });

  it('does not ask the classifier about something already held', async () => {
    const classifier: TextClassifier = {
      classify: vi.fn(async () => ({ concerning: false, reasons: [] })),
    };

    await new CompositeScreener(new HeuristicScreener(), classifier).screen({
      description: 'Visit https://spam.example for cheap tours right now.',
    });

    expect(classifier.classify).not.toHaveBeenCalled();
  });

  it('sends the free-text label to the classifier as well', async () => {
    const classifier: TextClassifier = {
      classify: vi.fn(async (text: string) => {
        expect(text).toContain('Aggressive stray dogs');
        return { concerning: false, reasons: [] };
      }),
    };

    await new CompositeScreener(new PermissiveScreener(), classifier).screen({
      description: ORDINARY,
      customCategoryLabel: 'Aggressive stray dogs',
    });

    expect(classifier.classify).toHaveBeenCalled();
  });

  it('publishes when the classifier has nothing to say', async () => {
    const screener = new CompositeScreener(
      new PermissiveScreener(),
      new StaticClassifier({ concerning: false, reasons: [] }),
    );

    await expect(screener.screen({ description: ORDINARY })).resolves.toEqual({
      decision: 'publish',
      reasons: [],
    });
  });
});
