import { describe, expect, it } from 'vitest';

import {
  REPORT_CATEGORIES,
  findCategory,
  isReportCategoryId,
  resolveCategoryLabel,
} from './categories';

describe('REPORT_CATEGORIES', () => {
  it('exposes every category exactly once', () => {
    const ids = REPORT_CATEGORIES.map((category) => category.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers the seven agreed categories', () => {
    expect(REPORT_CATEGORIES.map((category) => category.id)).toEqual([
      'robbery',
      'theft',
      'harassment',
      'natural-hazard',
      'unrest',
      'scam',
      'other',
    ]);
  });

  it('gives every category a colour token and a hint', () => {
    for (const category of REPORT_CATEGORIES) {
      expect(category.colorToken).toMatch(/^--color-category-/);
      expect(category.hint.length).toBeGreaterThan(0);
    }
  });

  it('asks for a custom label only for the free-text category', () => {
    const custom = REPORT_CATEGORIES.filter((c) => c.requiresCustomLabel);
    expect(custom.map((c) => c.id)).toEqual(['other']);
  });
});

describe('isReportCategoryId', () => {
  it('accepts known ids', () => {
    expect(isReportCategoryId('scam')).toBe(true);
  });

  it.each([['unknown'], [''], [null], [undefined], [42], [{}]])(
    'rejects %p',
    (value) => {
      expect(isReportCategoryId(value)).toBe(false);
    },
  );
});

describe('findCategory', () => {
  it('returns the matching category', () => {
    expect(findCategory('theft')?.label).toBe('Pickpocketing or theft');
  });

  it('returns undefined for an unknown id', () => {
    expect(findCategory('nope')).toBeUndefined();
  });
});

describe('resolveCategoryLabel', () => {
  it('uses the fixed label for standard categories', () => {
    expect(resolveCategoryLabel('robbery')).toBe('Robbery or assault');
  });

  it('ignores a custom label on a standard category', () => {
    expect(resolveCategoryLabel('robbery', 'Bear attack')).toBe(
      'Robbery or assault',
    );
  });

  it('uses the reporter wording for the free-text category', () => {
    expect(resolveCategoryLabel('other', 'Aggressive stray dogs')).toBe(
      'Aggressive stray dogs',
    );
  });

  it('trims surrounding whitespace from the reporter wording', () => {
    expect(resolveCategoryLabel('other', '  Falling rocks \n')).toBe(
      'Falling rocks',
    );
  });

  it.each([[''], ['   '], [null], [undefined]])(
    'falls back to the generic label when the custom label is %p',
    (customLabel) => {
      expect(resolveCategoryLabel('other', customLabel)).toBe('Something else');
    },
  );

  it('throws on an unknown category id', () => {
    expect(() =>
      resolveCategoryLabel('nope' as never),
    ).toThrowError(/Unknown report category/);
  });
});
