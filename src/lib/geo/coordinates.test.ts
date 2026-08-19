import { describe, expect, it } from 'vitest';

import {
  FUZZ_RADIUS_METRES,
  distanceMetres,
  fuzzCoordinates,
  isValidCoordinates,
  isValidLatitude,
  isValidLongitude,
  wrapLongitude,
} from './coordinates';

const BANGKOK = { latitude: 13.7563, longitude: 100.5018 };

describe('isValidLatitude', () => {
  it.each([[0], [90], [-90], [13.7563]])('accepts %p', (value) => {
    expect(isValidLatitude(value)).toBe(true);
  });

  it.each([[90.1], [-90.1], [Number.NaN], [Infinity], ['13'], [null]])(
    'rejects %p',
    (value) => {
      expect(isValidLatitude(value)).toBe(false);
    },
  );
});

describe('isValidLongitude', () => {
  it.each([[0], [180], [-180], [100.5]])('accepts %p', (value) => {
    expect(isValidLongitude(value)).toBe(true);
  });

  it.each([[180.1], [-180.1], [Number.NaN], ['100'], [undefined]])(
    'rejects %p',
    (value) => {
      expect(isValidLongitude(value)).toBe(false);
    },
  );
});

describe('isValidCoordinates', () => {
  it('accepts a well-formed pair', () => {
    expect(isValidCoordinates(BANGKOK)).toBe(true);
  });

  it.each([
    [{ latitude: 13.7 }],
    [{ longitude: 100.5 }],
    [{ latitude: 200, longitude: 0 }],
    [null],
    ['13.7,100.5'],
    [[13.7, 100.5]],
  ])('rejects %p', (value) => {
    expect(isValidCoordinates(value)).toBe(false);
  });
});

describe('wrapLongitude', () => {
  it.each([
    [0, 0],
    [100.5, 100.5],
    [-179.9, -179.9],
    [180.5, -179.5],
    [-180.5, 179.5],
    [540, 180],
  ])('wraps %p to %p', (input, expected) => {
    expect(wrapLongitude(input)).toBeCloseTo(expected, 6);
  });
});

describe('fuzzCoordinates', () => {
  it('never displaces further than the fuzz radius', () => {
    for (let i = 0; i < 500; i += 1) {
      const fuzzed = fuzzCoordinates(BANGKOK);
      expect(distanceMetres(BANGKOK, fuzzed)).toBeLessThanOrEqual(
        FUZZ_RADIUS_METRES + 1,
      );
    }
  });

  it('always moves the point somewhere', () => {
    const fuzzed = fuzzCoordinates(BANGKOK, () => 0.5);
    expect(fuzzed).not.toEqual(BANGKOK);
    expect(distanceMetres(BANGKOK, fuzzed)).toBeGreaterThan(0);
  });

  it('produces different positions on repeated calls', () => {
    const results = new Set(
      Array.from({ length: 20 }, () => JSON.stringify(fuzzCoordinates(BANGKOK))),
    );
    expect(results.size).toBeGreaterThan(1);
  });

  it('is reproducible when the randomness is pinned', () => {
    const pinned = () => 0.25;
    expect(fuzzCoordinates(BANGKOK, pinned)).toEqual(
      fuzzCoordinates(BANGKOK, pinned),
    );
  });

  it('stays inside the valid coordinate range near the poles', () => {
    const northPole = { latitude: 89.9999, longitude: 0 };
    for (let i = 0; i < 200; i += 1) {
      const fuzzed = fuzzCoordinates(northPole);
      expect(isValidCoordinates(fuzzed)).toBe(true);
    }
  });

  it('stays inside the valid range across the date line', () => {
    const nearDateLine = { latitude: 0, longitude: 179.9999 };
    for (let i = 0; i < 200; i += 1) {
      const fuzzed = fuzzCoordinates(nearDateLine);
      expect(isValidCoordinates(fuzzed)).toBe(true);
    }
  });
});

describe('distanceMetres', () => {
  it('is zero for the same point', () => {
    expect(distanceMetres(BANGKOK, BANGKOK)).toBe(0);
  });

  it('matches a known distance, Bangkok to Chiang Mai', () => {
    const chiangMai = { latitude: 18.7883, longitude: 98.9853 };
    // Roughly 580 km great-circle.
    expect(distanceMetres(BANGKOK, chiangMai)).toBeGreaterThan(570_000);
    expect(distanceMetres(BANGKOK, chiangMai)).toBeLessThan(590_000);
  });

  it('is symmetric', () => {
    const other = { latitude: 48.8566, longitude: 2.3522 };
    expect(distanceMetres(BANGKOK, other)).toBeCloseTo(
      distanceMetres(other, BANGKOK),
      6,
    );
  });
});
