import { describe, expect, it } from 'vitest';

import {
  FLAGS_TO_HIDE,
  FLAG_REASONS,
  isFlagReason,
  shouldHide,
} from './flags';

describe('FLAG_REASONS', () => {
  it('offers a reason for each way a report goes wrong', () => {
    expect(FLAG_REASONS.map((reason) => reason.id)).toEqual([
      'inaccurate',
      'identifies_someone',
      'abusive',
      'spam',
      'other',
    ]);
  });

  it('gives every reason wording a reader would recognise', () => {
    for (const reason of FLAG_REASONS) {
      expect(reason.label.length).toBeGreaterThan(0);
    }
  });
});

describe('isFlagReason', () => {
  it('accepts a known reason', () => {
    expect(isFlagReason('abusive')).toBe(true);
  });

  it.each([['nonsense'], [''], [null], [undefined], [42], [{}]])(
    'rejects %p',
    (value) => {
      expect(isFlagReason(value)).toBe(false);
    },
  );
});

describe('shouldHide', () => {
  it('leaves a report alone until enough readers object', () => {
    for (let count = 0; count < FLAGS_TO_HIDE; count += 1) {
      expect(shouldHide(count)).toBe(false);
    }
  });

  it('hides it once they do', () => {
    expect(shouldHide(FLAGS_TO_HIDE)).toBe(true);
    expect(shouldHide(FLAGS_TO_HIDE + 5)).toBe(true);
  });

  it('needs more than one, so nobody gets a delete button', () => {
    expect(FLAGS_TO_HIDE).toBeGreaterThan(1);
    expect(shouldHide(1)).toBe(false);
  });
});
