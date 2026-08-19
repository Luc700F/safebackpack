import { describe, expect, it } from 'vitest';

import {
  RECOGNITION_COOKIE,
  readCookie,
  recognitionCookieOptions,
} from './cookies';
import { RECOGNITION_DAYS } from '../verification/recognition';

describe('recognitionCookieOptions', () => {
  it('keeps the cookie out of reach of scripts', () => {
    expect(recognitionCookieOptions('https://safebackpack.app').httpOnly).toBe(
      true,
    );
  });

  it('requires HTTPS on a real site', () => {
    expect(recognitionCookieOptions('https://safebackpack.app').secure).toBe(
      true,
    );
  });

  it('allows plain HTTP only for local development', () => {
    expect(recognitionCookieOptions('http://localhost:3000').secure).toBe(false);
  });

  it('limits cross-site sending', () => {
    expect(recognitionCookieOptions('https://safebackpack.app').sameSite).toBe(
      'lax',
    );
  });

  it('lapses together with the recognition window', () => {
    expect(recognitionCookieOptions('https://safebackpack.app').maxAge).toBe(
      RECOGNITION_DAYS * 24 * 60 * 60,
    );
  });
});

describe('readCookie', () => {
  it('finds a cookie among several', () => {
    expect(
      readCookie(`a=1; ${RECOGNITION_COOKIE}=token; b=2`, RECOGNITION_COOKIE),
    ).toBe('token');
  });

  it('finds the only cookie', () => {
    expect(readCookie('sb_recognition=token', RECOGNITION_COOKIE)).toBe('token');
  });

  it('decodes a percent-encoded value', () => {
    expect(readCookie('sb_recognition=a%2Eb', RECOGNITION_COOKIE)).toBe('a.b');
  });

  it('does not match a cookie whose name merely ends the same', () => {
    expect(readCookie('other_sb_recognition=x', RECOGNITION_COOKIE)).toBeNull();
  });

  it.each([[null], [''], ['garbage'], ['other=1']])(
    'returns null for header %p',
    (header) => {
      expect(readCookie(header, RECOGNITION_COOKIE)).toBeNull();
    },
  );

  it('returns null for a present but empty cookie', () => {
    expect(readCookie('sb_recognition=', RECOGNITION_COOKIE)).toBeNull();
  });
});
